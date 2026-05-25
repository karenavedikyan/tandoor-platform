/**
 * Vercel Serverless: `/api/auth/:action` (login | logout | logout-all | me).
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

/**
 * Neon HTTP driver shim that mimics the subset of pg.Pool API used in this file:
 *   pool.query<T>(text, params?) → { rows: T[] }
 *
 * Reason: @vercel/node serverless runtime has no native WebSocket, so the Pool
 * driver (WebSocket-based) cannot connect ("All attempts to open a WebSocket
 * to connect to the database failed"). neon() uses HTTPS and works everywhere.
 * See api/actualization/state.ts for the same pattern.
 */
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

const AUTH_COOKIE = "tandoor_auth_sess";
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

function buildAuthCookie(refreshToken: string): string {
  const maxAgeSec = sessionTtlSeconds();
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
  setCookie?: string;
  cacheControl?: "no-store";
  retryAfterSec?: number;
};

function applyResult(res: VercelResponse, r: AuthResult): void {
  res.setHeader("Content-Type", JSON_CT);
  if (r.cacheControl) res.setHeader("Cache-Control", r.cacheControl);
  if (r.retryAfterSec !== undefined) res.setHeader("Retry-After", String(r.retryAfterSec));
  if (r.setCookie) res.setHeader("Set-Cookie", r.setCookie);
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
  if (!row || !timingSafeEqualHex(row.refresh_token_hash, token)) {
    return { status: 401, json: { success: false, code: "UNAUTHENTICATED" } };
  }
  const { refresh_token_hash: _h, ...u } = row;
  return {
    status: 200,
    cacheControl: "no-store",
    json: { success: true, user: publicUserFromRow(u) },
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
  return { status: 200, setCookie: clearAuthCookie(), json: { success: true } };
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
    setCookie: clearAuthCookie(),
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
