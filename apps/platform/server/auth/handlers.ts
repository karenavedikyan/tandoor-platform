/**
 * Общая бизнес-логика `/api/auth/*` для Vercel и Express (без дублирования).
 *
 * Email в БД хранится в **нижнем регистре** (нормализация при seed/регистрации);
 * логин сравнивает через `eq(authUsers.email, emailLower)` без SQL `lower()`.
 */

import { eq, sql } from "drizzle-orm";
import type { UserRole, UserStatus } from "@shared/auth";
import { auditLog, authUsers } from "@shared/auth-schema";
import type { AuthUserSnapshot } from "./auth-user-snapshot";
import { buildAuthCookie, clearAuthCookie, parseAuthRefreshToken } from "./cookie";
import { getAuthDb } from "./db";
import { verifyPassword } from "./password-hash";
import { checkLoginRateLimit, clearLoginRateLimit, recordLoginFailure } from "./rate-limit";
import { getClientIp } from "./request-meta";
import { createSession, getSessionByRefreshToken, revokeAllSessionsForUser, revokeSession } from "./session-service";

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthHttpResult = {
  status: number;
  json: unknown;
  /** Одна строка Set-Cookie или несколько для Express/Vercel */
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
      metadata: input.metadata ?? null,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
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

    const rl = checkLoginRateLimit({ ip, emailLower: rawEmail });
    if (!rl.ok) {
      return {
        status: 429,
        json: {
          success: false,
          code: "RATE_LIMITED",
          message: "Слишком много попыток входа. Повторите позже.",
        },
        retryAfterSec: rl.retryAfterSec,
      };
    }

    const db = getAuthDb();
    if (!db) {
      return internalError();
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
      recordLoginFailure({ ip, emailLower: rawEmail });
      return invalidCredentials();
    }

    const userAgent = readUserAgent(input.headers);
    const sess = await createSession({ userId: user.id, userAgent, ip });

    clearLoginRateLimit({ ip, emailLower: rawEmail });

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
