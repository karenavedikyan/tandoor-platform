/**
 * Vercel Serverless: `/api/auth/:action` (login | logout | logout-all | me | my-visible-codes | my-org-snapshot).
 *
 * Self-contained: без импортов client/, server/, shared/. Vercel-tracing/bundler не должен
 * подтягивать пути проекта на этапе загрузки функции, иначе получим FUNCTION_INVOCATION_FAILED
 * ещё до возврата JSON (см. revert PR #226 после PR #224).
 *
 * Логика **продублирована** из `server/auth/handlers.ts` (Express). При изменении контракта
 * login / logout / me — править **оба** файла; см. `docs/auth-access-foundation.md`.
 *
 * Разрешённые импорты: только `@vercel/node`, `@neondatabase/serverless`, `bcryptjs`, `node:crypto`.
 *
 * Дублированные литералы ролей/статусов (копия `shared/auth.ts` для типизации ответа):
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { makePoolFromNeon, type PoolLike } from "../../server/db/neon-client.js";

type UserRole =
  | "director"
  | "rop"
  | "regional_manager"
  | "manager"
  | "marketer"
  | "analyst"
  | "admin";

type UserStatus = "invited" | "active" | "disabled";

// SYNC: shared/auth-rbac.ts — duplicated inline (self-contained) + audit.read, sessions.read_self, sessions.revoke_self (Prompt 09).

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
  | "users.impersonate"
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
    "users.impersonate",
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

const AUTH_COOKIE = "tandoor_auth_sess";
/** HttpOnly «билет на возврат» при admin impersonation (значение — refresh-токен исходной admin-сессии). */
const ADMIN_RETURN_COOKIE = "admin_return_sid";
const IMPERSONATION_TTL_SEC = 60 * 60;
const UUID_RE_IMP = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JSON_CT = "application/json; charset=utf-8";
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sessionTtlDays(): number {
  const raw = process.env.TANDOOR_SESSION_TTL_DAYS?.trim();
  if (!raw) return 30;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 365) return 30;
  return n;
}

function sessionTtlSeconds(): number {
  return sessionTtlDays() * 24 * 60 * 60;
}

function cookieSecureFlag(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.VERCEL === "1") return true;
  return process.env.TANDOOR_AUTH_COOKIE_SECURE === "true";
}

function cookieSuffixParts(maxAgeSec: number): string[] {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(maxAgeSec)}`];
  if (cookieSecureFlag()) parts.push("Secure");
  return parts;
}

function buildAuthCookie(refreshToken: string, maxAgeSecOverride?: number): string {
  const maxAgeSec = maxAgeSecOverride ?? sessionTtlSeconds();
  const v = encodeURIComponent(refreshToken);
  return `${AUTH_COOKIE}=${v}; ${cookieSuffixParts(maxAgeSec).join("; ")}`;
}

function clearAuthCookie(): string {
  return `${AUTH_COOKIE}=; ${cookieSuffixParts(0).join("; ")}`;
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

function parseAdminReturnToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader?.trim()) return null;
  for (const p of cookieHeader.split(";")) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k !== ADMIN_RETURN_COOKIE) continue;
    try {
      const raw = decodeURIComponent(p.slice(idx + 1).trim());
      return raw || null;
    } catch {
      return p.slice(idx + 1).trim() || null;
    }
  }
  return null;
}

function buildAdminReturnCookie(refreshToken: string): string {
  const v = encodeURIComponent(refreshToken);
  return `${ADMIN_RETURN_COOKIE}=${v}; ${cookieSuffixParts(IMPERSONATION_TTL_SEC).join("; ")}`;
}

function clearAdminReturnCookie(): string {
  return `${ADMIN_RETURN_COOKIE}=; ${cookieSuffixParts(0).join("; ")}`;
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

function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
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

/** Иерархия одобряющих для self-service «Забыли пароль?» (SYNC: shared/auth-rbac.ts при выносе). */
function approverRolesFor(role: UserRole): UserRole[] {
  if (role === "admin") return [];
  if (role === "director") return ["admin"];
  if (role === "rop") return ["director"];
  return ["rop", "director"];
}

const RESET_PUBLIC_RL_WINDOW_MS = 10 * 60 * 1000;
const RESET_PUBLIC_RL_MAX = 5;
type ResetPublicRlBucket = { hits: number[] };
const resetPublicRateBuckets = new Map<string, ResetPublicRlBucket>();

function resetPublicRateConsume(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const b = resetPublicRateBuckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < RESET_PUBLIC_RL_WINDOW_MS);
  if (b.hits.length >= RESET_PUBLIC_RL_MAX) {
    const oldest = b.hits[0]!;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + RESET_PUBLIC_RL_WINDOW_MS - now) / 1000));
    resetPublicRateBuckets.set(key, b);
    return { ok: false, retryAfterSec };
  }
  b.hits.push(now);
  resetPublicRateBuckets.set(key, b);
  return { ok: true };
}

function resetPublicRateKey(ip: string | null, emailLower: string): string {
  return `${ip ?? "unknown-ip"}|${emailLower}`;
}

async function tgSendResetRequestNotice(chatId: number, text: string): Promise<void> {
  const token = process.env.TG_BOT_TOKEN?.trim();
  if (!token) return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn("[api/auth] reset-request tg sendMessage", res.status, t.slice(0, 200));
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[api/auth] reset-request tg network", m.slice(0, 200));
  }
}

function pickAppOriginForLinks(headers: Record<string, string | string[] | undefined>): string {
  const envUrl = process.env.PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const host = (() => {
    const xf = headers["x-forwarded-host"];
    if (typeof xf === "string" && xf.trim()) return xf.trim().split(",")[0]!.trim();
    if (Array.isArray(xf) && xf[0]?.trim()) return xf[0]!.trim().split(",")[0]!.trim();
    const h = headers.host;
    if (typeof h === "string" && h.trim()) return h.trim();
    if (Array.isArray(h) && h[0]?.trim()) return h[0]!.trim();
    return "localhost";
  })();
  const proto =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1" || cookieSecureFlag() ? "https" : "http";
  return `${proto}://${host}`;
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

function readUserAgent(headers: Record<string, string | string[] | undefined>): string | null {
  const ua = headers["user-agent"];
  if (typeof ua === "string") return ua || null;
  if (Array.isArray(ua) && ua[0]) return ua[0]!;
  return null;
}

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


function redeemClientIp(req: VercelRequest, headers: Record<string, string | string[] | undefined>): string | null {
  const xff = headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(xff) && xff[0]?.trim()) {
    const first = xff[0]!.split(",")[0]?.trim();
    if (first) return first;
  }
  const ra = req.socket?.remoteAddress ?? null;
  return ra && ra.trim() ? ra.trim() : null;
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


const UUID_RE_RESET = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleResetRequestApprovers(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const body = (req.body ?? {}) as { email?: unknown };
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!rawEmail || !SIMPLE_EMAIL_RE.test(rawEmail)) {
    sendJson(res, 200, { success: true, approvers: [] });
    return;
  }
  const ip = getClientIp(headers);
  const rl = resetPublicRateConsume(resetPublicRateKey(ip, rawEmail));
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    sendJson(res, 429, { success: false, code: "RATE_LIMITED", message: "Слишком много запросов. Повторите позже." });
    return;
  }
  try {
    const ures = await pool.query<{ id: string; role: string; status: string }>(
      `SELECT id, role, status FROM users WHERE email = $1 LIMIT 1`,
      [rawEmail],
    );
    const u = ures.rows[0];
    if (!u || u.role === "admin" || (u.status !== "active" && u.status !== "invited")) {
      sendJson(res, 200, { success: true, approvers: [] });
      return;
    }
    const roles = approverRolesFor(u.role as UserRole);
    if (roles.length === 0) {
      sendJson(res, 200, { success: true, approvers: [] });
      return;
    }
    const approvers = await pool.query<{ id: string; full_name: string; role: string }>(
      `SELECT id, full_name, role FROM users
       WHERE role = ANY($1::text[]) AND status = 'active'
       ORDER BY CASE role WHEN 'director' THEN 1 WHEN 'rop' THEN 2 ELSE 3 END, full_name
       LIMIT 50`,
      [roles],
    );
    sendJson(res, 200, {
      success: true,
      approvers: approvers.rows.map((r) => ({ id: r.id, fullName: r.full_name, role: r.role })),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/auth] reset-request-approvers", m.slice(0, 200));
    sendJson(res, 200, { success: true, approvers: [] });
  }
}

async function handleResetRequestCreate(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const body = (req.body ?? {}) as { email?: unknown; approverId?: unknown };
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const approverId = typeof body.approverId === "string" ? body.approverId.trim() : "";
  if (!rawEmail || !SIMPLE_EMAIL_RE.test(rawEmail) || !approverId || !UUID_RE_RESET.test(approverId)) {
    sendJson(res, 200, { success: true });
    return;
  }
  const ip = getClientIp(headers);
  const rl = resetPublicRateConsume(resetPublicRateKey(ip, rawEmail));
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    sendJson(res, 429, { success: false, code: "RATE_LIMITED", message: "Слишком много запросов. Повторите позже." });
    return;
  }
  try {
    const reqRes = await pool.query<{ id: string; role: string; status: string; full_name: string; email: string }>(
      `SELECT id, role, status, full_name, email FROM users WHERE email = $1 LIMIT 1`,
      [rawEmail],
    );
    const requester = reqRes.rows[0];
    if (!requester || (requester.status !== "active" && requester.status !== "invited")) {
      sendJson(res, 200, { success: true });
      return;
    }
    const allowedRoles = approverRolesFor(requester.role as UserRole);
    if (allowedRoles.length === 0) {
      sendJson(res, 200, { success: true });
      return;
    }
    const appRes = await pool.query<{
      id: string;
      role: string;
      status: string;
      telegram_user_id: string | null;
    }>(
      `SELECT id, role, status, telegram_user_id::text AS telegram_user_id FROM users WHERE id = $1::uuid LIMIT 1`,
      [approverId],
    );
    const approver = appRes.rows[0];
    if (!approver || approver.status !== "active" || !allowedRoles.includes(approver.role as UserRole)) {
      sendJson(res, 200, { success: true });
      return;
    }
    const dup = await pool.query<{ id: string }>(
      `SELECT id FROM password_reset_requests
       WHERE requester_user_id = $1::uuid AND approver_user_id = $2::uuid AND status = 'pending' AND expires_at > NOW()
       LIMIT 1`,
      [requester.id, approverId],
    );
    if (dup.rows[0]) {
      sendJson(res, 200, { success: true });
      return;
    }
    await pool.query(
      `INSERT INTO password_reset_requests (requester_user_id, approver_user_id, expires_at)
       VALUES ($1::uuid, $2::uuid, NOW() + interval '30 minutes')`,
      [requester.id, approverId],
    );
    await tryAudit(pool, {
      actorUserId: null,
      action: "auth.reset_request.created",
      entityType: "user",
      entityId: requester.id,
      metadata: { requesterId: requester.id, approverId },
    });
    let tgId: number | null = null;
    if (approver.telegram_user_id != null && String(approver.telegram_user_id).trim() !== "") {
      const n = Number(approver.telegram_user_id);
      if (Number.isFinite(n)) tgId = n;
    }
    if (tgId != null) {
      const origin = pickAppOriginForLinks(headers);
      const msg = `Новый запрос на сброс пароля от ${requester.full_name} (${requester.email}). Открыть: ${origin}/#/reset-requests`;
      void tgSendResetRequestNotice(tgId, msg);
    }
    sendJson(res, 200, { success: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/auth] reset-request-create", m.slice(0, 200));
    sendJson(res, 200, { success: true });
  }
}

async function handlePasswordResetLinkRedeem(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<void> {
  const headers = vercelHeaders(req);
  const body = (req.body ?? {}) as { token?: unknown; newPassword?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!token || token.length < 30 || token.length > 100) {
    sendJson(res, 400, { success: false, code: "INVALID_INPUT", message: "Некорректные данные." });
    return;
  }
  const pwv = validateRedeemPassword(newPassword);
  if (!pwv.ok) {
    sendJson(res, 400, { success: false, code: "PASSWORD_TOO_WEAK", message: pwv.message });
    return;
  }

  const tokenHash = sha256Hex(token);
  const sel = await pool.query<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    `SELECT id, user_id, expires_at, used_at FROM password_reset_links WHERE token_hash = $1 LIMIT 1`,
    [tokenHash],
  );
  const row = sel.rows[0];
  if (!row) {
    sendJson(res, 400, { success: false, code: "RESET_LINK_INVALID", message: "Ссылка недействительна." });
    return;
  }
  if (row.used_at != null) {
    await tryAudit(pool, {
      actorUserId: null,
      action: "auth.reset_link.expired_attempt",
      entityType: "user",
      entityId: row.user_id,
      metadata: { linkId: row.id, reason: "used" },
    });
    sendJson(res, 400, { success: false, code: "RESET_LINK_USED", message: "Ссылка уже использована." });
    return;
  }
  const expMs = Date.parse(row.expires_at);
  if (!Number.isFinite(expMs) || expMs <= Date.now()) {
    await tryAudit(pool, {
      actorUserId: null,
      action: "auth.reset_link.expired_attempt",
      entityType: "user",
      entityId: row.user_id,
      metadata: { linkId: row.id, reason: "expired" },
    });
    sendJson(res, 400, { success: false, code: "RESET_LINK_EXPIRED", message: "Срок действия ссылки истёк." });
    return;
  }

  const ip = redeemClientIp(req, headers);
  const ipVal = ip ?? "";
  const newHash = await bcrypt.hash(pwv.trimmed, 12);
  try {
    await pool.query(
      `UPDATE users SET password_hash = $1, must_change_password = false, password_changed_at = NOW(), updated_at = NOW() WHERE id = $2::uuid`,
      [newHash, row.user_id],
    );
    await pool.query(`UPDATE password_reset_links SET used_at = NOW(), used_ip = $1 WHERE id = $2::uuid`, [ipVal, row.id]);
    await pool.query(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1::uuid AND revoked_at IS NULL`,
      [row.user_id],
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/auth] password-reset-link-redeem", m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  await tryAudit(pool, {
    actorUserId: null,
    action: "auth.reset_link.used",
    entityType: "user",
    entityId: row.user_id,
    metadata: { linkId: row.id, ip },
  });

  sendJson(res, 200, {
    success: true,
    message: "Пароль обновлён. Войдите с новым паролем.",
  });
}



type DbUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  must_change_password: boolean;
  last_login_at: string | null;
  password_hash: string | null;
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
    console.error("[api/auth] audit", input.action, m.slice(0, 200));
  }
}

function publicUserFromRow(r: {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  must_change_password: boolean;
  last_login_at: string | null;
}): Record<string, unknown> {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    role: r.role as UserRole,
    status: r.status as UserStatus,
    mustChangePassword: r.must_change_password,
    lastLoginAt: r.last_login_at,
  };
}

type AuthResult = {
  status: number;
  json: unknown;
  setCookie?: string | string[];
  cacheControl?: "no-store";
  retryAfterSec?: number;
};

function applyResult(res: VercelResponse, r: AuthResult): void {
  res.setHeader("Content-Type", JSON_CT);
  if (r.cacheControl) res.setHeader("Cache-Control", r.cacheControl);
  if (r.retryAfterSec !== undefined) res.setHeader("Retry-After", String(r.retryAfterSec));
  if (r.setCookie) {
    const cookies = Array.isArray(r.setCookie) ? r.setCookie : [r.setCookie];
    for (const c of cookies) {
      res.appendHeader("Set-Cookie", c);
    }
  }
  res.status(r.status).json(r.json);
}

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

async function handleLogin(req: VercelRequest, headers: Record<string, string | string[] | undefined>): Promise<AuthResult> {
  const ip = getClientIp(headers);
  try {
    const body = req.body as { email?: unknown; password?: unknown } | null;
    const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!rawEmail || !SIMPLE_EMAIL_RE.test(rawEmail)) {
      return { status: 400, json: { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный email." } };
    }
    if (password.length < 1) {
      return { status: 400, json: { success: false, code: "VALIDATION_ERROR", message: "Укажите пароль." } };
    }

    const pool = getPool();
    if (!pool) {
      return { status: 500, json: { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." } };
    }

    // Таблица auth_login_failures может ещё не быть создана (до migrations-run) — в этом случае rate-limit пропускаем.
    let lockRow: { fail_count: number; locked_until: string | null } | undefined;
    try {
      const lockRes = await pool.query<{ fail_count: number; locked_until: string | null }>(
        `SELECT fail_count, locked_until FROM auth_login_failures WHERE email_lower = $1 LIMIT 1`,
        [rawEmail],
      );
      lockRow = lockRes.rows[0];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/auth_login_failures.*does not exist|relation .* does not exist/i.test(msg)) throw e;
      console.warn("[login] auth_login_failures table missing, skipping rate-limit");
    }
    if (lockRow?.locked_until) {
      const lu = Date.parse(lockRow.locked_until);
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

    const ures = await pool.query<DbUserRow>(
      `SELECT id, email, full_name, role, status, must_change_password, last_login_at, password_hash
       FROM users WHERE email = $1 LIMIT 1`,
      [rawEmail],
    );
    const user = ures.rows[0];

    const badCreds =
      !user ||
      user.status !== "active" ||
      user.password_hash == null ||
      !(await verifyPassword(password, user.password_hash));

    if (badCreds) {
      const prevCount = lockRow?.fail_count ?? 0;
      const attempt = prevCount + 1;
      try {
        await pool.query(
          `INSERT INTO auth_login_failures (email_lower, fail_count, locked_until, updated_at)
           VALUES ($1, 1, NULL, NOW())
           ON CONFLICT (email_lower) DO UPDATE SET
             fail_count = CASE WHEN auth_login_failures.fail_count + 1 >= 5 THEN 0 ELSE auth_login_failures.fail_count + 1 END,
             locked_until = CASE WHEN auth_login_failures.fail_count + 1 >= 5 THEN NOW() + interval '15 minutes' ELSE auth_login_failures.locked_until END,
             updated_at = NOW()`,
          [rawEmail],
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/auth_login_failures.*does not exist|relation .* does not exist/i.test(msg)) throw e;
      }
      await tryAudit(pool, {
        actorUserId: null,
        action: "auth.login.failed",
        entityType: "email",
        entityId: rawEmail,
        metadata: { ip, failCount: attempt },
      });
      return {
        status: 401,
        json: { success: false, code: "INVALID_CREDENTIALS", message: "Неверный email или пароль." },
      };
    }

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = sha256Hex(refreshToken);
    const sessionId = randomUUID();
    const userAgent = readUserAgent(headers);
    const ttlSec = sessionTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();

    await pool.query(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, NULL)`,
      [sessionId, user.id, refreshTokenHash, userAgent, ip, expiresAt],
    );

    try {
      await pool.query(`DELETE FROM auth_login_failures WHERE email_lower = $1`, [rawEmail]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/auth_login_failures.*does not exist|relation .* does not exist/i.test(msg)) throw e;
    }

    let lastLoginAt: string | null = user.last_login_at;
    try {
      const up = await pool.query<{ last_login_at: string }>(
        `UPDATE users SET last_login_at = NOW() WHERE id = $1::uuid RETURNING last_login_at`,
        [user.id],
      );
      const v = up.rows[0]?.last_login_at;
      if (v != null) lastLoginAt = v;
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/auth] login lastLoginAt", m.slice(0, 200));
    }

    await tryAudit(pool, {
      actorUserId: user.id,
      action: "auth.login",
      entityType: "session",
      entityId: sessionId,
      metadata: { ip, userAgent },
    });

    const snapshot = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      status: user.status,
      must_change_password: user.must_change_password,
      last_login_at: lastLoginAt,
    };

    return {
      status: 200,
      setCookie: buildAuthCookie(refreshToken),
      json: { success: true, user: publicUserFromRow(snapshot) },
    };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/auth] login", m.slice(0, 200));
    return { status: 500, json: { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." } };
  }
}

async function handleMe(headers: Record<string, string | string[] | undefined>): Promise<AuthResult> {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) {
    return { status: 401, json: { success: false, code: "UNAUTHENTICATED" } };
  }
  const pool = getPool();
  if (!pool) {
    return { status: 500, json: { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." } };
  }
  const hashHex = sha256Hex(token);
  const res = await pool.query<
    DbUserRow & {
      refresh_token_hash: string;
      impersonator_full_name: string | null;
      impersonator_email: string | null;
    }
  >(
    `SELECT u.id, u.email, u.full_name, u.role, u.status, u.must_change_password, u.last_login_at,
            s.refresh_token_hash,
            imp.full_name AS impersonator_full_name,
            imp.email AS impersonator_email
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN users imp ON imp.id = s.impersonator_user_id
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [hashHex],
  );
  const row = res.rows[0];
  if (!row || !timingSafeEqualHex(row.refresh_token_hash, token)) {
    return { status: 401, json: { success: false, code: "UNAUTHENTICATED" } };
  }
  const { refresh_token_hash: _h, impersonator_full_name, impersonator_email, ...u } = row;
  let impersonatedBy: string | null = null;
  if (impersonator_full_name && impersonator_email) {
    impersonatedBy = `${impersonator_full_name} · ${impersonator_email}`;
  }
  const userJson = { ...publicUserFromRow(u), impersonatedBy };
  return {
    status: 200,
    cacheControl: "no-store",
    json: { success: true, user: userJson },
  };
}


async function handleImpersonateStart(req: VercelRequest, headers: Record<string, string | string[] | undefined>): Promise<AuthResult> {
  const pool = getPool();
  if (!pool) {
    return { status: 500, json: { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." } };
  }
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) {
    return { status: 403, json: { success: false, code: "FORBIDDEN" } };
  }
  const hashHex = sha256Hex(token);
  const cur = await pool.query<
    DbUserRow & {
      refresh_token_hash: string;
      impersonator_user_id: string | null;
    }
  >(
    `SELECT u.id, u.email, u.full_name, u.role, u.status, u.must_change_password, u.last_login_at,
            u.password_hash, s.refresh_token_hash, s.impersonator_user_id
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [hashHex],
  );
  const actor = cur.rows[0];
  if (!actor || !timingSafeEqualHex(actor.refresh_token_hash, token)) {
    return { status: 403, json: { success: false, code: "FORBIDDEN" } };
  }
  if (actor.impersonator_user_id != null) {
    return {
      status: 400,
      json: {
        success: false,
        code: "ALREADY_IMPERSONATING",
        message: "Сначала выйдите из режима наблюдения.",
      },
    };
  }
  if (!roleHasPermission(actor.role as UserRole, "users.impersonate")) {
    return { status: 403, json: { success: false, code: "FORBIDDEN" } };
  }
  const body = (req.body ?? {}) as { targetUserId?: unknown } | null;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";
  if (!UUID_RE_IMP.test(targetUserId)) {
    return { status: 400, json: { success: false, code: "VALIDATION_ERROR", message: "Некорректный targetUserId." } };
  }
  if (targetUserId === actor.id) {
    return {
      status: 400,
      json: { success: false, code: "CANNOT_IMPERSONATE_SELF", message: "Нельзя войти под собственным аккаунтом." },
    };
  }
  const tq = await pool.query<DbUserRow>(
    `SELECT id, email, full_name, role, status, must_change_password, last_login_at, password_hash
     FROM users WHERE id = $1::uuid LIMIT 1`,
    [targetUserId],
  );
  const target = tq.rows[0];
  if (!target) {
    return { status: 404, json: { success: false, code: "USER_NOT_FOUND" } };
  }
  if (target.role === "admin") {
    return { status: 400, json: { success: false, code: "CANNOT_IMPERSONATE_ADMIN" } };
  }
  if (target.status !== "active") {
    return { status: 400, json: { success: false, code: "TARGET_NOT_ACTIVE" } };
  }
  const adminPlainToken = token;
  const targetRefresh = generateRefreshToken();
  const targetHash = sha256Hex(targetRefresh);
  const newSessId = randomUUID();
  const userAgent = readUserAgent(headers);
  const ip = getClientIp(headers);
  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_SEC * 1000).toISOString();
  await pool.query(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at, impersonator_user_id)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, NULL, $7::uuid)`,
    [newSessId, target.id, targetHash, userAgent, ip, expiresAt, actor.id],
  );
  await tryAudit(pool, {
    actorUserId: actor.id,
    action: "admin.impersonate.start",
    entityType: "users",
    entityId: target.id,
    metadata: {
      targetEmail: target.email,
      targetRole: target.role,
      sessionId: newSessId,
      ttlMinutes: 60,
    },
  });
  const { password_hash: _ap, refresh_token_hash: _ar, impersonator_user_id: _ai, ...actorPublic } = actor;
  void _ap;
  void _ar;
  void _ai;
  const { password_hash: _tp, ...targetPublic } = target;
  void _tp;
  return {
    status: 200,
    cacheControl: "no-store",
    setCookie: [buildAuthCookie(targetRefresh, IMPERSONATION_TTL_SEC), buildAdminReturnCookie(adminPlainToken)],
    json: {
      success: true,
      user: publicUserFromRow(targetPublic),
      expiresAt,
    },
  };
}

async function handleImpersonateStop(headers: Record<string, string | string[] | undefined>): Promise<AuthResult> {
  const returnTok = parseAdminReturnToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!returnTok) {
    return { status: 400, json: { success: false, code: "NOT_IMPERSONATING" } };
  }
  const curTok = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!curTok) {
    return { status: 400, json: { success: false, code: "NOT_IMPERSONATING" } };
  }
  const pool = getPool();
  if (!pool) {
    return { status: 500, json: { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." } };
  }
  const curHash = sha256Hex(curTok);
  const curSess = await pool.query<{
    id: string;
    user_id: string;
    refresh_token_hash: string;
    impersonator_user_id: string | null;
  }>(
    `SELECT id, user_id, refresh_token_hash, impersonator_user_id
     FROM sessions
     WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [curHash],
  );
  const csr = curSess.rows[0];
  if (!csr || !timingSafeEqualHex(csr.refresh_token_hash, curTok)) {
    return { status: 400, json: { success: false, code: "RETURN_SESSION_INVALID" } };
  }
  if (csr.impersonator_user_id == null) {
    return { status: 400, json: { success: false, code: "NOT_IMPERSONATING" } };
  }
  const adminId = csr.impersonator_user_id;
  const retHash = sha256Hex(returnTok);
  const admSess = await pool.query<{ id: string; user_id: string; refresh_token_hash: string }>(
    `SELECT id, user_id, refresh_token_hash
     FROM sessions
     WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [retHash],
  );
  const asr = admSess.rows[0];
  if (!asr || asr.user_id !== adminId || !timingSafeEqualHex(asr.refresh_token_hash, returnTok)) {
    return { status: 400, json: { success: false, code: "RETURN_SESSION_INVALID" } };
  }
  await pool.query(`UPDATE sessions SET revoked_at = NOW() WHERE id = $1::uuid AND revoked_at IS NULL`, [csr.id]);
  const adminUser = await pool.query<DbUserRow>(
    `SELECT id, email, full_name, role, status, must_change_password, last_login_at, password_hash
     FROM users WHERE id = $1::uuid LIMIT 1`,
    [adminId],
  );
  const adm = adminUser.rows[0];
  if (!adm) {
    return { status: 400, json: { success: false, code: "RETURN_SESSION_INVALID" } };
  }
  await tryAudit(pool, {
    actorUserId: adminId,
    action: "admin.impersonate.stop",
    entityType: "users",
    entityId: csr.user_id,
    metadata: { reason: "manual" },
  });
  const { password_hash: _dp, ...admPub } = adm;
  void _dp;
  return {
    status: 200,
    cacheControl: "no-store",
    setCookie: [buildAuthCookie(returnTok), clearAdminReturnCookie()],
    json: { success: true, user: publicUserFromRow(admPub) },
  };
}

type VisibleClientsPayload =
  | { all: true; codes: null; assignments: null }
  | {
      all: false;
      codes: string[];
      assignments: Array<{ code: string; responsibleUserId: string | null; teamId: string | null }>;
    };

type ClientAssignmentRow = {
  client_code: string;
  responsible_user_id: string | null;
  team_id: string | null;
};

async function buildVisibleClientsPayload(pool: PoolLike, row: DbUserRow): Promise<VisibleClientsPayload> {
  const role = row.role as UserRole;
  if (role === "admin" || role === "director" || role === "analyst" || role === "marketer") {
    return { all: true, codes: null, assignments: null };
  }
  if (role === "rop") {
    const q = await pool.query<ClientAssignmentRow>(
      `SELECT DISTINCT ON (ca.client_code) ca.client_code, ca.responsible_user_id, ca.team_id
       FROM client_assignments ca
       INNER JOIN teams t ON t.id = ca.team_id
       WHERE t.rop_user_id = $1::uuid
       ORDER BY ca.client_code`,
      [row.id],
    );
    const rows = q.rows;
    return {
      all: false,
      codes: rows.map((r) => r.client_code).filter(Boolean),
      assignments: rows.map((r) => ({
        code: r.client_code,
        responsibleUserId: r.responsible_user_id,
        teamId: r.team_id,
      })),
    };
  }
  if (role === "manager" || role === "regional_manager") {
    const q = await pool.query<ClientAssignmentRow>(
      `SELECT DISTINCT ON (client_code) client_code, responsible_user_id, team_id
       FROM client_assignments
       WHERE responsible_user_id = $1::uuid
       ORDER BY client_code`,
      [row.id],
    );
    const rows = q.rows;
    return {
      all: false,
      codes: rows.map((r) => r.client_code).filter(Boolean),
      assignments: rows.map((r) => ({
        code: r.client_code,
        responsibleUserId: r.responsible_user_id,
        teamId: r.team_id,
      })),
    };
  }
  return { all: false, codes: [], assignments: [] };
}

async function resolveSessionUserRow(
  headers: Record<string, string | string[] | undefined>,
): Promise<{ pool: PoolLike; row: DbUserRow } | null> {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) return null;
  const pool = getPool();
  if (!pool) return null;
  const hashHex = sha256Hex(token);
  const res = await pool.query<DbUserRow & { refresh_token_hash: string }>(
    `SELECT u.id, u.email, u.full_name, u.role, u.status, u.must_change_password, u.last_login_at,
            s.refresh_token_hash
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [hashHex],
  );
  const row = res.rows[0];
  if (!row || !timingSafeEqualHex(row.refresh_token_hash, token)) return null;
  return { pool, row };
}

async function handleMyVisibleCodes(headers: Record<string, string | string[] | undefined>): Promise<AuthResult> {
  const ctx = await resolveSessionUserRow(headers);
  if (!ctx) {
    return { status: 401, json: { success: false, code: "UNAUTHORIZED" } };
  }
  const payload = await buildVisibleClientsPayload(ctx.pool, ctx.row);
  return {
    status: 200,
    cacheControl: "no-store",
    json: { success: true, ...payload },
  };
}

async function handleMyOrgSnapshot(headers: Record<string, string | string[] | undefined>): Promise<AuthResult> {
  const ctx = await resolveSessionUserRow(headers);
  if (!ctx) {
    return { status: 401, json: { success: false, code: "UNAUTHORIZED" } };
  }
  const { pool, row } = ctx;
  const meId = row.id;
  const role = row.role as UserRole;
  const meFullName = (row.full_name ?? "").trim() || row.email;

  const teamsRes = await pool.query<{ id: string; name: string; rop_user_id: string | null; rop_name: string | null }>(
    `SELECT t.id, t.name, t.rop_user_id, u.full_name AS rop_name
     FROM teams t
     LEFT JOIN users u ON u.id = t.rop_user_id
     ORDER BY t.name`,
  );
  const allTeams = teamsRes.rows;

  const usersRes = await pool.query<{
    id: string;
    full_name: string | null;
    role: UserRole;
    status: UserStatus;
    team_id: string | null;
  }>(
    `SELECT u.id, u.full_name, u.role, u.status, utm.team_id
     FROM users u
     LEFT JOIN user_team_memberships utm ON utm.user_id = u.id
     WHERE u.status IN ('active', 'invited')`,
  );

  type Agg = { id: string; fullName: string; role: UserRole; status: UserStatus; teamIds: Set<string> };
  const userAgg = new Map<string, Agg>();
  for (const r of usersRes.rows) {
    const fn = (r.full_name ?? "").trim() || "";
    let agg = userAgg.get(r.id);
    if (!agg) {
      agg = { id: r.id, fullName: fn, role: r.role as UserRole, status: r.status as UserStatus, teamIds: new Set() };
      userAgg.set(r.id, agg);
    }
    if (r.team_id) agg.teamIds.add(r.team_id);
  }

  const ledTeamByRop = new Map<string, string>();
  for (const t of allTeams) {
    if (t.rop_user_id) ledTeamByRop.set(t.rop_user_id, t.id);
  }

  const utmMine = await pool.query<{ team_id: string }>(
    `SELECT team_id FROM user_team_memberships WHERE user_id = $1::uuid`,
    [meId],
  );
  const myUtmTeamIds = Array.from(new Set(utmMine.rows.map((r) => r.team_id).filter(Boolean)));

  let meTeamId: string | null = null;
  if (role === "rop") {
    meTeamId = ledTeamByRop.get(meId) ?? myUtmTeamIds[0] ?? null;
  } else if (role === "manager" || role === "regional_manager") {
    meTeamId = myUtmTeamIds[0] ?? null;
  }

  const vis = await buildVisibleClientsPayload(pool, row);

  const adminRes = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'admin' AND status IN ('active', 'invited')`,
  );
  const adminIds = new Set(adminRes.rows.map((r) => r.id));

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

  let teamsOut: typeof allTeams;

  if (vis.all) {
    visibility = {
      all: true,
      clientCodes: null,
      teamIds: allTeams.map((t) => t.id),
      visibleUserIds: Array.from(userAgg.keys()),
    };
    teamsOut = allTeams;
  } else if (role === "rop") {
    const myLedTeamIds = allTeams.filter((t) => t.rop_user_id === meId).map((t) => t.id);
    const vu = new Set<string>([meId, ...Array.from(adminIds)]);
    for (const id of Array.from(membersOfTeams(myLedTeamIds))) vu.add(id);
    visibility = {
      all: false,
      clientCodes: vis.codes,
      teamIds: myLedTeamIds,
      visibleUserIds: Array.from(vu),
    };
    const allowT = new Set(myLedTeamIds);
    teamsOut = allTeams.filter((t) => allowT.has(t.id));
  } else if (role === "manager" || role === "regional_manager") {
    const tid =
      meTeamId ??
      (vis.assignments[0]?.teamId as string | null | undefined) ??
      null;
    const teamRow = tid ? allTeams.find((t) => t.id === tid) : undefined;
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
    teamsOut = tid ? allTeams.filter((t) => t.id === tid) : [];
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
    teamsOut = allTeams.filter((t) => teamIdSet.has(t.id));
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

async function handleLogout(headers: Record<string, string | string[] | undefined>): Promise<AuthResult> {
  const ip = getClientIp(headers);
  const userAgent = readUserAgent(headers);
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  let sessionId: string | null = null;
  let actorUserId: string | null = null;
  try {
    const pool = getPool();
    if (token && pool) {
      const hashHex = sha256Hex(token);
      const res = await pool.query<{ id: string; refresh_token_hash: string; user_id: string }>(
        `SELECT id, refresh_token_hash, user_id FROM sessions
         WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
        [hashHex],
      );
      const row = res.rows[0];
      if (row && timingSafeEqualHex(row.refresh_token_hash, token)) {
        sessionId = row.id;
        actorUserId = row.user_id;
        await pool.query(`UPDATE sessions SET revoked_at = NOW() WHERE id = $1::uuid AND revoked_at IS NULL`, [
          row.id,
        ]);
      }
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/auth] logout", m.slice(0, 200));
  }
  const pool = getPool();
  if (pool) {
    await tryAudit(pool, {
      actorUserId: actorUserId,
      action: "auth.logout",
      entityType: "session",
      entityId: sessionId ?? "unknown",
      metadata: { ip, userAgent },
    });
  }
  return { status: 200, setCookie: [clearAuthCookie(), clearAdminReturnCookie()], json: { success: true } };
}

async function handleLogoutAll(headers: Record<string, string | string[] | undefined>): Promise<AuthResult> {
  const ip = getClientIp(headers);
  const userAgent = readUserAgent(headers);
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) {
    return { status: 401, json: { success: false, code: "UNAUTHENTICATED" } };
  }
  const pool = getPool();
  if (!pool) {
    return { status: 500, json: { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." } };
  }
  const hashHex = sha256Hex(token);
  const res = await pool.query<{ user_id: string; refresh_token_hash: string }>(
    `SELECT s.user_id, s.refresh_token_hash
     FROM sessions s
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [hashHex],
  );
  const row = res.rows[0];
  if (!row || !timingSafeEqualHex(row.refresh_token_hash, token)) {
    return { status: 401, json: { success: false, code: "UNAUTHENTICATED" } };
  }
  const userId = row.user_id;
  await pool.query(`UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1::uuid AND revoked_at IS NULL`, [
    userId,
  ]);
  await tryAudit(pool, {
    actorUserId: userId,
    action: "auth.logout_all",
    entityType: "user",
    entityId: userId,
    metadata: { ip, userAgent },
  });
  return {
    status: 200,
    cacheControl: "no-store",
    setCookie: [clearAuthCookie(), clearAdminReturnCookie()],
    json: { success: true },
  };
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
  if (req.method === "POST" && !enforceCsrfOrigin(req)) {
    sendJson(res, 403, {
      success: false,
      code: "CSRF_REJECTED",
      message: "Недопустимый источник запроса.",
    });
    return;
  }
  try {
    if (action === "login" && req.method === "POST") {
      applyResult(res, await handleLogin(req, headers));
      return;
    }
    if (action === "logout" && req.method === "POST") {
      applyResult(res, await handleLogout(headers));
      return;
    }
    if (action === "logout-all" && req.method === "POST") {
      applyResult(res, await handleLogoutAll(headers));
      return;
    }
    if (action === "me" && req.method === "GET") {
      applyResult(res, await handleMe(headers));
      return;
    }
    if (action === "impersonate-start" && req.method === "POST") {
      applyResult(res, await handleImpersonateStart(req, headers));
      return;
    }
    if (action === "impersonate-stop" && req.method === "POST") {
      applyResult(res, await handleImpersonateStop(headers));
      return;
    }
    if (action === "my-visible-codes" && req.method === "GET") {
      applyResult(res, await handleMyVisibleCodes(headers));
      return;
    }
    if (action === "my-org-snapshot" && req.method === "GET") {
      applyResult(res, await handleMyOrgSnapshot(headers));
      return;
    }
    if (action === "reset-request-approvers" && req.method === "POST") {
      const pool = getPool();
      if (!pool) {
        sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
        return;
      }
      await handleResetRequestApprovers(req, res, pool, headers);
      return;
    }
    if (action === "reset-request-create" && req.method === "POST") {
      const pool = getPool();
      if (!pool) {
        sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
        return;
      }
      await handleResetRequestCreate(req, res, pool, headers);
      return;
    }
    if (action === "password-reset-link-redeem" && req.method === "POST") {
      const pool = getPool();
      if (!pool) {
        sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
        return;
      }
      await handlePasswordResetLinkRedeem(req, res, pool);
      return;
    }
    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный маршрут auth API.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/auth]", action, m.slice(0, 200));
    try {
      if (!res.headersSent && !res.writableEnded) {
        sendJson(res, 500, {
          success: false,
          code: "INTERNAL_ERROR",
          message: "Внутренняя ошибка сервера.",
        });
      }
    } catch {
      /* ignore */
    }
  }
}
