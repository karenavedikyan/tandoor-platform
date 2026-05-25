/**
 * `/api/admin/profile-*` для Express (`npm run dev`).
 * Контракт совпадает с Vercel `api/admin/[action].ts`.
 */

import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { auditLog, authUsers, sessions } from "@shared/auth-schema";
import type { AuthUserSnapshot } from "../auth/auth-user-snapshot";
import { parseAuthRefreshToken } from "../auth/cookie";
import { getAuthDb } from "../auth/db";
import { hashPassword, verifyPassword } from "../auth/password-hash";

const JSON_CT = "application/json; charset=utf-8";

const RU_PHONE_RE = /^\+7\d{10}$/;
const PHONE_SELF_FORMAT_MESSAGE =
  "Укажите номер в формате +7XXXXXXXXXX (10 цифр после +7).";

/** Толерантная нормализация ввода телефона для самообновления профиля. */
function normalizeRuPhoneSelf(pt: string): string | null {
  let digits = pt.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }
  if (!digits.startsWith("7")) {
    digits = "7" + digits;
  }
  digits = digits.slice(0, 11);
  if (digits.length !== 11) return null;
  const normalized = `+${digits}`;
  if (!RU_PHONE_RE.test(normalized)) return null;
  return normalized;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function applyJson(res: Response, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function publicProfileUser(r: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}): Record<string, unknown> {
  return {
    id: r.id,
    email: r.email,
    fullName: r.fullName,
    phone: r.phone,
    role: r.role,
    status: r.status,
    mustChangePassword: r.mustChangePassword,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
  };
}

async function tryAudit(input: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = getAuthDb();
    if (!db) return;
    await db.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] audit", input.action, m.slice(0, 200));
  }
}

function cookieRefreshHash(req: Request): string | null {
  const raw = parseAuthRefreshToken(typeof req.headers.cookie === "string" ? req.headers.cookie : undefined);
  if (!raw) return null;
  return sha256Hex(raw);
}

export async function getSelf(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  try {
    const rows = await db
      .select({
        id: authUsers.id,
        email: authUsers.email,
        fullName: authUsers.fullName,
        phone: authUsers.phone,
        role: authUsers.role,
        status: authUsers.status,
        mustChangePassword: authUsers.mustChangePassword,
        lastLoginAt: authUsers.lastLoginAt,
        createdAt: authUsers.createdAt,
      })
      .from(authUsers)
      .where(eq(authUsers.id, auth.userId))
      .limit(1);
    const r = rows[0];
    if (!r) {
      applyJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
      return;
    }
    applyJson(res, 200, {
      success: true,
      user: publicProfileUser({
        ...r,
        phone: r.phone ?? null,
        lastLoginAt: r.lastLoginAt ?? null,
      }),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] profile-get-self", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function updateSelf(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  for (const k of ["role", "status", "password"]) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      applyJson(res, 400, {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Поле недоступно для самостоятельного изменения.",
      });
      return;
    }
  }

  const hasFull = Object.prototype.hasOwnProperty.call(body, "fullName");
  const hasPhone = Object.prototype.hasOwnProperty.call(body, "phone");
  const hasEmail = Object.prototype.hasOwnProperty.call(body, "email");
  if (!hasFull && !hasPhone && !hasEmail) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Не указано ни одно поле для обновления." });
    return;
  }

  let fullNameParam: string | null = null;
  if (hasFull) {
    if (typeof body.fullName !== "string") {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите ФИО (от 2 до 200 символов)." });
      return;
    }
    const t = body.fullName.trim();
    if (t.length < 2 || t.length > 200) {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите ФИО (от 2 до 200 символов)." });
      return;
    }
    fullNameParam = t;
  }

  let phonePresent = false;
  let phoneValue: string | null | undefined;
  if (hasPhone) {
    phonePresent = true;
    const pv = body.phone;
    if (pv === null) {
      phoneValue = null;
    } else if (typeof pv === "string") {
      const pt = pv.trim();
      if (!pt) {
        phoneValue = null;
      } else {
        const normalized = normalizeRuPhoneSelf(pt);
        if (normalized == null) {
          applyJson(res, 400, {
            success: false,
            code: "VALIDATION_ERROR",
            message: PHONE_SELF_FORMAT_MESSAGE,
          });
          return;
        }
        phoneValue = normalized;
      }
    } else {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный телефон." });
      return;
    }
  }

  const emailSelfRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let emailPresent = false;
  let emailValue: string | null = null;
  if (hasEmail) {
    emailPresent = true;
    if (typeof body.email !== "string") {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный email." });
      return;
    }
    const em = body.email.trim().toLowerCase();
    if (!emailSelfRe.test(em)) {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный email." });
      return;
    }
    emailValue = em;
  }

  if (emailPresent && emailValue != null) {
    const dup = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(and(eq(authUsers.email, emailValue), ne(authUsers.id, auth.userId)))
      .limit(1);
    if (dup[0]) {
      applyJson(res, 409, { success: false, code: "CONFLICT", message: "Этот email уже занят." });
      return;
    }
  }

  try {
    const updated = await db
      .update(authUsers)
      .set({
        fullName: hasFull && fullNameParam != null ? fullNameParam : undefined,
        phone: phonePresent ? phoneValue ?? null : undefined,
        email: emailPresent && emailValue != null ? emailValue : undefined,
        updatedAt: sql`NOW()`,
      })
      .where(eq(authUsers.id, auth.userId))
      .returning({
        id: authUsers.id,
        email: authUsers.email,
        fullName: authUsers.fullName,
        phone: authUsers.phone,
        role: authUsers.role,
        status: authUsers.status,
        mustChangePassword: authUsers.mustChangePassword,
        lastLoginAt: authUsers.lastLoginAt,
        createdAt: authUsers.createdAt,
      });

    const u = updated[0];
    if (!u) {
      applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      return;
    }

    const fields: string[] = [];
    if (hasFull) fields.push("fullName");
    if (hasPhone) fields.push("phone");
    if (hasEmail) fields.push("email");

    if (hasEmail && emailValue != null) {
      await tryAudit({
        actorUserId: auth.userId,
        action: "user.email.changed",
        entityType: "user",
        entityId: auth.userId,
        metadata: { oldEmail: auth.email.trim().toLowerCase(), newEmail: emailValue, source: "self" },
      });
    }

    await tryAudit({
      actorUserId: auth.userId,
      action: "auth.user.update_self",
      entityType: "user",
      entityId: auth.userId,
      metadata: { fields },
    });

    applyJson(res, 200, {
      success: true,
      user: publicProfileUser({
        ...u,
        phone: u.phone ?? null,
        lastLoginAt: u.lastLoginAt ?? null,
      }),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] profile-update-self", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function changePasswordSelf(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  try {
    const cur = await db
      .select({ passwordHash: authUsers.passwordHash })
      .from(authUsers)
      .where(eq(authUsers.id, auth.userId))
      .limit(1);
    const ph = cur[0]?.passwordHash;
    if (ph == null || ph === "") {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "У учётной записи не задан пароль." });
      return;
    }

    const body = req.body as { currentPassword?: unknown; newPassword?: unknown };
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!currentPassword.trim()) {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите текущий пароль." });
      return;
    }
    const np = newPassword.trim();
    const cp = currentPassword.trim();
    if (np.length < 8 || np.length > 200) {
      applyJson(res, 400, {
        success: false,
        code: "WEAK_PASSWORD",
        message: "Пароль должен быть не короче 8 символов и отличаться от email и текущего пароля.",
      });
      return;
    }
    if (np === cp) {
      applyJson(res, 400, {
        success: false,
        code: "WEAK_PASSWORD",
        message: "Пароль должен быть не короче 8 символов и отличаться от email и текущего пароля.",
      });
      return;
    }
    const em = auth.email.trim().toLowerCase();
    if (np.toLowerCase() === em) {
      applyJson(res, 400, {
        success: false,
        code: "WEAK_PASSWORD",
        message: "Пароль должен быть не короче 8 символов и отличаться от email и текущего пароля.",
      });
      return;
    }

    const ok = await verifyPassword(cp, ph);
    if (!ok) {
      applyJson(res, 400, { success: false, code: "INVALID_PASSWORD", message: "Текущий пароль неверен." });
      return;
    }

    const sessionHash = cookieRefreshHash(req);
    if (!sessionHash) {
      applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    const rev = await db
      .update(sessions)
      .set({ revokedAt: sql`NOW()` })
      .where(
        and(eq(sessions.userId, auth.userId), isNull(sessions.revokedAt), ne(sessions.refreshTokenHash, sessionHash)),
      )
      .returning({ id: sessions.id });
    const otherSessionsRevoked = rev.length;

    const newHash = await hashPassword(np);
    await db
      .update(authUsers)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
        updatedAt: sql`NOW()`,
      })
      .where(eq(authUsers.id, auth.userId));

    await tryAudit({
      actorUserId: auth.userId,
      action: "auth.user.change_password_self",
      entityType: "user",
      entityId: auth.userId,
      metadata: { otherSessionsRevoked },
    });

    applyJson(res, 200, { success: true, otherSessionsRevoked });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] profile-change-password", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
