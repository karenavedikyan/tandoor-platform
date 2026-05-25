/**
 * `/api/admin/users-*` для Express (`npm run dev`).
 * Контракт совпадает с Vercel `api/admin/[action].ts`.
 */

import type { Request, Response } from "express";
import { and, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import type { UserRole, UserStatus } from "@shared/auth";
import { BUSINESS_ROLES } from "@shared/auth";
import { canCreatePasswordResetLink, roleHasPermission } from "@shared/auth-rbac";
import { auditLog, authUsers, passwordResetLinks, sessions } from "@shared/auth-schema";
import type { AuthUserSnapshot } from "../auth/auth-user-snapshot";
import { getAuthDb } from "../auth/db";
import { hashPassword } from "../auth/password-hash";
import { createHash, randomBytes } from "node:crypto";

const JSON_CT = "application/json; charset=utf-8";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function applyJson(res: Response, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function publicAdminUser(r: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  telegramUserId?: number | null;
}): Record<string, unknown> {
  return {
    id: r.id,
    email: r.email,
    fullName: r.fullName,
    role: r.role,
    status: r.status,
    mustChangePassword: r.mustChangePassword,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
    telegramUserId: r.telegramUserId ?? null,
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

function sanitizeLikeFragment(raw: string): string {
  return raw.replace(/[%_\\]/g, "");
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active" || !roleHasPermission(auth.role, "users.list")) {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const roleRaw = typeof req.query.role === "string" ? req.query.role.trim() : "";
  const statusRaw = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const limitRaw = typeof req.query.limit === "string" ? req.query.limit.trim() : "";
  const offsetRaw = typeof req.query.offset === "string" ? req.query.offset.trim() : "";

  let limit = Number.parseInt(limitRaw || "50", 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  let offset = Number.parseInt(offsetRaw || "0", 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const conditions = [];
  const qFrag = sanitizeLikeFragment(qRaw);
  if (qFrag) {
    const pattern = `%${qFrag}%`;
    conditions.push(or(ilike(authUsers.email, pattern), ilike(authUsers.fullName, pattern)));
  }
  if (roleRaw && (BUSINESS_ROLES as readonly string[]).includes(roleRaw)) {
    conditions.push(eq(authUsers.role, roleRaw));
  }
  if (statusRaw && (statusRaw === "active" || statusRaw === "disabled" || statusRaw === "invited")) {
    conditions.push(eq(authUsers.status, statusRaw));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const rows = await db
      .select({
        id: authUsers.id,
        email: authUsers.email,
        fullName: authUsers.fullName,
        role: authUsers.role,
        status: authUsers.status,
        mustChangePassword: authUsers.mustChangePassword,
        lastLoginAt: authUsers.lastLoginAt,
        createdAt: authUsers.createdAt,
        telegramUserId: authUsers.telegramUserId,
      })
      .from(authUsers)
      .where(whereClause)
      .orderBy(desc(authUsers.createdAt))
      .limit(limit)
      .offset(offset);

    const cnt = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(authUsers)
      .where(whereClause);
    const total = cnt[0]?.n ?? 0;

    applyJson(res, 200, {
      success: true,
      users: rows.map((r) => publicAdminUser({ ...r, lastLoginAt: r.lastLoginAt ?? null, telegramUserId: r.telegramUserId ?? null })),
      total,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] users-list", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function getUser(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active" || !roleHasPermission(auth.role, "users.read_any")) {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
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
        role: authUsers.role,
        status: authUsers.status,
        mustChangePassword: authUsers.mustChangePassword,
        lastLoginAt: authUsers.lastLoginAt,
        createdAt: authUsers.createdAt,
        telegramUserId: authUsers.telegramUserId,
      })
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);
    const r = rows[0];
    if (!r) {
      applyJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
      return;
    }
    applyJson(res, 200, { success: true, user: publicAdminUser({ ...r, lastLoginAt: r.lastLoginAt ?? null, telegramUserId: r.telegramUserId ?? null }) });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] users-get", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active" || !roleHasPermission(auth.role, "users.update_role")) {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = req.body as { id?: unknown; role?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const roleNew = typeof body.role === "string" ? body.role.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }
  if (!BUSINESS_ROLES.includes(roleNew as UserRole)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Недопустимая роль." });
    return;
  }
  if (id === auth.userId) {
    applyJson(res, 400, { success: false, code: "SELF_MODIFICATION", message: "Нельзя менять собственную роль." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  try {
    const cur = await db
      .select({
        id: authUsers.id,
        role: authUsers.role,
        email: authUsers.email,
        fullName: authUsers.fullName,
        status: authUsers.status,
        mustChangePassword: authUsers.mustChangePassword,
        lastLoginAt: authUsers.lastLoginAt,
        createdAt: authUsers.createdAt,
      })
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);
    const row = cur[0];
    if (!row) {
      applyJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
      return;
    }
    if (row.role === "admin") {
      applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Роль admin нельзя изменить через UI." });
      return;
    }
    const oldRole = row.role;
    const updated = await db
      .update(authUsers)
      .set({ role: roleNew as UserRole, updatedAt: sql`NOW()` })
      .where(eq(authUsers.id, id))
      .returning({
        id: authUsers.id,
        email: authUsers.email,
        fullName: authUsers.fullName,
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
    await tryAudit({
      actorUserId: auth.userId,
      action: "auth.user.update_role",
      entityType: "user",
      entityId: id,
      metadata: { targetUserId: id, oldRole, newRole: roleNew },
    });
    applyJson(res, 200, { success: true, user: publicAdminUser({ ...u, lastLoginAt: u.lastLoginAt ?? null }) });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] users-update-role", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active" || !roleHasPermission(auth.role, "users.update_status")) {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = req.body as { id?: unknown; status?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const st = typeof body.status === "string" ? body.status.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }
  if (st !== "active" && st !== "disabled") {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Недопустимый статус." });
    return;
  }
  if (id === auth.userId) {
    applyJson(res, 400, { success: false, code: "SELF_MODIFICATION", message: "Нельзя менять собственный статус." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  try {
    const cur = await db
      .select({
        id: authUsers.id,
        role: authUsers.role,
        status: authUsers.status,
        email: authUsers.email,
        fullName: authUsers.fullName,
        mustChangePassword: authUsers.mustChangePassword,
        lastLoginAt: authUsers.lastLoginAt,
        createdAt: authUsers.createdAt,
      })
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);
    const row = cur[0];
    if (!row) {
      applyJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
      return;
    }
    if (row.role === "admin") {
      applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Статус admin нельзя изменить через UI." });
      return;
    }
    const oldStatus = row.status;
    const updated = await db
      .update(authUsers)
      .set({ status: st as UserStatus, updatedAt: sql`NOW()` })
      .where(eq(authUsers.id, id))
      .returning({
        id: authUsers.id,
        email: authUsers.email,
        fullName: authUsers.fullName,
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

    let sessionsRevoked = 0;
    if (st === "disabled") {
      const rev = await db
        .update(sessions)
        .set({ revokedAt: sql`NOW()` })
        .where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id });
      sessionsRevoked = rev.length;
    }

    await tryAudit({
      actorUserId: auth.userId,
      action: "auth.user.update_status",
      entityType: "user",
      entityId: id,
      metadata: { targetUserId: id, oldStatus, newStatus: st, sessionsRevoked },
    });
    applyJson(res, 200, { success: true, user: publicAdminUser({ ...u, lastLoginAt: u.lastLoginAt ?? null }) });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] users-update-status", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function resetUserPassword(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active" || !roleHasPermission(auth.role, "users.reset_password")) {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = req.body as { id?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }
  if (id === auth.userId) {
    applyJson(res, 400, { success: false, code: "SELF_MODIFICATION", message: "Нельзя сбросить пароль самому себе через этот интерфейс." });
    return;
  }
  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  try {
    const cur = await db
      .select({
        id: authUsers.id,
        role: authUsers.role,
        email: authUsers.email,
        fullName: authUsers.fullName,
        status: authUsers.status,
        mustChangePassword: authUsers.mustChangePassword,
        lastLoginAt: authUsers.lastLoginAt,
        createdAt: authUsers.createdAt,
      })
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);
    const row = cur[0];
    if (!row) {
      applyJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
      return;
    }
    if (row.role === "admin") {
      applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Пароль admin нельзя сбросить через UI." });
      return;
    }

    const tempPassword = randomBytes(12).toString("base64url").slice(0, 14);
    const passwordHash = await hashPassword(tempPassword);

    const rev = await db
      .update(sessions)
      .set({ revokedAt: sql`NOW()` })
      .where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    const sessionsRevoked = rev.length;

    const updated = await db
      .update(authUsers)
      .set({
        passwordHash,
        mustChangePassword: true,
        updatedAt: sql`NOW()`,
      })
      .where(eq(authUsers.id, id))
      .returning({
        id: authUsers.id,
        email: authUsers.email,
        fullName: authUsers.fullName,
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

    await tryAudit({
      actorUserId: auth.userId,
      action: "auth.user.reset_password",
      entityType: "user",
      entityId: id,
      metadata: { targetUserId: id, sessionsRevoked },
    });

    applyJson(res, 200, {
      success: true,
      tempPassword,
      user: publicAdminUser({ ...u, lastLoginAt: u.lastLoginAt ?? null }),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] users-reset-password", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}


const prlRateStore = new Map<string, { count: number; firstAt: number }>();

function prlRateCheck(key: string, max: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const prev = prlRateStore.get(key);
  if (!prev || now - prev.firstAt > windowMs) {
    prlRateStore.set(key, { count: 1, firstAt: now });
    return { ok: true };
  }
  if (prev.count < max) {
    prlRateStore.set(key, { count: prev.count + 1, firstAt: prev.firstAt });
    return { ok: true };
  }
  const retryAfterMs = windowMs - (now - prev.firstAt);
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

function prlRateRecord(key: string, windowMs: number): void {
  const now = Date.now();
  const prev = prlRateStore.get(key);
  if (!prev || now - prev.firstAt > windowMs) {
    prlRateStore.set(key, { count: 1, firstAt: now });
    return;
  }
  prlRateStore.set(key, { count: prev.count + 1, firstAt: prev.firstAt });
}

function pickPublicHost(headers: Record<string, string | string[] | undefined>): string {
  const xf = headers["x-forwarded-host"];
  if (typeof xf === "string" && xf.trim()) return xf.trim().split(",")[0]!.trim();
  if (Array.isArray(xf) && xf[0]?.trim()) return xf[0]!.trim().split(",")[0]!.trim();
  const h = headers.host;
  if (typeof h === "string" && h.trim()) return h.trim();
  if (Array.isArray(h) && h[0]?.trim()) return h[0]!.trim();
  return "localhost";
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function createPasswordResetLink(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = req.body as { userId?: unknown };
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId || !UUID_RE.test(userId)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }
  if (userId === auth.userId) {
    applyJson(res, 400, {
      success: false,
      code: "SELF_RESET_FORBIDDEN",
      message: "Нельзя сгенерировать ссылку для собственного аккаунта.",
    });
    return;
  }

  const rlKey = `prl-create:${auth.userId}`;
  const rl = prlRateCheck(rlKey, 10, 60 * 1000);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    applyJson(res, 429, { success: false, code: "RATE_LIMITED", message: "Слишком много запросов на создание ссылки. Повторите позже." });
    return;
  }

  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  try {
    const cur = await db
      .select({
        id: authUsers.id,
        role: authUsers.role,
        status: authUsers.status,
      })
      .from(authUsers)
      .where(eq(authUsers.id, userId))
      .limit(1);
    const row = cur[0];
    if (!row) {
      applyJson(res, 404, { success: false, code: "USER_NOT_FOUND", message: "Пользователь не найден." });
      return;
    }
    if (row.status !== "active") {
      applyJson(res, 400, { success: false, code: "USER_INACTIVE", message: "Пользователь неактивен." });
      return;
    }
    if (!canCreatePasswordResetLink(auth.role, row.role as UserRole)) {
      applyJson(res, 403, { success: false, code: "PERMISSION_DENIED", message: "Недостаточно прав." });
      return;
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256Hex(token);

    await db
      .update(passwordResetLinks)
      .set({ usedAt: sql`NOW()`, usedIp: "superseded" })
      .where(and(eq(passwordResetLinks.userId, userId), isNull(passwordResetLinks.usedAt)));

    const ins = await db
      .insert(passwordResetLinks)
      .values({
        userId,
        tokenHash,
        createdBy: auth.userId,
        expiresAt: sql`(NOW() + interval '24 hours')::timestamptz`,
      })
      .returning({ id: passwordResetLinks.id, expiresAt: passwordResetLinks.expiresAt });
    const linkRow = ins[0];
    if (!linkRow) {
      applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      return;
    }

    await tryAudit({
      actorUserId: auth.userId,
      action: "auth.reset_link.created",
      entityType: "user",
      entityId: userId,
      metadata: { linkId: linkRow.id, expiresAt: linkRow.expiresAt, targetRole: row.role },
    });

    prlRateRecord(rlKey, 60 * 1000);

    const host = pickPublicHost(req.headers as Record<string, string | string[] | undefined>);
    const link = `https://${host}/reset?token=${encodeURIComponent(token)}`;

    applyJson(res, 200, {
      success: true,
      token,
      link,
      expiresAt: linkRow.expiresAt,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] password-reset-link-create", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}


export async function updateUserTelegram(req: Request, res: Response): Promise<void> {
  const auth = req.auth as AuthUserSnapshot | undefined;
  if (!auth) {
    applyJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (auth.status !== "active" || auth.role !== "admin") {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(auth.role, "users.update_role")) {
    applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const body = req.body as { id?: unknown; telegramUserId?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(body, "telegramUserId")) {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Не указано поле telegramUserId." });
    return;
  }

  const rawTg = body.telegramUserId;
  let nextTg: number | null = null;
  if (rawTg === null) {
    nextTg = null;
  } else if (typeof rawTg === "number" && Number.isFinite(rawTg) && rawTg > 0) {
    nextTg = Math.trunc(rawTg);
  } else if (typeof rawTg === "string" && rawTg.trim()) {
    const n = Number(rawTg.trim());
    if (!Number.isFinite(n) || n <= 0) {
      applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный Telegram user-id." });
      return;
    }
    nextTg = Math.trunc(n);
  } else {
    applyJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный Telegram user-id." });
    return;
  }

  const db = getAuthDb();
  if (!db) {
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  try {
    const cur = await db
      .select({
        id: authUsers.id,
        role: authUsers.role,
        telegramUserId: authUsers.telegramUserId,
      })
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);
    const row = cur[0];
    if (!row) {
      applyJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
      return;
    }
    if (row.role !== "admin") {
      applyJson(res, 403, { success: false, code: "FORBIDDEN", message: "Telegram user-id можно задавать только для роли admin." });
      return;
    }

    const oldId = row.telegramUserId ?? null;

    if (nextTg != null) {
      const taken = await db
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(and(eq(authUsers.telegramUserId, nextTg), ne(authUsers.id, id)))
        .limit(1);
      if (taken[0]) {
        applyJson(res, 409, {
          success: false,
          code: "TG_USER_ID_TAKEN",
          message: "Этот Telegram user-id уже привязан к другому пользователю.",
        });
        return;
      }
    }

    const updated = await db
      .update(authUsers)
      .set({
        telegramUserId: nextTg,
        updatedAt: sql`NOW()`,
      })
      .where(eq(authUsers.id, id))
      .returning({
        id: authUsers.id,
        email: authUsers.email,
        fullName: authUsers.fullName,
        role: authUsers.role,
        status: authUsers.status,
        mustChangePassword: authUsers.mustChangePassword,
        lastLoginAt: authUsers.lastLoginAt,
        createdAt: authUsers.createdAt,
        telegramUserId: authUsers.telegramUserId,
      });

    const u = updated[0];
    if (!u) {
      applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      return;
    }

    await tryAudit({
      actorUserId: auth.userId,
      action: "user.telegram_link.changed",
      entityType: "user",
      entityId: id,
      metadata: { oldId, newId: nextTg },
    });

    applyJson(res, 200, { success: true, user: publicAdminUser({ ...u, lastLoginAt: u.lastLoginAt ?? null }) });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] users-update", m.slice(0, 200));
    applyJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

