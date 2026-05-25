/**
 * Vercel Serverless: `/api/admin/:action` (users-list | … | audit-list | sessions-*-self | profile-get-self | profile-update-self | profile-change-password). In-memory rate limits (Hobby): см. handleUsersResetPassword / handleProfileChangePassword.
 *
 * Self-contained: только `@vercel/node`, `@neondatabase/serverless`, `bcryptjs`, `node:crypto`.
 * Контракт совпадает с `server/admin/users-handlers.ts`, `server/admin-routes.ts`, `server/profile-routes.ts`.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

type NeonHttp = ReturnType<typeof neon>;
interface PoolLike {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
}
function makePoolFromNeon(sql: NeonHttp): PoolLike {
  return {
    async query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }> {
      const callable = sql as unknown as (s: string, p?: unknown[]) => Promise<unknown>;
      const rows = (await callable(text, params ?? [])) as T[];
      return { rows };
    },
  };
}

type UserRole =
  | "director"
  | "rop"
  | "regional_manager"
  | "manager"
  | "marketer"
  | "analyst"
  | "admin";

type UserStatus = "invited" | "active" | "disabled";

const BUSINESS_ROLES: UserRole[] = ["director", "rop", "regional_manager", "manager", "marketer", "analyst"];

// SYNC: shared/auth-rbac.ts — keep this matrix in sync (self-contained rule, PR #224/#226) + audit.read, sessions.read_self, sessions.revoke_self (Prompt 09).

type Permission =
  | "invitations.create"
  | "invitations.list_own"
  | "invitations.revoke_own"
  | "invitations.revoke_any"
  | "users.list"
  | "users.read_any"
  | "users.update_role"
  | "users.update_status"
  | "users.reset_password"
  | "profile.read_self"
  | "profile.update_self"
  | "audit.read"
  | "sessions.read_self"
  | "sessions.revoke_self";

const PERMISSIONS_BY_ROLE: Record<UserRole, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    "invitations.create",
    "invitations.list_own",
    "invitations.revoke_own",
    "invitations.revoke_any",
    "users.list",
    "users.read_any",
    "users.update_role",
    "users.update_status",
    "users.reset_password",
    "profile.read_self",
    "profile.update_self",
    "audit.read",
    "sessions.read_self",
    "sessions.revoke_self",
  ]),
  director: new Set<Permission>([
    "invitations.create",
    "invitations.list_own",
    "invitations.revoke_own",
    "users.list",
    "users.read_any",
    "profile.read_self",
    "profile.update_self",
    "audit.read",
    "sessions.read_self",
    "sessions.revoke_self",
  ]),
  rop: new Set<Permission>([
    "invitations.create",
    "invitations.list_own",
    "invitations.revoke_own",
    "users.list",
    "profile.read_self",
    "profile.update_self",
    "sessions.read_self",
    "sessions.revoke_self",
  ]),
  regional_manager: new Set<Permission>([
    "invitations.create",
    "invitations.list_own",
    "invitations.revoke_own",
    "profile.read_self",
    "profile.update_self",
    "sessions.read_self",
    "sessions.revoke_self",
  ]),
  manager: new Set<Permission>(["profile.read_self", "profile.update_self", "sessions.read_self", "sessions.revoke_self"]),
  marketer: new Set<Permission>(["profile.read_self", "profile.update_self", "sessions.read_self", "sessions.revoke_self"]),
  analyst: new Set<Permission>(["profile.read_self", "profile.update_self", "sessions.read_self", "sessions.revoke_self"]),
};

function roleHasPermission(role: UserRole, perm: Permission): boolean {
  const set = PERMISSIONS_BY_ROLE[role];
  return !!set && set.has(perm);
}

const JSON_CT = "application/json; charset=utf-8";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTH_COOKIE = "tandoor_auth_sess";

let cachedPool: PoolLike | null | undefined;

function resolveDatabaseUrl(): string | null {
  const a = process.env.DATABASE_URL?.trim();
  if (a) return a;
  const b = process.env.POSTGRES_URL?.trim();
  if (b) return b;
  const c = process.env.NEON_DATABASE_URL?.trim();
  if (c) return c;
  return null;
}

function getPool(): PoolLike | null {
  if (cachedPool !== undefined) return cachedPool;
  const url = resolveDatabaseUrl();
  if (!url) {
    cachedPool = null;
    return null;
  }
  cachedPool = makePoolFromNeon(neon(url));
  return cachedPool;
}

function vercelHeaders(req: VercelRequest): Record<string, string | string[] | undefined> {
  return (req.headers ?? {}) as Record<string, string | string[] | undefined>;
}

function getClientIp(headers: Record<string, string | string[] | undefined>): string | null {
  const xff = headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(xff) && xff[0]?.trim()) {
    const first = xff[0]!.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = headers["x-real-ip"];
  if (typeof xri === "string" && xri.trim()) return xri.trim();
  if (Array.isArray(xri) && xri[0]?.trim()) return xri[0]!.trim();
  return null;
}

type RateBucket = { count: number; firstAttemptAt: number; windowMs: number };
const adminRateStore = new Map<string, RateBucket>();

function ratePrune(now: number): void {
  for (const [k, b] of Array.from(adminRateStore.entries())) {
    if (now - b.firstAttemptAt > b.windowMs) adminRateStore.delete(k);
  }
}

function rateCheck(key: string, maxFail: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  ratePrune(now);
  const b = adminRateStore.get(key);
  if (!b) return { ok: true };
  const elapsed = now - b.firstAttemptAt;
  if (elapsed > b.windowMs || b.windowMs !== windowMs) {
    adminRateStore.delete(key);
    return { ok: true };
  }
  if (b.count < maxFail) return { ok: true };
  const retryAfterMs = b.windowMs - elapsed;
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

function rateRecord(key: string, windowMs: number): void {
  const now = Date.now();
  ratePrune(now);
  const prev = adminRateStore.get(key);
  if (!prev || now - prev.firstAttemptAt > prev.windowMs || prev.windowMs !== windowMs) {
    adminRateStore.set(key, { count: 1, firstAttemptAt: now, windowMs });
    return;
  }
  adminRateStore.set(key, { count: prev.count + 1, firstAttemptAt: prev.firstAttemptAt, windowMs });
}

function rateClear(key: string): void {
  adminRateStore.delete(key);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256Buffer(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function timingSafeEqualHex(storedHex: string, plainToken: string): boolean {
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHex, "hex");
  } catch {
    return false;
  }
  const computed = sha256Buffer(plainToken);
  if (stored.length !== computed.length) return false;
  return timingSafeEqual(stored, computed);
}

function parseAuthRefreshToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader?.trim()) return null;
  for (const p of cookieHeader.split(";")) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k !== AUTH_COOKIE) continue;
    try {
      const raw = decodeURIComponent(p.slice(idx + 1).trim());
      return raw || null;
    } catch {
      return p.slice(idx + 1).trim() || null;
    }
  }
  return null;
}

type DbUserRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
};

async function tryAudit(
  pool: PoolLike,
  input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb)`,
      [input.actorUserId, input.action, input.entityType, input.entityId, JSON.stringify(input.metadata)],
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] audit", input.action, m.slice(0, 200));
  }
}

function adminPublicUserFromRow(r: {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
}): Record<string, unknown> {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    phone: r.phone,
    role: r.role as UserRole,
    status: r.status as UserStatus,
    mustChangePassword: r.must_change_password,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
  };
}

async function resolveCurrentUser(
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<DbUserRow | null> {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) return null;
  const hashHex = sha256Hex(token);
  const res = await pool.query<DbUserRow & { refresh_token_hash: string }>(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.status, u.must_change_password, u.last_login_at, u.created_at,
            s.refresh_token_hash
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [hashHex],
  );
  const row = res.rows[0];
  if (!row || !timingSafeEqualHex(row.refresh_token_hash, token)) return null;
  const { refresh_token_hash: _h, ...u } = row;
  return u;
}

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function sendJsonRateLimited(res: VercelResponse, retryAfterSec: number, message: string): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Retry-After", String(retryAfterSec));
  res.status(429).json({ success: false, code: "RATE_LIMITED", message });
}

function sanitizeLikeFragment(raw: string): string {
  return raw.replace(/[%_\\]/g, "");
}

async function handleUsersList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "users.list")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const q = req.query ?? {};
  const qRaw = typeof q.q === "string" ? q.q.trim() : "";
  const roleRaw = typeof q.role === "string" ? q.role.trim() : "";
  const statusRaw = typeof q.status === "string" ? q.status.trim() : "";
  const limitRaw = typeof q.limit === "string" ? q.limit.trim() : "";
  const offsetRaw = typeof q.offset === "string" ? q.offset.trim() : "";

  let limit = Number.parseInt(limitRaw || "50", 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  let offset = Number.parseInt(offsetRaw || "0", 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const conds: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  const qFrag = sanitizeLikeFragment(qRaw);
  if (qFrag) {
    conds.push(`(email ILIKE $${pi} OR full_name ILIKE $${pi})`);
    params.push(`%${qFrag}%`);
    pi++;
  }
  if (roleRaw && BUSINESS_ROLES.includes(roleRaw as UserRole)) {
    conds.push(`role = $${pi}`);
    params.push(roleRaw);
    pi++;
  }
  if (statusRaw === "active" || statusRaw === "disabled" || statusRaw === "invited") {
    conds.push(`status = $${pi}`);
    params.push(statusRaw);
    pi++;
  }

  const whereSql = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const countRes = await pool.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM users ${whereSql}`, params);
  const total = countRes.rows[0]?.n ?? 0;

  const limitPh = pi;
  const offsetPh = pi + 1;
  const listSql = `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at
     FROM users ${whereSql} ORDER BY created_at DESC LIMIT $${limitPh} OFFSET $${offsetPh}`;
  const listRes = await pool.query<DbUserRow>(listSql, [...params, limit, offset]);

  sendJson(res, 200, {
    success: true,
    users: listRes.rows.map((r) => adminPublicUserFromRow(r)),
    total,
  });
}

async function handleUsersGet(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "users.read_any")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const q = req.query ?? {};
  const id = typeof q.id === "string" ? q.id.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }

  const ures = await pool.query<DbUserRow>(
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at
     FROM users WHERE id = $1::uuid LIMIT 1`,
    [id],
  );
  const row = ures.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
    return;
  }
  sendJson(res, 200, { success: true, user: adminPublicUserFromRow(row) });
}

async function handleUsersUpdateRole(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "users.update_role")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const body = req.body as { id?: unknown; role?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const roleNew = typeof body.role === "string" ? body.role.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }
  if (!BUSINESS_ROLES.includes(roleNew as UserRole)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Недопустимая роль." });
    return;
  }
  if (id === me.id) {
    sendJson(res, 400, { success: false, code: "SELF_MODIFICATION", message: "Нельзя менять собственную роль." });
    return;
  }

  const cur = await pool.query<DbUserRow>(
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at FROM users WHERE id = $1::uuid LIMIT 1`,
    [id],
  );
  const row = cur.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
    return;
  }
  if (row.role === "admin") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Роль admin нельзя изменить через UI." });
    return;
  }

  const oldRole = row.role;
  const up = await pool.query<DbUserRow>(
    `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2::uuid
     RETURNING id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at`,
    [roleNew, id],
  );
  const u = up.rows[0];
  if (!u) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "auth.user.update_role",
    entityType: "user",
    entityId: id,
    metadata: { targetUserId: id, oldRole, newRole: roleNew },
  });

  sendJson(res, 200, { success: true, user: adminPublicUserFromRow(u) });
}

async function handleUsersUpdateStatus(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "users.update_status")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const body = req.body as { id?: unknown; status?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const st = typeof body.status === "string" ? body.status.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }
  if (st !== "active" && st !== "disabled") {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Недопустимый статус." });
    return;
  }
  if (id === me.id) {
    sendJson(res, 400, { success: false, code: "SELF_MODIFICATION", message: "Нельзя менять собственный статус." });
    return;
  }

  const cur = await pool.query<DbUserRow>(
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at FROM users WHERE id = $1::uuid LIMIT 1`,
    [id],
  );
  const row = cur.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
    return;
  }
  if (row.role === "admin") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Статус admin нельзя изменить через UI." });
    return;
  }

  const oldStatus = row.status;
  const up = await pool.query<DbUserRow>(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2::uuid
     RETURNING id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at`,
    [st, id],
  );
  const u = up.rows[0];
  if (!u) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  let sessionsRevoked = 0;
  if (st === "disabled") {
    const rev = await pool.query<{ id: string }>(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1::uuid AND revoked_at IS NULL RETURNING id`,
      [id],
    );
    sessionsRevoked = rev.rows.length;
  }

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "auth.user.update_status",
    entityType: "user",
    entityId: id,
    metadata: { targetUserId: id, oldStatus, newStatus: st, sessionsRevoked },
  });

  sendJson(res, 200, { success: true, user: adminPublicUserFromRow(u) });
}

async function handleUsersResetPassword(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "users.reset_password")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const body = req.body as { id?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }
  if (id === me.id) {
    sendJson(res, 400, {
      success: false,
      code: "SELF_MODIFICATION",
      message: "Нельзя сбросить пароль самому себе через этот интерфейс.",
    });
    return;
  }

  const resetRateKey = `reset:${me.id}`;
  const resetRl = rateCheck(resetRateKey, 20, 60 * 60 * 1000);
  if (!resetRl.ok) {
    sendJsonRateLimited(res, resetRl.retryAfterSec, "Слишком много операций сброса пароля. Повторите позже.");
    return;
  }

  const cur = await pool.query<DbUserRow>(
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at FROM users WHERE id = $1::uuid LIMIT 1`,
    [id],
  );
  const row = cur.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
    return;
  }
  if (row.role === "admin") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Пароль admin нельзя сбросить через UI." });
    return;
  }

  const tempPassword = randomBytes(12).toString("base64url").slice(0, 14);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const rev = await pool.query<{ id: string }>(
    `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1::uuid AND revoked_at IS NULL RETURNING id`,
    [id],
  );
  const sessionsRevoked = rev.rows.length;

  const up = await pool.query<DbUserRow>(
    `UPDATE users SET password_hash = $1, must_change_password = true, updated_at = NOW() WHERE id = $2::uuid
     RETURNING id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at`,
    [passwordHash, id],
  );
  const u = up.rows[0];
  if (!u) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "auth.user.reset_password",
    entityType: "user",
    entityId: id,
    metadata: { targetUserId: id, sessionsRevoked },
  });

  rateRecord(resetRateKey, 60 * 60 * 1000);

  sendJson(res, 200, {
    success: true,
    tempPassword,
    user: adminPublicUserFromRow(u),
  });
}



function currentRefreshTokenHashHex(headers: Record<string, string | string[] | undefined>): string | null {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) return null;
  return sha256Hex(token);
}

const PHONE_SELF_RE = /^[+\d\s\-()]+$/;

async function handleProfileGetSelf(
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "profile.read_self")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const ures = await pool.query<DbUserRow>(
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at
     FROM users WHERE id = $1::uuid LIMIT 1`,
    [me.id],
  );
  const row = ures.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
    return;
  }
  sendJson(res, 200, { success: true, user: adminPublicUserFromRow(row) });
}

async function handleProfileUpdateSelf(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "profile.update_self")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  for (const k of ["email", "role", "status", "password"]) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      sendJson(res, 400, {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Поле недоступно для самостоятельного изменения.",
      });
      return;
    }
  }

  const hasFull = Object.prototype.hasOwnProperty.call(body, "fullName");
  const hasPhone = Object.prototype.hasOwnProperty.call(body, "phone");
  if (!hasFull && !hasPhone) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Не указано ни одно поле для обновления." });
    return;
  }

  let fullNameParam: string | null = null;
  if (hasFull) {
    if (typeof body.fullName !== "string") {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите ФИО (от 2 до 200 символов)." });
      return;
    }
    const t = body.fullName.trim();
    if (t.length < 2 || t.length > 200) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите ФИО (от 2 до 200 символов)." });
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
        if (pt.length < 4 || pt.length > 32 || !PHONE_SELF_RE.test(pt)) {
          sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный телефон." });
          return;
        }
        phoneValue = pt;
      }
    } else {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный телефон." });
      return;
    }
  }

  const up = await pool.query<DbUserRow>(
    `UPDATE users
       SET full_name = COALESCE($1, full_name),
           phone = CASE WHEN $2::boolean THEN $3 ELSE phone END,
           updated_at = NOW()
     WHERE id = $4::uuid
     RETURNING id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at`,
    [fullNameParam, phonePresent, phoneValue ?? null, me.id],
  );
  const u = up.rows[0];
  if (!u) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  const fields: string[] = [];
  if (hasFull) fields.push("fullName");
  if (hasPhone) fields.push("phone");

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "auth.user.update_self",
    entityType: "user",
    entityId: me.id,
    metadata: { fields },
  });

  sendJson(res, 200, { success: true, user: adminPublicUserFromRow(u) });
}

async function handleProfileChangePassword(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "profile.update_self")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const cur = await pool.query<{ password_hash: string | null }>(
    `SELECT password_hash FROM users WHERE id = $1::uuid LIMIT 1`,
    [me.id],
  );
  const ph = cur.rows[0]?.password_hash;
  if (ph == null || ph === "") {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "У учётной записи не задан пароль." });
    return;
  }

  const body = (req.body ?? {}) as { currentPassword?: unknown; newPassword?: unknown };
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword.trim()) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите текущий пароль." });
    return;
  }
  const np = newPassword.trim();
  const cp = currentPassword.trim();
  if (np.length < 8 || np.length > 200) {
    sendJson(res, 400, {
      success: false,
      code: "WEAK_PASSWORD",
      message: "Пароль должен быть не короче 8 символов и отличаться от email и текущего пароля.",
    });
    return;
  }
  if (np === cp) {
    sendJson(res, 400, {
      success: false,
      code: "WEAK_PASSWORD",
      message: "Пароль должен быть не короче 8 символов и отличаться от email и текущего пароля.",
    });
    return;
  }
  const em = me.email.trim().toLowerCase();
  if (np.toLowerCase() === em) {
    sendJson(res, 400, {
      success: false,
      code: "WEAK_PASSWORD",
      message: "Пароль должен быть не короче 8 символов и отличаться от email и текущего пароля.",
    });
    return;
  }

  const ip = getClientIp(headers);
  const pwdKey = `pwd:${ip ?? "unknown"}:${me.id}`;
  const pwdRl = rateCheck(pwdKey, 5, 15 * 60 * 1000);
  if (!pwdRl.ok) {
    sendJsonRateLimited(res, pwdRl.retryAfterSec, "Слишком много попыток смены пароля. Повторите позже.");
    return;
  }

  const ok = await bcrypt.compare(cp, ph);
  if (!ok) {
    rateRecord(pwdKey, 15 * 60 * 1000);
    sendJson(res, 400, { success: false, code: "INVALID_PASSWORD", message: "Текущий пароль неверен." });
    return;
  }

  const newHash = await bcrypt.hash(np, 10);
  const sessionHash = currentRefreshTokenHashHex(headers);
  if (!sessionHash) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }

  const rev = await pool.query<{ id: string }>(
    `UPDATE sessions
       SET revoked_at = NOW()
     WHERE user_id = $1::uuid
       AND revoked_at IS NULL
       AND refresh_token_hash <> $2
     RETURNING id`,
    [me.id, sessionHash],
  );
  const otherSessionsRevoked = rev.rows.length;

  await pool.query(`UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2::uuid`, [
    newHash,
    me.id,
  ]);

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "auth.user.change_password_self",
    entityType: "user",
    entityId: me.id,
    metadata: { otherSessionsRevoked },
  });

  rateClear(pwdKey);

  sendJson(res, 200, { success: true, otherSessionsRevoked });
}

async function handleAuditList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "audit.read")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const q = req.query ?? {};
  const qs = (v: unknown): string | undefined => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0]!.trim();
    return undefined;
  };

  const actor = qs(q.actor);
  const actionLike = qs(q.action);
  const entityType = qs(q.entityType);
  const entityId = qs(q.entityId);
  const fromIso = qs(q.from);
  const toIso = qs(q.to);
  const limitRaw = qs(q.limit);
  const offsetRaw = qs(q.offset);

  if (actor != null && actor !== "" && !UUID_RE.test(actor)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный фильтр по актору." });
    return;
  }

  let fromMs: number | null = null;
  let toMs: number | null = null;
  if (fromIso != null && fromIso !== "") {
    const t = Date.parse(fromIso);
    if (!Number.isFinite(t)) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректная дата «с»." });
      return;
    }
    fromMs = t;
  }
  if (toIso != null && toIso !== "") {
    const t = Date.parse(toIso);
    if (!Number.isFinite(t)) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректная дата «по»." });
      return;
    }
    toMs = t;
  }

  let limit = 100;
  if (limitRaw != null && limitRaw !== "") {
    const n = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 200) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Параметр limit должен быть от 1 до 200." });
      return;
    }
    limit = n;
  }

  let offset = 0;
  if (offsetRaw != null && offsetRaw !== "") {
    const n = Number.parseInt(offsetRaw, 10);
    if (!Number.isFinite(n) || n < 0) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Параметр offset должен быть неотрицательным." });
      return;
    }
    offset = n;
  }

  const whereParts: string[] = [];
  const params: unknown[] = [];
  let pi = 1;
  if (actor != null && actor !== "") {
    whereParts.push(`al.actor_user_id = $${pi}::uuid`);
    params.push(actor);
    pi += 1;
  }
  if (actionLike != null && actionLike !== "") {
    whereParts.push(`al.action ILIKE $${pi}`);
    params.push(`%${sanitizeLikeFragment(actionLike)}%`);
    pi += 1;
  }
  if (entityType != null && entityType !== "") {
    whereParts.push(`al.entity_type = $${pi}`);
    params.push(entityType);
    pi += 1;
  }
  if (entityId != null && entityId !== "") {
    whereParts.push(`al.entity_id = $${pi}`);
    params.push(entityId);
    pi += 1;
  }
  if (fromMs != null) {
    whereParts.push(`al.created_at >= $${pi}::timestamptz`);
    params.push(new Date(fromMs).toISOString());
    pi += 1;
  }
  if (toMs != null) {
    whereParts.push(`al.created_at <= $${pi}::timestamptz`);
    params.push(new Date(toMs).toISOString());
    pi += 1;
  }

  const whereSql = whereParts.length ? whereParts.join(" AND ") : "TRUE";

  const countSql = `SELECT COUNT(*)::int AS n FROM audit_log al WHERE ${whereSql}`;
  const countRes = await pool.query<{ n: number }>(countSql, params);
  const total = countRes.rows[0]?.n ?? 0;

  const listSql = `
    SELECT al.id, al.actor_user_id, al.action, al.entity_type, al.entity_id, al.metadata, al.created_at,
           u.email AS actor_email, u.full_name AS actor_full_name
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.actor_user_id
     WHERE ${whereSql}
     ORDER BY al.created_at DESC
     LIMIT $${pi} OFFSET $${pi + 1}`;
  const listParams = [...params, limit, offset];
  const rows = await pool.query<{
    id: string;
    actor_user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    metadata: unknown;
    created_at: string;
    actor_email: string | null;
    actor_full_name: string | null;
  }>(listSql, listParams);

  const items = rows.rows.map((r) => {
    let metadata: Record<string, unknown> | null = null;
    if (r.metadata != null && typeof r.metadata === "object" && !Array.isArray(r.metadata)) {
      metadata = r.metadata as Record<string, unknown>;
    } else if (typeof r.metadata === "string") {
      try {
        const p = JSON.parse(r.metadata) as unknown;
        if (p && typeof p === "object" && !Array.isArray(p)) metadata = p as Record<string, unknown>;
      } catch {
        metadata = null;
      }
    }
    const actorOut =
      r.actor_user_id != null && r.actor_email
        ? { id: r.actor_user_id, email: r.actor_email, fullName: r.actor_full_name }
        : null;
    return {
      id: r.id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      actor: actorOut,
      metadata,
      createdAt: r.created_at,
    };
  });

  sendJson(res, 200, { success: true, total, items });
}

async function handleSessionsListSelf(
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "sessions.read_self")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);

  const rows = await pool.query<{
    id: string;
    user_agent: string | null;
    ip: string | null;
    expires_at: string;
    refresh_token_hash: string;
  }>(
    `SELECT id, user_agent, ip, expires_at, refresh_token_hash
       FROM sessions
      WHERE user_id = $1::uuid AND revoked_at IS NULL AND expires_at > NOW()
      ORDER BY expires_at DESC`,
    [me.id],
  );

  const sessions = rows.rows.map((r) => ({
    id: r.id,
    userAgent: r.user_agent,
    ip: r.ip,
    expiresAt: r.expires_at,
    current: !!(token && timingSafeEqualHex(r.refresh_token_hash, token)),
  }));

  sendJson(res, 200, { success: true, sessions });
}

async function handleSessionsRevokeSelf(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "sessions.revoke_self")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const body = (req.body ?? {}) as { id?: unknown };
  const sid = typeof body.id === "string" ? body.id.trim() : "";
  if (!sid || !UUID_RE.test(sid)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор сессии." });
    return;
  }

  const curTok = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!curTok) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }

  const sel = await pool.query<{ id: string; refresh_token_hash: string }>(
    `SELECT id, refresh_token_hash FROM sessions WHERE id = $1::uuid AND user_id = $2::uuid AND revoked_at IS NULL LIMIT 1`,
    [sid, me.id],
  );
  const row = sel.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Сессия не найдена." });
    return;
  }
  if (timingSafeEqualHex(row.refresh_token_hash, curTok)) {
    sendJson(res, 400, {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Текущую сессию нельзя отозвать здесь, используйте выход.",
    });
    return;
  }

  await pool.query(`UPDATE sessions SET revoked_at = NOW() WHERE id = $1::uuid`, [sid]);

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "auth.session.revoke_self",
    entityType: "session",
    entityId: sid,
    metadata: {},
  });

  sendJson(res, 200, { success: true });
}

async function handleSessionsRevokeOthersSelf(
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "sessions.revoke_self")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const curTok = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!curTok) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  const curHash = sha256Hex(curTok);

  const rev = await pool.query<{ id: string }>(
    `UPDATE sessions SET revoked_at = NOW()
      WHERE user_id = $1::uuid AND revoked_at IS NULL AND refresh_token_hash <> $2
      RETURNING id`,
    [me.id, curHash],
  );
  const revoked = rev.rows.length;

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "auth.session.revoke_others_self",
    entityType: "user",
    entityId: me.id,
    metadata: { revoked },
  });

  sendJson(res, 200, { success: true, revoked });
}

function pickAction(req: VercelRequest): string {
  const a = req.query?.action;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && typeof a[0] === "string") return a[0]!.trim();
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = pickAction(req);
  const headers = vercelHeaders(req);
  try {
    const pool = getPool();
    if (!pool) {
      sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      return;
    }

    if (action === "users-list" && req.method === "GET") {
      await handleUsersList(req, res, pool, headers);
      return;
    }
    if (action === "users-get" && req.method === "GET") {
      await handleUsersGet(req, res, pool, headers);
      return;
    }
    if (action === "users-update-role" && req.method === "POST") {
      await handleUsersUpdateRole(req, res, pool, headers);
      return;
    }
    if (action === "users-update-status" && req.method === "POST") {
      await handleUsersUpdateStatus(req, res, pool, headers);
      return;
    }
    if (action === "users-reset-password" && req.method === "POST") {
      await handleUsersResetPassword(req, res, pool, headers);
      return;
    }
    if (action === "audit-list" && req.method === "GET") {
      await handleAuditList(req, res, pool, headers);
      return;
    }
    if (action === "sessions-list-self" && req.method === "GET") {
      await handleSessionsListSelf(res, pool, headers);
      return;
    }
    if (action === "sessions-revoke-self" && req.method === "POST") {
      await handleSessionsRevokeSelf(req, res, pool, headers);
      return;
    }
    if (action === "sessions-revoke-others-self" && req.method === "POST") {
      await handleSessionsRevokeOthersSelf(res, pool, headers);
      return;
    }
    if (action === "profile-get-self" && req.method === "GET") {
      await handleProfileGetSelf(res, pool, headers);
      return;
    }
    if (action === "profile-update-self" && req.method === "POST") {
      await handleProfileUpdateSelf(req, res, pool, headers);
      return;
    }
    if (action === "profile-change-password" && req.method === "POST") {
      await handleProfileChangePassword(req, res, pool, headers);
      return;
    }

    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный маршрут admin API.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin]", action, m.slice(0, 200));
    try {
      if (!res.headersSent && !res.writableEnded) {
        sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    } catch {
      /* ignore */
    }
  }
}
