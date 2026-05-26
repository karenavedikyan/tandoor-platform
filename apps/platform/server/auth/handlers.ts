/**
 * Общая бизнес-логика `/api/auth/*` для **Express** (`npm run dev`).
 *
 * На Vercel логика продублирована в `api/auth/[action].ts` (**self-contained**, без импортов из
 * `server/*` / `shared/*`), иначе `@vercel/node` даёт `FUNCTION_INVOCATION_FAILED` при загрузке
 * функции — см. `docs/auth-access-foundation.md` и PR #224 / revert #226.
 *
 * Email в БД хранится в **нижнем регистре**; логин сравнивает через `eq(authUsers.email, emailLower)`.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { UserRole, UserStatus } from "@shared/auth";
import { auditLog, authLoginFailures, authUsers, passwordResetLinks, sessions } from "@shared/auth-schema";
import type { AuthUserSnapshot } from "./auth-user-snapshot";
import { buildAuthCookie, clearAuthCookie, parseAuthRefreshToken } from "./cookie";
import { getAuthDb } from "./db";
import { hashPassword, verifyPassword } from "./password-hash";
import { getClientIp } from "./request-meta";
import { createSession, getSessionByRefreshToken, revokeAllSessionsForUser, revokeSession } from "./session-service";

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthHttpResult = {
  status: number;
  json: unknown;
  setCookie?: string | string[];
  cacheControl?: "no-store";
  retryAfterSec?: number;
};

export type { AuthUserSnapshot } from "./auth-user-snapshot";

function publicUserRow(u: AuthUserSnapshot): Record<string, unknown> {
  return {
    id: u.userId,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt,
  };
}

async function tryAudit(input: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = getAuthDb();
    if (!db) return;
    await db.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[audit-fail]", input.action, m.slice(0, 300));
    console.error("[auth] audit write failed", input.action, m.slice(0, 200));
  }
}

function readUserAgent(headers: Record<string, string | string[] | undefined>): string | null {
  const ua = headers["user-agent"];
  if (typeof ua === "string") return ua || null;
  if (Array.isArray(ua) && ua[0]) return ua[0]!;
  return null;
}

function validationError(message: string): AuthHttpResult {
  return {
    status: 400,
    json: { success: false, code: "VALIDATION_ERROR", message },
  };
}

function internalError(): AuthHttpResult {
  return {
    status: 500,
    json: { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." },
  };
}

function invalidCredentials(): AuthHttpResult {
  return {
    status: 401,
    json: {
      success: false,
      code: "INVALID_CREDENTIALS",
      message: "Неверный email или пароль.",
    },
  };
}



function redeemClientIpExpress(
  headers: Record<string, string | string[] | undefined>,
  socketRemoteAddress?: string | undefined,
): string | null {
  return getClientIp(headers) ?? (socketRemoteAddress?.trim() || null);
}

function validateRedeemPassword(plain: string): { ok: true; trimmed: string } | { ok: false; message: string } {
  const t = plain.trim();
  if (t.length < 12 || t.length > 200) {
    return { ok: false, message: "Пароль должен быть не короче 12 символов и содержать букву и цифру." };
  }
  if (!/\d/.test(t)) {
    return { ok: false, message: "Пароль должен быть не короче 12 символов и содержать букву и цифру." };
  }
  if (!/[a-zA-Z\u0400-\u04FF]/.test(t)) {
    return { ok: false, message: "Пароль должен быть не короче 12 символов и содержать букву и цифру." };
  }
  return { ok: true, trimmed: t };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function passwordResetLinkRedeemHandler(input: {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  socketRemoteAddress?: string | undefined;
}): Promise<AuthHttpResult> {
  const body = input.body as { token?: unknown; newPassword?: unknown };
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (!token || token.length < 30 || token.length > 100) {
    return { status: 400, json: { success: false, code: "INVALID_INPUT", message: "Некорректные данные." } };
  }
  const pwv = validateRedeemPassword(newPassword);
  if (!pwv.ok) {
    return { status: 400, json: { success: false, code: "PASSWORD_TOO_WEAK", message: pwv.message } };
  }

  const db = getAuthDb();
  if (!db) return internalError();

  const tokenHash = sha256Hex(token);
  const rows = await db
    .select({
      id: passwordResetLinks.id,
      userId: passwordResetLinks.userId,
      expiresAt: passwordResetLinks.expiresAt,
      usedAt: passwordResetLinks.usedAt,
    })
    .from(passwordResetLinks)
    .where(eq(passwordResetLinks.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { status: 400, json: { success: false, code: "RESET_LINK_INVALID", message: "Ссылка недействительна." } };
  }
  if (row.usedAt != null) {
    await tryAudit({
      actorUserId: null,
      action: "auth.reset_link.expired_attempt",
      entityType: "user",
      entityId: row.userId,
      metadata: { linkId: row.id, reason: "used" },
    });
    return { status: 400, json: { success: false, code: "RESET_LINK_USED", message: "Ссылка уже использована." } };
  }
  const expMs = Date.parse(row.expiresAt);
  if (!Number.isFinite(expMs) || expMs <= Date.now()) {
    await tryAudit({
      actorUserId: null,
      action: "auth.reset_link.expired_attempt",
      entityType: "user",
      entityId: row.userId,
      metadata: { linkId: row.id, reason: "expired" },
    });
    return { status: 400, json: { success: false, code: "RESET_LINK_EXPIRED", message: "Срок действия ссылки истёк." } };
  }

  const ip = redeemClientIpExpress(input.headers, input.socketRemoteAddress);
  const ipVal = ip ?? "";
  const newHash = await hashPassword(pwv.trimmed);
  try {
    await db
      .update(authUsers)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(authUsers.id, row.userId));
    await db
      .update(passwordResetLinks)
      .set({ usedAt: sql`NOW()`, usedIp: ipVal })
      .where(eq(passwordResetLinks.id, row.id));
    await db
      .update(sessions)
      .set({ revokedAt: sql`NOW()` })
      .where(and(eq(sessions.userId, row.userId), isNull(sessions.revokedAt)));
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[auth] passwordResetLinkRedeemHandler", m.slice(0, 200));
    return internalError();
  }

  await tryAudit({
    actorUserId: null,
    action: "auth.reset_link.used",
    entityType: "user",
    entityId: row.userId,
    metadata: { linkId: row.id, ip },
  });

  return {
    status: 200,
    cacheControl: "no-store",
    json: { success: true, message: "Пароль обновлён. Войдите с новым паролем." },
  };
}

export async function loginHandler(input: {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}): Promise<AuthHttpResult> {
  const ip = getClientIp(input.headers);
  try {
    const body = input.body as { email?: unknown; password?: unknown } | null;
    const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!rawEmail || !SIMPLE_EMAIL_RE.test(rawEmail)) {
      return validationError("Укажите корректный email.");
    }
    if (password.length < 1) {
      return validationError("Укажите пароль.");
    }

    const db = getAuthDb();
    if (!db) {
      return internalError();
    }

    const lockRows = await db
      .select({
        failCount: authLoginFailures.failCount,
        lockedUntil: authLoginFailures.lockedUntil,
      })
      .from(authLoginFailures)
      .where(eq(authLoginFailures.emailLower, rawEmail))
      .limit(1);
    const lockRow = lockRows[0];
    if (lockRow?.lockedUntil) {
      const lu = new Date(lockRow.lockedUntil).getTime();
      if (Number.isFinite(lu) && lu > Date.now()) {
        const retryAfterSec = Math.max(1, Math.ceil((lu - Date.now()) / 1000));
        return {
          status: 429,
          json: {
            success: false,
            code: "RATE_LIMITED",
            message: "Слишком много попыток входа. Повторите позже.",
          },
          retryAfterSec,
        };
      }
    }

    const rows = await db
      .select({
        id: authUsers.id,
        email: authUsers.email,
        fullName: authUsers.fullName,
        role: authUsers.role,
        status: authUsers.status,
        mustChangePassword: authUsers.mustChangePassword,
        lastLoginAt: authUsers.lastLoginAt,
        passwordHash: authUsers.passwordHash,
      })
      .from(authUsers)
      .where(eq(authUsers.email, rawEmail))
      .limit(1);

    const user = rows[0];
    const badCreds =
      !user ||
      user.status !== "active" ||
      user.passwordHash == null ||
      !(await verifyPassword(password, user.passwordHash));

    if (badCreds) {
      const prevCount = lockRow?.failCount ?? 0;
      const attempt = prevCount + 1;
      await db.execute(sql`
        INSERT INTO auth_login_failures (email_lower, fail_count, locked_until, updated_at)
        VALUES (${rawEmail}, 1, NULL, NOW())
        ON CONFLICT (email_lower) DO UPDATE SET
          fail_count = CASE WHEN auth_login_failures.fail_count + 1 >= 5 THEN 0 ELSE auth_login_failures.fail_count + 1 END,
          locked_until = CASE WHEN auth_login_failures.fail_count + 1 >= 5 THEN NOW() + interval '15 minutes' ELSE auth_login_failures.locked_until END,
          updated_at = NOW()
      `);
      await tryAudit({
        actorUserId: null,
        action: "auth.login.failed",
        entityType: "email",
        entityId: rawEmail,
        metadata: { ip, failCount: attempt },
      });
      return invalidCredentials();
    }

    const userAgent = readUserAgent(input.headers);
    const sess = await createSession({ userId: user.id, userAgent, ip });

    await db.delete(authLoginFailures).where(eq(authLoginFailures.emailLower, rawEmail));

    let lastLoginAt: string | null = user.lastLoginAt ?? null;
    try {
      const updated = await db
        .update(authUsers)
        .set({ lastLoginAt: sql`now()` })
        .where(eq(authUsers.id, user.id))
        .returning({ lastLoginAt: authUsers.lastLoginAt });
      const v = updated[0]?.lastLoginAt;
      if (v != null) lastLoginAt = v;
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[auth] login lastLoginAt update failed", m.slice(0, 200));
    }

    await tryAudit({
      actorUserId: user.id,
      action: "auth.login",
      entityType: "session",
      entityId: sess.sessionId,
      metadata: { ip, userAgent },
    });

    const snapshot: AuthUserSnapshot = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt,
    };

    return {
      status: 200,
      setCookie: buildAuthCookie(sess.refreshToken),
      json: { success: true, user: publicUserRow(snapshot) },
    };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[auth] loginHandler", m.slice(0, 200));
    return internalError();
  }
}

export function meHandler(input: { auth: AuthUserSnapshot }): AuthHttpResult {
  return {
    status: 200,
    cacheControl: "no-store",
    json: { success: true, user: publicUserRow(input.auth) },
  };
}

export async function myVisibleClientCodesHandler(input: { auth: AuthUserSnapshot }): Promise<AuthHttpResult> {
  const db = getAuthDb();
  if (!db) {
    return { status: 500, json: { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." } };
  }
  const role = input.auth.role;
  if (role === "admin" || role === "director" || role === "analyst" || role === "marketer") {
    return { status: 200, cacheControl: "no-store", json: { success: true, all: true, codes: null } };
  }
  const uid = input.auth.userId;
  if (role === "rop") {
    const r = await db.execute<{ client_code: string }>(
      sql`
        SELECT DISTINCT ca.client_code AS "client_code"
        FROM client_assignments ca
        INNER JOIN teams t ON t.id = ca.team_id
        WHERE t.rop_user_id = ${uid}::uuid
      `,
    );
    const rows = (r as unknown as { rows?: { client_code: string }[] }).rows ?? (r as unknown as { client_code: string }[]);
    const arr = Array.isArray(rows) ? rows : [];
    return {
      status: 200,
      cacheControl: "no-store",
      json: { success: true, all: false, codes: arr.map((x) => x.client_code).filter(Boolean) },
    };
  }
  if (role === "manager" || role === "regional_manager") {
    const r = await db.execute<{ client_code: string }>(
      sql`
        SELECT DISTINCT client_code AS "client_code"
        FROM client_assignments
        WHERE responsible_user_id = ${uid}::uuid
      `,
    );
    const rows = (r as unknown as { rows?: { client_code: string }[] }).rows ?? (r as unknown as { client_code: string }[]);
    const arr = Array.isArray(rows) ? rows : [];
    return {
      status: 200,
      cacheControl: "no-store",
      json: { success: true, all: false, codes: arr.map((x) => x.client_code).filter(Boolean) },
    };
  }
  return { status: 200, cacheControl: "no-store", json: { success: true, all: false, codes: [] } };
}

export async function logoutHandler(input: {
  headers: Record<string, string | string[] | undefined>;
}): Promise<AuthHttpResult> {
  const ip = getClientIp(input.headers);
  const userAgent = readUserAgent(input.headers);
  const token = parseAuthRefreshToken(
    typeof input.headers.cookie === "string" ? input.headers.cookie : undefined,
  );
  let sessionId: string | null = null;
  let actorUserId: string | null = null;
  try {
    if (token) {
      const s = await getSessionByRefreshToken(token);
      if (s) {
        sessionId = s.sessionId;
        actorUserId = s.userId;
        await revokeSession(s.sessionId);
      }
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[auth] logoutHandler revoke", m.slice(0, 200));
  }

  const entityId = sessionId ?? "unknown";
  await tryAudit({
    actorUserId: actorUserId,
    action: "auth.logout",
    entityType: "session",
    entityId,
    metadata: { ip, userAgent },
  });

  return {
    status: 200,
    setCookie: clearAuthCookie(),
    json: { success: true },
  };
}

export async function logoutAllHandler(input: {
  auth: AuthUserSnapshot;
  headers: Record<string, string | string[] | undefined>;
}): Promise<AuthHttpResult> {
  const ip = getClientIp(input.headers);
  const userAgent = readUserAgent(input.headers);
  const uid = input.auth.userId;
  try {
    await revokeAllSessionsForUser(uid);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[auth] logoutAllHandler", m.slice(0, 200));
    return internalError();
  }

  await tryAudit({
    actorUserId: uid,
    action: "auth.logout_all",
    entityType: "user",
    entityId: uid,
    metadata: { ip, userAgent },
  });

  return {
    status: 200,
    cacheControl: "no-store",
    setCookie: clearAuthCookie(),
    json: { success: true },
  };
}
