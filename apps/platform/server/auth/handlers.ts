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
import { roleHasPermission } from "@shared/auth-rbac";
import { auditLog, authLoginFailures, authUsers, passwordResetLinks, sessions } from "@shared/auth-schema";
import { loadAuthUserSnapshot, type AuthUserSnapshot } from "./auth-user-snapshot";
import {
  buildAdminReturnCookie,
  buildAuthCookie,
  clearAdminReturnCookie,
  clearAuthCookie,
  parseAdminReturnToken,
  parseAuthRefreshToken,
} from "./cookie";
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
    impersonatedBy: u.impersonatedBy ?? null,
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

const UUID_RE_IMP = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function impersonateStartHandler(input: {
  auth: AuthUserSnapshot;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}): Promise<AuthHttpResult> {
  const db = getAuthDb();
  if (!db) return internalError();
  const token = parseAuthRefreshToken(
    typeof input.headers.cookie === "string" ? input.headers.cookie : undefined,
  );
  if (!token) return { status: 403, json: { success: false, code: "FORBIDDEN" } };
  const session = await getSessionByRefreshToken(token);
  if (!session) return { status: 403, json: { success: false, code: "FORBIDDEN" } };
  if (session.impersonatorUserId != null) {
    return {
      status: 400,
      json: {
        success: false,
        code: "ALREADY_IMPERSONATING",
        message: "Сначала выйдите из режима наблюдения.",
      },
    };
  }
  if (!roleHasPermission(input.auth.role, "users.impersonate")) {
    return { status: 403, json: { success: false, code: "FORBIDDEN" } };
  }
  const body = (input.body ?? {}) as { targetUserId?: unknown };
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
  if (!UUID_RE_IMP.test(targetUserId)) {
    return validationError("Некорректный targetUserId.");
  }
  if (targetUserId === input.auth.userId) {
    return {
      status: 400,
      json: { success: false, code: "CANNOT_IMPERSONATE_SELF", message: "Нельзя войти под собственным аккаунтом." },
    };
  }
  const rows = await db.select().from(authUsers).where(eq(authUsers.id, targetUserId)).limit(1);
  const target = rows[0];
  if (!target) return { status: 404, json: { success: false, code: "USER_NOT_FOUND" } };
  if (target.role === "admin") {
    return { status: 400, json: { success: false, code: "CANNOT_IMPERSONATE_ADMIN" } };
  }
  if (target.status !== "active") {
    return { status: 400, json: { success: false, code: "TARGET_NOT_ACTIVE" } };
  }
  const userAgent = readUserAgent(input.headers);
  const ip = getClientIp(input.headers);
  const expiresAtIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const sess = await createSession({
    userId: target.id,
    userAgent,
    ip,
    impersonatorUserId: input.auth.userId,
    expiresAtIso,
  });
  await tryAudit({
    actorUserId: input.auth.userId,
    action: "admin.impersonate.start",
    entityType: "users",
    entityId: target.id,
    metadata: {
      targetEmail: target.email,
      targetRole: target.role,
      sessionId: sess.sessionId,
      ttlMinutes: 60,
    },
  });
  const snap: AuthUserSnapshot = {
    userId: target.id,
    email: target.email,
    fullName: target.fullName,
    role: target.role as UserRole,
    status: target.status as UserStatus,
    mustChangePassword: target.mustChangePassword,
    lastLoginAt: target.lastLoginAt ?? null,
  };
  return {
    status: 200,
    cacheControl: "no-store",
    setCookie: [buildAuthCookie(sess.refreshToken, { maxAgeSec: 60 * 60 }), buildAdminReturnCookie(token)],
    json: { success: true, user: publicUserRow(snap), expiresAt: sess.expiresAt },
  };
}

export async function impersonateStopHandler(input: {
  headers: Record<string, string | string[] | undefined>;
}): Promise<AuthHttpResult> {
  const returnTok = parseAdminReturnToken(
    typeof input.headers.cookie === "string" ? input.headers.cookie : undefined,
  );
  if (!returnTok) return { status: 400, json: { success: false, code: "NOT_IMPERSONATING" } };
  const curTok = parseAuthRefreshToken(
    typeof input.headers.cookie === "string" ? input.headers.cookie : undefined,
  );
  if (!curTok) return { status: 400, json: { success: false, code: "NOT_IMPERSONATING" } };
  const curSess = await getSessionByRefreshToken(curTok);
  if (!curSess || curSess.impersonatorUserId == null) {
    return { status: 400, json: { success: false, code: "NOT_IMPERSONATING" } };
  }
  const adminId = curSess.impersonatorUserId;
  const admSess = await getSessionByRefreshToken(returnTok);
  if (!admSess || admSess.userId !== adminId) {
    return { status: 400, json: { success: false, code: "RETURN_SESSION_INVALID" } };
  }
  await revokeSession(curSess.sessionId);
  const admSnap = await loadAuthUserSnapshot(adminId);
  if (!admSnap) {
    return { status: 400, json: { success: false, code: "RETURN_SESSION_INVALID" } };
  }
  await tryAudit({
    actorUserId: adminId,
    action: "admin.impersonate.stop",
    entityType: "users",
    entityId: curSess.userId,
    metadata: { reason: "manual" },
  });
  return {
    status: 200,
    cacheControl: "no-store",
    setCookie: [buildAuthCookie(returnTok), clearAdminReturnCookie()],
    json: { success: true, user: publicUserRow(admSnap) },
  };
}

type VisibleClientsPayloadHttp =
  | { all: true; codes: null; assignments: null }
  | {
      all: false;
      codes: string[];
      assignments: Array<{ code: string; responsibleUserId: string | null; teamId: string | null }>;
    };

type ClientAssignmentRowHttp = {
  client_code: string;
  responsible_user_id: string | null;
  team_id: string | null;
};

async function buildVisibleClientsPayloadHttp(db: NonNullable<ReturnType<typeof getAuthDb>>, row: AuthUserSnapshot): Promise<VisibleClientsPayloadHttp> {
  const role = row.role;
  if (role === "admin" || role === "director" || role === "analyst" || role === "marketer") {
    return { all: true, codes: null, assignments: null };
  }
  const uid = row.userId;
  if (role === "rop") {
    const r = await db.execute<ClientAssignmentRowHttp>(
      sql`
        SELECT DISTINCT ON (ca.client_code) ca.client_code, ca.responsible_user_id, ca.team_id
        FROM client_assignments ca
        INNER JOIN teams t ON t.id = ca.team_id
        WHERE t.rop_user_id = ${uid}::uuid
        ORDER BY ca.client_code
      `,
    );
    const rows = (r as unknown as { rows?: ClientAssignmentRowHttp[] }).rows ?? (r as unknown as ClientAssignmentRowHttp[]);
    const arr = Array.isArray(rows) ? rows : [];
    return {
      all: false,
      codes: arr.map((x) => x.client_code).filter(Boolean),
      assignments: arr.map((x) => ({
        code: x.client_code,
        responsibleUserId: x.responsible_user_id,
        teamId: x.team_id,
      })),
    };
  }
  if (role === "manager") {
    const r = await db.execute<ClientAssignmentRowHttp>(
      sql`
        SELECT DISTINCT ON (client_code) client_code, responsible_user_id, team_id
        FROM client_assignments
        WHERE responsible_user_id = ${uid}::uuid
        ORDER BY client_code
      `,
    );
    const rows = (r as unknown as { rows?: ClientAssignmentRowHttp[] }).rows ?? (r as unknown as ClientAssignmentRowHttp[]);
    const arr = Array.isArray(rows) ? rows : [];
    return {
      all: false,
      codes: arr.map((x) => x.client_code).filter(Boolean),
      assignments: arr.map((x) => ({
        code: x.client_code,
        responsibleUserId: x.responsible_user_id,
        teamId: x.team_id,
      })),
    };
  }
  if (role === "regional_manager") {
    const r = await db.execute<{ client_code: string }>(
      sql`
        SELECT DISTINCT upper(regexp_replace(dealer_id, '^client-', '')) AS client_code
        FROM dealer_overrides
        WHERE regional_manager_id = ${uid}::uuid
        ORDER BY client_code
      `,
    );
    const rows = (r as unknown as { rows?: { client_code: string }[] }).rows ?? (r as unknown as { client_code: string }[]);
    const arr = Array.isArray(rows) ? rows : [];
    const codes = arr.map((x) => x.client_code).filter(Boolean);
    return {
      all: false,
      codes,
      assignments: codes.map((code) => ({
        code,
        responsibleUserId: uid,
        teamId: null,
      })),
    };
  }
  return { all: false, codes: [], assignments: [] };
}

export async function myVisibleClientCodesHandler(input: { auth: AuthUserSnapshot }): Promise<AuthHttpResult> {
  const db = getAuthDb();
  if (!db) {
    return { status: 500, json: { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." } };
  }
  const payload = await buildVisibleClientsPayloadHttp(db, input.auth);
  return {
    status: 200,
    cacheControl: "no-store",
    json: { success: true, ...payload },
  };
}

export async function myOrgSnapshotHandler(input: { auth: AuthUserSnapshot }): Promise<AuthHttpResult> {
  const db = getAuthDb();
  if (!db) {
    return { status: 500, json: { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." } };
  }
  const meId = input.auth.userId;
  const role = input.auth.role;
  const meFullName = (input.auth.fullName ?? "").trim() || input.auth.email;

  const teamsRes = await db.execute<{ id: string; name: string; rop_user_id: string | null; rop_name: string | null }>(
    sql`
      SELECT t.id, t.name, t.rop_user_id, u.full_name AS rop_name
      FROM teams t
      LEFT JOIN users u ON u.id = t.rop_user_id
      ORDER BY t.name
    `,
  );
  const allTeams =
    (teamsRes as unknown as { rows?: { id: string; name: string; rop_user_id: string | null; rop_name: string | null }[] }).rows ??
    (teamsRes as unknown as { id: string; name: string; rop_user_id: string | null; rop_name: string | null }[]);
  const teamsArr = Array.isArray(allTeams) ? allTeams : [];

  const usersRes = await db.execute<{
    id: string;
    full_name: string | null;
    role: UserRole;
    status: UserStatus;
    team_id: string | null;
  }>(
    sql`
      SELECT u.id, u.full_name, u.role, u.status, utm.team_id
      FROM users u
      LEFT JOIN user_team_memberships utm ON utm.user_id = u.id
      WHERE u.status IN ('active', 'invited')
    `,
  );
  const rawUserRows =
    (usersRes as unknown as {
      rows?: { id: string; full_name: string | null; role: UserRole; status: UserStatus; team_id: string | null }[];
    }).rows ??
    (usersRes as unknown as { id: string; full_name: string | null; role: UserRole; status: UserStatus; team_id: string | null }[]);
  const userRows = Array.isArray(rawUserRows) ? rawUserRows : [];

  type Agg = { id: string; fullName: string; role: UserRole; status: UserStatus; teamIds: Set<string> };
  const userAgg = new Map<string, Agg>();
  for (const r of userRows) {
    const fn = (r.full_name ?? "").trim() || "";
    let agg = userAgg.get(r.id);
    if (!agg) {
      agg = { id: r.id, fullName: fn, role: r.role, status: r.status, teamIds: new Set() };
      userAgg.set(r.id, agg);
    }
    if (r.team_id) agg.teamIds.add(r.team_id);
  }

  const ledTeamByRop = new Map<string, string>();
  for (const t of teamsArr) {
    if (t.rop_user_id) ledTeamByRop.set(t.rop_user_id, t.id);
  }

  const utmMine = await db.execute<{ team_id: string }>(
    sql`SELECT team_id FROM user_team_memberships WHERE user_id = ${meId}::uuid`,
  );
  const utmRows = (utmMine as unknown as { rows?: { team_id: string }[] }).rows ?? (utmMine as unknown as { team_id: string }[]);
  const utmList = Array.isArray(utmRows) ? utmRows : [];
  const myUtmTeamIds = Array.from(new Set(utmList.map((r) => r.team_id).filter(Boolean)));

  let meTeamId: string | null = null;
  if (role === "rop") {
    meTeamId = ledTeamByRop.get(meId) ?? myUtmTeamIds[0] ?? null;
  } else if (role === "manager" || role === "regional_manager") {
    meTeamId = myUtmTeamIds[0] ?? null;
  }

  const vis = await buildVisibleClientsPayloadHttp(db, input.auth);

  const adminRes = await db.execute<{ id: string }>(
    sql`SELECT id FROM users WHERE role = 'admin' AND status IN ('active', 'invited')`,
  );
  const adminRows = (adminRes as unknown as { rows?: { id: string }[] }).rows ?? (adminRes as unknown as { id: string }[]);
  const adminList = Array.isArray(adminRows) ? adminRows : [];
  const adminIds = new Set(adminList.map((r) => r.id));

  function membersOfTeams(teamIds: string[]): Set<string> {
    const ids = new Set<string>();
    const tset = new Set(teamIds);
    for (const agg of Array.from(userAgg.values())) {
      for (const tid of Array.from(agg.teamIds)) {
        if (tset.has(tid)) ids.add(agg.id);
      }
    }
    return ids;
  }

  let visibility: {
    all: boolean;
    clientCodes: string[] | null;
    teamIds: string[];
    visibleUserIds: string[];
  };
  let teamsOut: typeof teamsArr;

  if (vis.all) {
    visibility = {
      all: true,
      clientCodes: null,
      teamIds: teamsArr.map((t) => t.id),
      visibleUserIds: Array.from(userAgg.keys()),
    };
    teamsOut = teamsArr;
  } else if (role === "rop") {
    const myLedTeamIds = teamsArr.filter((t) => t.rop_user_id === meId).map((t) => t.id);
    const vu = new Set<string>([meId, ...Array.from(adminIds)]);
    for (const id of Array.from(membersOfTeams(myLedTeamIds))) vu.add(id);
    visibility = {
      all: false,
      clientCodes: vis.codes,
      teamIds: myLedTeamIds,
      visibleUserIds: Array.from(vu),
    };
    const allowT = new Set(myLedTeamIds);
    teamsOut = teamsArr.filter((t) => allowT.has(t.id));
  } else if (role === "manager" || role === "regional_manager") {
    const tid = meTeamId ?? vis.assignments[0]?.teamId ?? null;
    const teamRow = tid ? teamsArr.find((t) => t.id === tid) : undefined;
    const ropId = teamRow?.rop_user_id ?? null;
    const vu = new Set<string>([meId, ...Array.from(adminIds)]);
    if (ropId) vu.add(ropId);
    const teamIds = tid ? [tid] : [];
    visibility = {
      all: false,
      clientCodes: vis.codes,
      teamIds,
      visibleUserIds: Array.from(vu),
    };
    teamsOut = tid ? teamsArr.filter((t) => t.id === tid) : [];
  } else {
    const teamIdSet = new Set<string>();
    for (const a of vis.assignments) {
      if (a.teamId) teamIdSet.add(a.teamId);
    }
    const vu = new Set<string>([meId, ...Array.from(adminIds)]);
    for (const a of vis.assignments) {
      if (a.responsibleUserId) vu.add(a.responsibleUserId);
    }
    visibility = {
      all: false,
      clientCodes: vis.codes,
      teamIds: Array.from(teamIdSet),
      visibleUserIds: Array.from(vu),
    };
    teamsOut = teamsArr.filter((t) => teamIdSet.has(t.id));
  }

  const allowUsers = new Set(visibility.visibleUserIds);
  const usersOut = Array.from(userAgg.values())
    .filter((u) => allowUsers.has(u.id))
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      teamId: u.teamIds.size > 0 ? Array.from(u.teamIds)[0]! : ledTeamByRop.get(u.id) ?? null,
    }));

  return {
    status: 200,
    cacheControl: "no-store",
    json: {
      success: true,
      me: { id: meId, role, fullName: meFullName, teamId: meTeamId },
      visibility,
      teams: teamsOut.map((t) => ({
        id: t.id,
        name: t.name,
        ropUserId: t.rop_user_id,
        ropName: t.rop_name,
      })),
      users: usersOut,
    },
  };
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
    setCookie: [clearAuthCookie(), clearAdminReturnCookie()],
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
