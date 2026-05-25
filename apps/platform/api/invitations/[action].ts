/**
 * Vercel Serverless: `/api/invitations/:action` (create | list | accept | revoke | preview).
 *
 * Self-contained: только `@vercel/node`, `@neondatabase/serverless`, `bcryptjs`, `node:crypto`.
 * Логика продублирована из `server/auth/invitations-handlers.ts`.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

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

const INVITER_CAN_INVITE: Record<UserRole, UserRole[]> = {
  director: ["rop", "regional_manager", "manager", "marketer", "analyst"],
  rop: ["regional_manager", "manager"],
  regional_manager: ["manager"],
  manager: [],
  marketer: [],
  analyst: [],
  admin: ["director", "rop", "regional_manager", "manager", "marketer", "analyst"],
};

const JSON_CT = "application/json; charset=utf-8";
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
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

function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

type DbUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  must_change_password: boolean;
  last_login_at: string | null;
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
    console.error("[api/invitations] audit", input.action, m.slice(0, 200));
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

async function resolveCurrentUser(
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<DbUserRow | null> {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) return null;
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
  const { refresh_token_hash: _h, ...u } = row;
  return u;
}

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>, setCookie?: string): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  if (setCookie) res.setHeader("Set-Cookie", setCookie);
  res.status(status).json(body);
}

function inviterMayInviteRole(inviter: UserRole, target: UserRole): boolean {
  return (INVITER_CAN_INVITE[inviter] ?? []).includes(target);
}

function isStrongEnough(plain: string, emailForCompare?: string): { ok: true } | { ok: false; reason: string } {
  const t = plain.trim();
  if (!t) return { ok: false, reason: "Пароль не может быть пустым." };
  if (t.length < 8) return { ok: false, reason: "Пароль должен быть не короче 8 символов." };
  if (emailForCompare?.trim()) {
    const e = emailForCompare.trim().toLowerCase();
    if (t.toLowerCase() === e) return { ok: false, reason: "Пароль не должен совпадать с email." };
  }
  return { ok: true };
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

async function handleCreate(
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

  const body = req.body as {
    email?: unknown;
    role?: unknown;
    teamId?: unknown;
    fullName?: unknown;
  };
  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const roleRaw = typeof body.role === "string" ? body.role.trim() : "";
  const teamId =
    body.teamId === null || body.teamId === undefined || body.teamId === ""
      ? null
      : typeof body.teamId === "string"
        ? body.teamId.trim()
        : null;
  const fullNameOpt =
    typeof body.fullName === "string" && body.fullName.trim() ? body.fullName.trim().slice(0, 120) : null;

  if (!rawEmail || !SIMPLE_EMAIL_RE.test(rawEmail)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный email." });
    return;
  }
  if (!BUSINESS_ROLES.includes(roleRaw as UserRole)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Недопустимая роль." });
    return;
  }
  const targetRole = roleRaw as UserRole;
  if (!inviterMayInviteRole(me.role as UserRole, targetRole)) {
    sendJson(res, 403, {
      success: false,
      code: "FORBIDDEN_ROLE",
      message: "Эта роль недоступна для приглашения.",
    });
    return;
  }
  if (fullNameOpt != null && (fullNameOpt.length < 1 || fullNameOpt.length > 120)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "ФИО: от 1 до 120 символов." });
    return;
  }
  if (teamId != null && !UUID_RE.test(teamId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный идентификатор команды." });
    return;
  }

  const taken = await pool.query<{ id: string }>(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [rawEmail]);
  if (taken.rows.length > 0) {
    sendJson(res, 409, {
      success: false,
      code: "EMAIL_TAKEN",
      message: "Пользователь с таким email уже существует.",
    });
    return;
  }

  const pend = await pool.query<{ id: string }>(
    `SELECT id FROM invitations WHERE email = $1 AND expires_at > NOW() AND accepted_at IS NULL LIMIT 1`,
    [rawEmail],
  );
  if (pend.rows.length > 0) {
    sendJson(res, 409, {
      success: false,
      code: "ALREADY_INVITED",
      message: "Приглашение уже отправлено.",
    });
    return;
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(rawToken);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  await pool.query(
    `INSERT INTO invitations (id, email, role, team_id, invited_by, token_hash, expires_at, accepted_at)
     VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6, $7::timestamptz, NULL)`,
    [id, rawEmail, targetRole, teamId, me.id, tokenHash, expiresAt],
  );

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "auth.invitation.create",
    entityType: "invitation",
    entityId: id,
    metadata: { email: rawEmail, role: targetRole, teamId: teamId ?? undefined, fullName: fullNameOpt ?? undefined },
  });

  const host = typeof headers.host === "string" ? headers.host : Array.isArray(headers.host) ? headers.host[0] : "";
  const baseUrl = process.env.PUBLIC_BASE_URL?.trim() || `https://${host || "localhost"}`;
  const acceptUrl = `${baseUrl.replace(/\/$/, "")}/invite/${rawToken}`;

  sendJson(res, 200, {
    success: true,
    invitation: {
      id,
      email: rawEmail,
      role: targetRole,
      teamId: teamId,
      expiresAt,
      acceptUrl,
    },
  });
}

async function handleList(
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }

  const rows = await pool.query<{
    id: string;
    email: string;
    role: string;
    team_id: string | null;
    expires_at: string;
    accepted_at: string | null;
  }>(
    `SELECT id, email, role, team_id, expires_at, accepted_at FROM invitations
     WHERE invited_by = $1::uuid ORDER BY expires_at DESC`,
    [me.id],
  );

  const now = Date.now();
  const list = rows.rows.map((r) => {
    const ex = new Date(r.expires_at).getTime();
    const acc = r.accepted_at != null;
    let status: "pending" | "accepted" | "expired";
    if (acc) status = "accepted";
    else if (!Number.isFinite(ex) || ex <= now) status = "expired";
    else status = "pending";
    const createdAt = new Date(ex - INVITE_TTL_MS).toISOString();
    return {
      id: r.id,
      email: r.email,
      role: r.role,
      teamId: r.team_id,
      createdAt,
      expiresAt: r.expires_at,
      acceptedAt: r.accepted_at,
      status,
    };
  });

  sendJson(res, 200, { success: true, invitations: list });
}

async function handleRevoke(
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

  const body = req.body as { id?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || !UUID_RE.test(id)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите идентификатор приглашения." });
    return;
  }

  const sel = await pool.query<{ id: string; invited_by: string; accepted_at: string | null }>(
    `SELECT id, invited_by, accepted_at FROM invitations WHERE id = $1::uuid LIMIT 1`,
    [id],
  );
  const row = sel.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Приглашение не найдено." });
    return;
  }
  if (me.role !== "admin" && row.invited_by !== me.id) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (row.accepted_at != null) {
    sendJson(res, 409, {
      success: false,
      code: "ALREADY_ACCEPTED",
      message: "Приглашение уже принято.",
    });
    return;
  }

  const nowIso = new Date().toISOString();
  await pool.query(`UPDATE invitations SET expires_at = $1::timestamptz WHERE id = $2::uuid`, [nowIso, id]);

  await tryAudit(pool, {
    actorUserId: me.id,
    action: "auth.invitation.revoke",
    entityType: "invitation",
    entityId: id,
    metadata: {},
  });

  sendJson(res, 200, { success: true });
}

async function handlePreview(req: VercelRequest, res: VercelResponse, pool: PoolLike): Promise<void> {
  const qraw = req.query?.token;
  const q = typeof qraw === "string" ? qraw.trim() : Array.isArray(qraw) && typeof qraw[0] === "string" ? qraw[0]!.trim() : "";
  if (!q || q.length < 30 || q.length > 200) {
    sendJson(res, 400, { success: false, code: "INVALID_TOKEN", message: "Некорректная ссылка приглашения." });
    return;
  }

  const hash = sha256Hex(q);
  const rows = await pool.query<{
    id: string;
    email: string;
    role: string;
    team_id: string | null;
    expires_at: string;
    accepted_at: string | null;
    token_hash: string;
  }>(
    `SELECT id, email, role, team_id, expires_at, accepted_at, token_hash FROM invitations WHERE token_hash = $1 LIMIT 1`,
    [hash],
  );
  const row = rows.rows[0];
  if (!row || !timingSafeEqualHex(row.token_hash, q)) {
    sendJson(res, 404, { success: false, code: "INVALID_TOKEN", message: "Приглашение не найдено." });
    return;
  }
  const now = Date.now();
  const ex = new Date(row.expires_at).getTime();
  if (row.accepted_at != null) {
    sendJson(res, 410, { success: false, code: "ALREADY_ACCEPTED", message: "Приглашение уже использовано." });
    return;
  }
  if (!Number.isFinite(ex) || ex <= now) {
    sendJson(res, 410, { success: false, code: "EXPIRED", message: "Срок действия приглашения истёк." });
    return;
  }

  sendJson(res, 200, {
    success: true,
    email: row.email,
    role: row.role,
    teamId: row.team_id,
    fullName: null,
    expiresAt: row.expires_at,
  });
}

async function handleAccept(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const body = req.body as { token?: unknown; fullName?: unknown; password?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullNameRaw = typeof body.fullName === "string" ? body.fullName.trim() : "";

  if (!token || token.length < 30 || token.length > 200) {
    sendJson(res, 400, { success: false, code: "INVALID_TOKEN", message: "Некорректная ссылка приглашения." });
    return;
  }
  if (password.length < 8) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Пароль не короче 8 символов." });
    return;
  }
  const strength = isStrongEnough(password);
  if (!strength.ok) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: strength.reason });
    return;
  }
  const effectiveFullName = fullNameRaw || null;
  if (!effectiveFullName) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите ФИО." });
    return;
  }

  const ip = getClientIp(headers);
  const userAgent = readUserAgent(headers);

  const hash = sha256Hex(token);
  const invRes = await pool.query<{
    id: string;
    email: string;
    role: string;
    team_id: string | null;
    expires_at: string;
    accepted_at: string | null;
    token_hash: string;
  }>(
    `SELECT id, email, role, team_id, expires_at, accepted_at, token_hash FROM invitations WHERE token_hash = $1 LIMIT 1`,
    [hash],
  );
  const inv = invRes.rows[0];
  if (!inv || !timingSafeEqualHex(inv.token_hash, token)) {
    sendJson(res, 400, { success: false, code: "INVALID_TOKEN", message: "Приглашение не найдено." });
    return;
  }
  const now = Date.now();
  const ex = new Date(inv.expires_at).getTime();
  if (inv.accepted_at != null) {
    sendJson(res, 410, { success: false, code: "ALREADY_ACCEPTED", message: "Приглашение уже использовано." });
    return;
  }
  if (!Number.isFinite(ex) || ex <= now) {
    sendJson(res, 410, { success: false, code: "EXPIRED", message: "Срок действия приглашения истёк." });
    return;
  }

  const emailLower = inv.email.toLowerCase();
  const pwHash = await bcrypt.hash(password, 12);

  const exUser = await pool.query<{ id: string; status: string }>(
    `SELECT id, status FROM users WHERE email = $1 LIMIT 1`,
    [emailLower],
  );

  let userId: string;
  let snapshot: DbUserRow;

  if (exUser.rows.length > 0) {
    const u = exUser.rows[0]!;
    if (u.status !== "invited") {
      sendJson(res, 409, {
        success: false,
        code: "EMAIL_TAKEN",
        message: "Пользователь с таким email уже существует.",
      });
      return;
    }
    userId = u.id;
    const up = await pool.query<DbUserRow>(
      `UPDATE users SET full_name = $1, role = $2, status = 'active', password_hash = $3,
         must_change_password = false, updated_at = NOW()
       WHERE id = $4::uuid
       RETURNING id, email, full_name, role, status, must_change_password, last_login_at`,
      [effectiveFullName, inv.role, pwHash, userId],
    );
    snapshot = up.rows[0]!;
  } else {
    userId = randomUUID();
    const ins = await pool.query<DbUserRow>(
      `INSERT INTO users (id, email, full_name, role, status, password_hash, must_change_password, phone, created_by)
       VALUES ($1::uuid, $2, $3, $4, 'active', $5, false, NULL, NULL)
       RETURNING id, email, full_name, role, status, must_change_password, last_login_at`,
      [userId, emailLower, effectiveFullName, inv.role, pwHash],
    );
    snapshot = ins.rows[0]!;
  }

  if (inv.team_id) {
    try {
      await pool.query(
        `INSERT INTO user_team_memberships (user_id, team_id, role_in_team)
         VALUES ($1::uuid, $2::uuid, $3) ON CONFLICT DO NOTHING`,
        [userId, inv.team_id, inv.role],
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[api/invitations] membership", m.slice(0, 200));
    }
  }

  await pool.query(`UPDATE invitations SET accepted_at = NOW() WHERE id = $1::uuid`, [inv.id]);

  await tryAudit(pool, {
    actorUserId: userId,
    action: "auth.invitation.accept",
    entityType: "invitation",
    entityId: inv.id,
    metadata: { invitationId: inv.id },
  });

  let lastLoginAt: string | null = snapshot.last_login_at;
  try {
    const up2 = await pool.query<{ last_login_at: string }>(
      `UPDATE users SET last_login_at = NOW() WHERE id = $1::uuid RETURNING last_login_at`,
      [userId],
    );
    const v = up2.rows[0]?.last_login_at;
    if (v != null) lastLoginAt = v;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/invitations] accept lastLoginAt", m.slice(0, 200));
  }

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = sha256Hex(refreshToken);
  const sessionId = randomUUID();
  const ttlSec = sessionTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();

  await pool.query(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip, expires_at, revoked_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, NULL)`,
    [sessionId, userId, refreshTokenHash, userAgent, ip, expiresAt],
  );

  await tryAudit(pool, {
    actorUserId: userId,
    action: "auth.login",
    entityType: "session",
    entityId: sessionId,
    metadata: { ip, userAgent, via: "invitation_accept" },
  });

  const snap2 = { ...snapshot, last_login_at: lastLoginAt };

  sendJson(res, 200, { success: true, user: publicUserFromRow(snap2) }, buildAuthCookie(refreshToken));
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

    if (action === "create" && req.method === "POST") {
      await handleCreate(req, res, pool, headers);
      return;
    }
    if (action === "list" && req.method === "GET") {
      await handleList(res, pool, headers);
      return;
    }
    if (action === "revoke" && req.method === "POST") {
      await handleRevoke(req, res, pool, headers);
      return;
    }
    if (action === "accept" && req.method === "POST") {
      await handleAccept(req, res, pool, headers);
      return;
    }
    if (action === "preview" && req.method === "GET") {
      await handlePreview(req, res, pool);
      return;
    }

    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный маршрут invitations API.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/invitations]", action, m.slice(0, 200));
    try {
      if (!res.headersSent && !res.writableEnded) {
        sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    } catch {
      /* ignore */
    }
  }
}
