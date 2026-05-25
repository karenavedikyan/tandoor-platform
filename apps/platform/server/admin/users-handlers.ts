/**
 * `/api/admin/users-*` для Express (`npm run dev`).
 * Контракт совпадает с Vercel `api/admin/[action].ts`.
 */

import type { Request, Response } from "express";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { UserRole, UserStatus } from "@shared/auth";
import { BUSINESS_ROLES } from "@shared/auth";
import { roleHasPermission } from "@shared/auth-rbac";
import { auditLog, authUsers, sessions } from "@shared/auth-schema";
import type { AuthUserSnapshot } from "../auth/auth-user-snapshot";
import { getAuthDb } from "../auth/db";
import { hashPassword } from "../auth/password-hash";
import { randomBytes } from "node:crypto";

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
      users: rows.map((r) => publicAdminUser({ ...r, lastLoginAt: r.lastLoginAt ?? null })),
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
      })
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);
    const r = rows[0];
    if (!r) {
      applyJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
      return;
    }
    applyJson(res, 200, { success: true, user: publicAdminUser({ ...r, lastLoginAt: r.lastLoginAt ?? null }) });
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
