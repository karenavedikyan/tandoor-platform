/**
 * Vercel Serverless: `/api/admin/:action` (users-list | … | audit-list | sessions-*-self | profile-get-self | profile-update-self | profile-change-password). In-memory rate limits (Hobby) для отдельных admin-операций: см. handleUsersResetPassword / handleProfileChangePassword. Лимит логина перенесён в таблицу auth_login_failures (см. docs/auth.md).
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

/** SYNC: shared/auth-rbac.ts — canCreatePasswordResetLink */
function canCreatePasswordResetLink(actor: UserRole, target: UserRole): boolean {
  if (actor === "admin") return target !== "admin";
  if (actor === "director") return target !== "admin";
  if (actor === "rop") return target === "regional_manager" || target === "manager";
  return false;
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

function enforceCsrfOrigin(req: VercelRequest): boolean {
  const allowed = new Set<string>(["https://tandoor-platform.vercel.app"]);
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:5173");
    allowed.add("http://localhost:3000");
  }
  const h = req.headers ?? {};
  const originRaw =
    (typeof h.origin === "string" ? h.origin : undefined) ??
    (typeof h.referer === "string" ? h.referer : undefined);
  if (!originRaw) return true;
  try {
    const u = new URL(originRaw);
    return allowed.has(u.origin);
  } catch {
    return false;
  }
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

const tgRecoveryLastIssued = new Map<number, number>();

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function readRecoverySecretHeader(headers: Record<string, string | string[] | undefined>): string | null {
  const a = headers["x-recovery-secret"];
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && a[0]?.trim()) return a[0]!.trim();
  const b = headers["x-telegram-bot-api-secret-token"];
  if (typeof b === "string" && b.trim()) return b.trim();
  if (Array.isArray(b) && b[0]?.trim()) return b[0]!.trim();
  return null;
}

function parseTelegramWhitelist(): Set<number> {
  const raw = process.env.TG_RECOVERY_WHITELIST?.trim();
  if (!raw) return new Set();
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const x = part.trim();
    if (!x) continue;
    const n = Number(x);
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
}

function pickPublicAppOrigin(headers: Record<string, string | string[] | undefined>): string {
  const envUrl = process.env.PUBLIC_APP_URL?.trim();
  if (envUrl) {
    try {
      const normalized = envUrl.includes("://") ? envUrl : `https://${envUrl}`;
      const u = new URL(normalized);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  return `https://${pickPublicHost(headers)}`;
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
  telegram_user_id: string | null;
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
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [input.actorUserId, input.action, input.entityType, input.entityId, JSON.stringify(input.metadata)],
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[audit-fail]", input.action, m.slice(0, 300));
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
  telegram_user_id: string | null;
}): Record<string, unknown> {
  let telegramUserId: number | null = null;
  if (r.telegram_user_id != null && String(r.telegram_user_id).trim() !== "") {
    const n = Number(r.telegram_user_id);
    telegramUserId = Number.isFinite(n) ? n : null;
  }
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
    telegramUserId,
  };
}

async function resolveCurrentUser(
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<DbUserRow | null> {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) return null;
  const hashHex = sha256Hex(token);
  // НЕ выбираем telegram_user_id здесь — эта колонка может ещё не быть создана (до migrations-run).
  // Авторизация не требует telegram_user_id, берём null.
  const res = await pool.query<Omit<DbUserRow, "telegram_user_id"> & { refresh_token_hash: string }>(
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
  return { ...u, telegram_user_id: null };
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
  const listSql = `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id
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
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id
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
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id FROM users WHERE id = $1::uuid LIMIT 1`,
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
     RETURNING id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id`,
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
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id FROM users WHERE id = $1::uuid LIMIT 1`,
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
     RETURNING id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id`,
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
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id FROM users WHERE id = $1::uuid LIMIT 1`,
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
     RETURNING id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id`,
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



async function handlePasswordResetLinkCreate(
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

  const body = req.body as { userId?: unknown };
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId || !UUID_RE.test(userId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }
  if (userId === me.id) {
    sendJson(res, 400, {
      success: false,
      code: "SELF_RESET_FORBIDDEN",
      message: "Нельзя сгенерировать ссылку для собственного аккаунта.",
    });
    return;
  }

  const rlKey = `prl-create:${me.id}`;
  const rl = rateCheck(rlKey, 10, 60 * 1000);
  if (!rl.ok) {
    sendJsonRateLimited(res, rl.retryAfterSec, "Слишком много запросов на создание ссылки. Повторите позже.");
    return;
  }

  const cur = await pool.query<DbUserRow>(
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId],
  );
  const row = cur.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "USER_NOT_FOUND", message: "Пользователь не найден." });
    return;
  }
  if (row.status !== "active") {
    sendJson(res, 400, { success: false, code: "USER_INACTIVE", message: "Пользователь неактивен." });
    return;
  }
  if (!canCreatePasswordResetLink(me.role as UserRole, row.role as UserRole)) {
    sendJson(res, 403, { success: false, code: "PERMISSION_DENIED", message: "Недостаточно прав." });
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);

  await pool.query(
    `UPDATE password_reset_links SET used_at = NOW(), used_ip = 'superseded' WHERE user_id = $1::uuid AND used_at IS NULL`,
    [userId],
  );

  const ins = await pool.query<{ id: string; expires_at: string }>(
    `INSERT INTO password_reset_links (user_id, token_hash, created_by, expires_at)
     VALUES ($1::uuid, $2, $3::uuid, NOW() + interval '24 hours')
     RETURNING id, expires_at`,
    [userId, tokenHash, me.id],
  );
  const linkRow = ins.rows[0];
  if (!linkRow) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "auth.reset_link.created",
    entityType: "user",
    entityId: userId,
    metadata: { linkId: linkRow.id, expiresAt: linkRow.expires_at, targetRole: row.role },
  });

  rateRecord(rlKey, 60 * 1000);

  const host = pickPublicHost(headers);
  const link = `https://${host}/reset?token=${encodeURIComponent(token)}`;

  sendJson(res, 200, {
    success: true,
    token,
    link,
    expiresAt: linkRow.expires_at,
  });
}



function currentRefreshTokenHashHex(headers: Record<string, string | string[] | undefined>): string | null {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) return null;
  return sha256Hex(token);
}

const RU_PHONE_RE = /^\+7\d{10}$/;
const PHONE_SELF_FORMAT_MESSAGE =
  "Укажите номер в формате +7XXXXXXXXXX (10 цифр после +7).";

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
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id
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
        const normalized = normalizeRuPhoneSelf(pt);
        if (normalized == null) {
          sendJson(res, 400, {
            success: false,
            code: "VALIDATION_ERROR",
            message: PHONE_SELF_FORMAT_MESSAGE,
          });
          return;
        }
        phoneValue = normalized;
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
     RETURNING id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id`,
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

async function handleSessionsCleanupExpired(
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
  if (me.role !== "admin") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const del = await pool.query<{ id: string }>(
    `DELETE FROM sessions WHERE expires_at < NOW() RETURNING id`,
  );
  sendJson(res, 200, { success: true, deleted: del.rows.length });
}

async function handleMigrationsRun(
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.role !== "admin" || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только администратор." });
    return;
  }
  const applied: string[] = [];
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS audit_log (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         actor_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
         action text NOT NULL,
         entity_type text NOT NULL,
         entity_id text NOT NULL,
         metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
         created_at timestamptz NOT NULL DEFAULT NOW()
       )`,
    );
    applied.push("audit_log table");
    await pool.query(`CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS audit_log_actor_user_id_idx ON audit_log(actor_user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id)`);
    applied.push("audit_log indexes");

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz`);
    applied.push("users.password_changed_at column");

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_user_id bigint UNIQUE`);
    applied.push("users.telegram_user_id column");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS password_reset_links (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         token_hash text NOT NULL,
         expires_at timestamptz NOT NULL,
         used_at timestamptz NULL,
         used_ip text,
         created_at timestamptz NOT NULL DEFAULT NOW(),
         created_by uuid REFERENCES users(id)
       )`,
    );
    applied.push("password_reset_links table");

    const prlCols = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'password_reset_links'`,
    );
    const prlSet = new Set(prlCols.rows.map((r) => r.column_name));
    if (prlSet.has("issued_by")) {
      if (!prlSet.has("created_by")) {
        await pool.query(`ALTER TABLE password_reset_links RENAME COLUMN issued_by TO created_by`);
      } else {
        await pool.query(`UPDATE password_reset_links SET created_by = issued_by WHERE created_by IS NULL`);
        await pool.query(`ALTER TABLE password_reset_links DROP COLUMN issued_by`);
      }
    }
    // Сначала добавляем новые колонки, потом уже мигрируем данные из revoked_at в used_at/used_ip.
    await pool.query(`ALTER TABLE password_reset_links ADD COLUMN IF NOT EXISTS used_ip text`);
    await pool.query(`ALTER TABLE password_reset_links ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id)`);
    if (prlSet.has("revoked_at")) {
      await pool.query(
        `UPDATE password_reset_links SET used_at = COALESCE(used_at, revoked_at), used_ip = COALESCE(used_ip, 'superseded') WHERE revoked_at IS NOT NULL AND used_at IS NULL`,
      );
      await pool.query(`ALTER TABLE password_reset_links DROP COLUMN revoked_at`);
    }
    await pool.query(`UPDATE password_reset_links SET created_by = user_id WHERE created_by IS NULL`);
    await pool.query(`ALTER TABLE password_reset_links ALTER COLUMN created_by SET NOT NULL`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS password_reset_links_token_hash_uq ON password_reset_links(token_hash)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prl_user_active ON password_reset_links(user_id) WHERE used_at IS NULL`);
    applied.push("password_reset_links indexes");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS auth_login_failures (
         email_lower text PRIMARY KEY,
         fail_count int NOT NULL DEFAULT 0,
         locked_until timestamptz,
         updated_at timestamptz NOT NULL DEFAULT NOW()
       )`,
    );
    applied.push("auth_login_failures table");

    await pool.query(`ALTER TABLE audit_log ALTER COLUMN actor_user_id DROP NOT NULL`);
    applied.push("audit_log.actor_user_id nullable");

    await pool.query(`DELETE FROM sessions WHERE expires_at < NOW() AND revoked_at IS NULL`);
    applied.push("sessions cleanup (initial)");

    sendJson(res, 200, { success: true, applied });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { success: false, code: "MIGRATION_FAILED", message: msg.slice(0, 300), appliedSoFar: applied });
  }
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
  // ВАЖНО: Vercel dynamic route `[action].ts` устанавливает req.query.action = "audit-list".
  // Поэтому фильтр по action принимаем через `actionLike` (клиент шлёт `?actionLike=...`).
  const actionLike = qs(q.actionLike);
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


async function tgSendMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TG_BOT_TOKEN?.trim();
  if (!token) {
    console.warn("[api/admin] admin-recovery: TG_BOT_TOKEN не задан, сообщение не отправлено");
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn("[api/admin] admin-recovery sendMessage", res.status, t.slice(0, 200));
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[api/admin] admin-recovery sendMessage network", m.slice(0, 200));
  }
}

async function handleUsersUpdate(
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
  if (me.role !== "admin") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "users.update_role")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const body = req.body as { id?: unknown; telegramUserId?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный идентификатор пользователя." });
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(body, "telegramUserId")) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Не указано поле telegramUserId." });
    return;
  }

  const rawTg = body.telegramUserId;
  let nextTg: string | null = null;
  if (rawTg === null) {
    nextTg = null;
  } else if (typeof rawTg === "number" && Number.isFinite(rawTg) && rawTg > 0) {
    nextTg = String(Math.trunc(rawTg));
  } else if (typeof rawTg === "string" && rawTg.trim()) {
    const n = Number(rawTg.trim());
    if (!Number.isFinite(n) || n <= 0) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный Telegram user-id." });
      return;
    }
    nextTg = String(Math.trunc(n));
  } else {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный Telegram user-id." });
    return;
  }

  const cur = await pool.query<DbUserRow & { telegram_user_id: string | null }>(
    `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id FROM users WHERE id = $1::uuid LIMIT 1`,
    [id],
  );
  const row = cur.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
    return;
  }
  if (row.role !== "admin") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Telegram user-id можно задавать только для роли admin." });
    return;
  }

  const oldId = row.telegram_user_id;

  if (nextTg != null) {
    const taken = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE telegram_user_id = $1::bigint AND id <> $2::uuid LIMIT 1`,
      [nextTg, id],
    );
    if (taken.rows[0]) {
      sendJson(res, 409, { success: false, code: "TG_USER_ID_TAKEN", message: "Этот Telegram user-id уже привязан к другому пользователю." });
      return;
    }
  }

  const up = await pool.query<DbUserRow>(
    `UPDATE users SET telegram_user_id = $1::bigint, updated_at = NOW() WHERE id = $2::uuid
     RETURNING id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id`,
    [nextTg, id],
  );
  const u = up.rows[0];
  if (!u) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "user.telegram_link.changed",
    entityType: "user",
    entityId: id,
    metadata: { oldId: oldId ?? null, newId: nextTg },
  });

  sendJson(res, 200, { success: true, user: adminPublicUserFromRow(u) });
}

async function handleAdminRecovery(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const expected = process.env.TG_RECOVERY_SECRET?.trim();
  const got = readRecoverySecretHeader(headers);
  if (!expected || !got || !timingSafeEqualUtf8(expected, got)) {
    res.status(401).json({ ok: false });
    return;
  }

  const rawBody = req.body;
  const body = rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>) : {};
  const msg = body.message as Record<string, unknown> | undefined;
  const textRaw = msg && typeof msg.text === "string" ? msg.text.trim() : "";
  const from = msg && typeof msg.from === "object" && msg.from !== null ? (msg.from as Record<string, unknown>) : undefined;
  const chat = msg && typeof msg.chat === "object" && msg.chat !== null ? (msg.chat as Record<string, unknown>) : undefined;
  const fromId = from && typeof from.id === "number" && Number.isFinite(from.id) ? from.id : null;
  const chatId = chat && typeof chat.id === "number" && Number.isFinite(chat.id) ? chat.id : null;

  if (!textRaw || fromId == null) {
    sendJson(res, 200, { ok: true });
    return;
  }

  const whitelist = parseTelegramWhitelist();
  if (!whitelist.has(fromId)) {
    await tryAudit(pool, {
      actorUserId: null,
      action: "auth.tg_recovery.rejected",
      entityType: "telegram_user",
      entityId: String(fromId),
      metadata: { reason: "not_in_whitelist", tgUserId: fromId },
    });
    if (chatId != null) await tgSendMessage(chatId, "Доступ к команде восстановления запрещён.");
    sendJson(res, 200, { ok: true });
    return;
  }

  if (textRaw.startsWith("/start")) {
    if (chatId != null) {
      await tgSendMessage(
        chatId,
        "Бот восстановления Tandoor. Отправьте команду /reset, чтобы получить одноразовую ссылку для сброса пароля.",
      );
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (textRaw !== "/reset") {
    if (chatId != null) await tgSendMessage(chatId, "Доступна только команда /reset.");
    sendJson(res, 200, { ok: true });
    return;
  }

  await tryAudit(pool, {
    actorUserId: null,
    action: "auth.tg_recovery.requested",
    entityType: "telegram_user",
    entityId: String(fromId),
    metadata: { tgUserId: fromId },
  });

  const now = Date.now();
  const prev = tgRecoveryLastIssued.get(fromId);
  if (prev != null && now - prev < 10 * 60 * 1000) {
    await tryAudit(pool, {
      actorUserId: null,
      action: "auth.tg_recovery.rejected",
      entityType: "telegram_user",
      entityId: String(fromId),
      metadata: { reason: "rate_limit", tgUserId: fromId },
    });
    if (chatId != null) await tgSendMessage(chatId, "Слишком частые запросы. Попробуйте через несколько минут.");
    sendJson(res, 200, { ok: true });
    return;
  }

  const ures = await pool.query<{ id: string; role: string; status: string }>(
    `SELECT id, role, status FROM users WHERE telegram_user_id = $1::bigint LIMIT 1`,
    [String(fromId)],
  );
  const u = ures.rows[0];
  if (!u) {
    await tryAudit(pool, {
      actorUserId: null,
      action: "auth.tg_recovery.rejected",
      entityType: "telegram_user",
      entityId: String(fromId),
      metadata: { reason: "no_user", tgUserId: fromId },
    });
    if (chatId != null) await tgSendMessage(chatId, "К этому Telegram-аккаунту не привязан пользователь Tandoor.");
    sendJson(res, 200, { ok: true });
    return;
  }
  if (u.role !== "admin") {
    await tryAudit(pool, {
      actorUserId: null,
      action: "auth.tg_recovery.rejected",
      entityType: "telegram_user",
      entityId: String(fromId),
      metadata: { reason: "not_admin", tgUserId: fromId, userId: u.id },
    });
    if (chatId != null) await tgSendMessage(chatId, "Восстановление через Telegram доступно только администраторам.");
    sendJson(res, 200, { ok: true });
    return;
  }
  if (u.status !== "active") {
    await tryAudit(pool, {
      actorUserId: null,
      action: "auth.tg_recovery.rejected",
      entityType: "telegram_user",
      entityId: String(fromId),
      metadata: { reason: "inactive", tgUserId: fromId, userId: u.id },
    });
    if (chatId != null) await tgSendMessage(chatId, "Пользователь неактивен.");
    sendJson(res, 200, { ok: true });
    return;
  }

  const userId = u.id;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);

  await pool.query(
    `UPDATE password_reset_links SET used_at = NOW(), used_ip = 'superseded_by_tg' WHERE user_id = $1::uuid AND used_at IS NULL`,
    [userId],
  );

  const ins = await pool.query<{ id: string; expires_at: string }>(
    `INSERT INTO password_reset_links (user_id, token_hash, created_by, expires_at)
     VALUES ($1::uuid, $2, $3::uuid, NOW() + interval '1 hour')
     RETURNING id, expires_at`,
    [userId, tokenHash, userId],
  );
  const linkRow = ins.rows[0];
  if (!linkRow) {
    console.warn("[api/admin] admin-recovery: insert failed");
    sendJson(res, 200, { ok: true });
    return;
  }

  await tryAudit(pool, {
    actorUserId: null,
    action: "auth.tg_recovery.issued",
    entityType: "user",
    entityId: userId,
    metadata: { tgUserId: fromId, linkId: linkRow.id, expiresAt: linkRow.expires_at },
  });

  tgRecoveryLastIssued.set(fromId, now);

  const origin = pickPublicAppOrigin(headers);
  const href = `${origin}/#/reset?token=${encodeURIComponent(token)}`;
  if (chatId != null) {
    await tgSendMessage(
      chatId,
      `Ссылка для смены пароля (действует 1 час):\n${href}\n\nПерейдите по ссылке и задайте новый пароль. Не пересылайте её.`,
    );
  }

  sendJson(res, 200, { ok: true });
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
  if (req.method === "POST" && action !== "admin-recovery" && !enforceCsrfOrigin(req)) {
    sendJson(res, 403, {
      success: false,
      code: "CSRF_REJECTED",
      message: "Недопустимый источник запроса.",
    });
    return;
  }
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
    if (action === "users-update" && req.method === "POST") {
      await handleUsersUpdate(req, res, pool, headers);
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
    if (action === "password-reset-link-create" && req.method === "POST") {
      await handlePasswordResetLinkCreate(req, res, pool, headers);
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
    if (action === "admin-recovery" && req.method === "POST") {
      await handleAdminRecovery(req, res, pool, headers);
      return;
    }
    if (action === "sessions-cleanup-expired" && req.method === "POST") {
      await handleSessionsCleanupExpired(res, pool, headers);
      return;
    }
    if (action === "migrations-run" && req.method === "POST") {
      await handleMigrationsRun(res, pool, headers);
      return;
    }
    if (action === "users-delete" && req.method === "POST") {
      const me = await resolveCurrentUser(pool, headers);
      if (!me || me.role !== "admin" || me.status !== "active") {
        sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
        return;
      }
      const body = (req.body ?? {}) as { id?: unknown };
      const id = typeof body.id === "string" ? body.id.trim() : "";
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(id)) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный id." });
        return;
      }
      if (id === me.id) {
        sendJson(res, 400, { success: false, code: "SELF_DELETE", message: "Нельзя удалить самого себя." });
        return;
      }
      const target = await pool.query(`SELECT id, email, role FROM users WHERE id = $1`, [id]);
      if (target.rowCount === 0) {
        sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
        return;
      }
      if (target.rows[0].role === "admin") {
        sendJson(res, 400, { success: false, code: "CANNOT_DELETE_ADMIN", message: "Нельзя удалить администратора." });
        return;
      }
      const oldEmail = String(target.rows[0].email ?? "");
      // Чистим все связанные записи вручную на случай отсутствия ON DELETE CASCADE
      try { await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [id]); } catch {}
      try { await pool.query(`DELETE FROM password_reset_links WHERE user_id = $1`, [id]); } catch {}
      try { await pool.query(`DELETE FROM invitations WHERE created_by = $1 OR accepted_by = $1`, [id]); } catch {}
      try { await pool.query(`DELETE FROM auth_login_failures WHERE email_lower = LOWER($1)`, [oldEmail]); } catch {}
      try { await pool.query(`UPDATE audit_log SET actor_user_id = NULL WHERE actor_user_id = $1`, [id]); } catch {}
      await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
      await tryAudit(pool, {
        actorUserId: me.id,
        action: "user.deleted",
        entityType: "user",
        entityId: id,
        metadata: { email: oldEmail },
      });
      sendJson(res, 200, { success: true });
      return;
    }
    if (action === "users-update-email" && req.method === "POST") {
      const me = await resolveCurrentUser(pool, headers);
      if (!me || me.role !== "admin" || me.status !== "active") {
        sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
        return;
      }
      const body = (req.body ?? {}) as { id?: unknown; email?: unknown };
      const id = typeof body.id === "string" ? body.id.trim() : "";
      const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
      const emailLower = emailRaw.toLowerCase();
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!uuidRe.test(id) || !emailRe.test(emailLower)) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректные id или email." });
        return;
      }
      const exists = await pool.query(`SELECT id, email FROM users WHERE id = $1`, [id]);
      if (exists.rowCount === 0) {
        sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
        return;
      }
      const oldEmail = String(exists.rows[0].email ?? "");
      try {
        await pool.query(`UPDATE users SET email = $1 WHERE id = $2`, [emailLower, id]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/duplicate key|unique/i.test(msg)) {
          sendJson(res, 409, { success: false, code: "CONFLICT", message: "Email уже занят." });
          return;
        }
        throw e;
      }
      await tryAudit(pool, {
        actorUserId: me.id,
        action: "user.email.changed",
        entityType: "user",
        entityId: id,
        metadata: { oldEmail, newEmail: emailLower },
      });
      sendJson(res, 200, { success: true });
      return;
    }
    if (action === "auth-unlock-email" && req.method === "POST") {
      const me = await resolveCurrentUser(pool, headers);
      if (!me || me.role !== "admin" || me.status !== "active") {
        sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
        return;
      }
      const body = (req.body ?? {}) as { email?: unknown };
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!email) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите email." });
        return;
      }
      const del = await pool.query(`DELETE FROM auth_login_failures WHERE email_lower = $1`, [email]);
      await tryAudit(pool, {
        actorUserId: me.id,
        action: "auth.unlock_email",
        entityType: "email",
        entityId: email,
        metadata: { deletedRows: del.rowCount ?? null },
      });
      sendJson(res, 200, { success: true, deleted: del.rowCount ?? 0 });
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
