/**
 * Vercel Serverless: `/api/admin/:action` (users-list | … | onboarding-status | onboarding-complete | profile-telegram-link-token | profile-get-self | profile-update-self | profile-change-password). In-memory rate limits (Hobby) для отдельных admin-операций: см. handleUsersResetPassword / handleProfileChangePassword. Лимит логина перенесён в таблицу auth_login_failures (см. docs/auth.md).
 *
 * Self-contained: только `@vercel/node`, `@neondatabase/serverless`, `bcryptjs`, `node:crypto`.
 * Контракт совпадает с `server/admin/users-handlers.ts`, `server/admin-routes.ts`, `server/profile-routes.ts`.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { handleTeamsList } from "../../shared/admin/client-assignments-handlers.js";
import {
  MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE,
  UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE,
  applyMergePlanToState,
  buildManagerMergePlan,
  type ManualMergePlan,
} from "../../shared/admin/actualization-dedupe.js";
import {
  applyContactMigrationPlan,
  buildContactMigrationPlanForState,
  type ContactMigrationPlan,
} from "../../shared/admin/contacts-migration.js";
import { makePoolFromNeon, type PoolLike } from "../../server/db/neon-client.js";
import { buildTradePointsOverviewFromDb, type TradePointsOverviewViewerTeam } from "../../shared/trade-points-overview-db.js";
import { computeDbScopeForUser, DEALER_OVERRIDE_JOIN, TRADE_POINT_OVERRIDE_JOIN } from "../../shared/db-scope-formula.js";
import { dealerJoinStatusActive, tpJoinStatusActive } from "../../shared/record-status.js";
import {
  fetchScopedTradePointsRows,
  mapScopedTradePointRow,
} from "../../shared/trade-points-list-scoped-handlers.js";
import {
  effectiveClientListStatus,
  mergeClientBaseClientsList,
  resolveClientExternalKey,
  type ClientBaseActualizationClient,
  type ClientBaseCatalogDealerMeta,
} from "../../shared/client-base-clients-list-merge.js";
import { filterManagerDetailByRopViewerScope, shouldIntersectManagerDetailWithRopViewerScope } from "../../shared/trade-points-manager-detail-scope.js";

type UserRole =
  | "director"
  | "rop"
  | "regional_manager"
  | "manager"
  | "marketer"
  | "analyst"
  | "category_manager"
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
  analyst: new Set<Permission>([
    "profile.read_self",
    "profile.update_self",
    "audit.read",
    "sessions.read_self",
    "sessions.revoke_self",
  ]),
  category_manager: new Set<Permission>([
    "profile.read_self",
    "profile.update_self",
    "sessions.read_self",
    "sessions.revoke_self",
  ]),
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

/** Иерархия одобряющих self-service «Забыли пароль?» (SYNC: shared/auth-rbac.ts). */
function approverRolesFor(role: UserRole): UserRole[] {
  if (role === "admin") return [];
  if (role === "director") return ["admin"];
  if (role === "rop") return ["director"];
  return ["rop", "director"];
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
const MGR_TO_UUID: Record<string, string> = {
  "mgr-boyko-em": "dc3b6ef1-fd83-4b9b-b73f-982efe08af23",
  "mgr-yakubova-ys": "0481a81d-160b-422e-8257-cf21d134cd42",
  "mgr-fedorov-dv": "f824e678-951d-45c0-9fa8-b97d27f5ad0d",
  "mgr-ponkratova-vv": "4615c9b1-5d5f-4832-85ff-60b8da50e567",
  "mgr-avetisyan-rs": "d80c495f-5229-4ccd-bd2a-14e4301361de",
  "mgr-sklyarov-dv": "dc958e02-d80e-4615-bb8a-8a46be70daed",
  "mgr-orlov-dv": "1526ab0b-db39-4957-887b-056b6549ad62",
  "mgr-agadzhanyan-rs": "9c686222-eebd-46ee-bf6d-d560e8901d04",
  "mgr-doronina-iv": "eae85849-6fea-4bf6-9eee-81bd175c4391",
  "mgr-ilyuchenko-an": "e60f1a83-88ae-41f8-8c32-edd91f666e8d",
  "mgr-miroshnichenko-dn": "c3dca970-b32f-4b23-b3d6-2911250fe81e",
  "mgr-lysenko-eg": "9e6056c9-9c8c-477b-94fd-45dab490e382",
  "mgr-kulakova-os": "6f1ed04c-18a8-412d-a4db-efa8ed2258d6",
  "mgr-koteneva-av": "f2aaf964-37d0-4b8d-b40a-38eb2428fb52",
  "mgr-netkacheva-ia": "2f85e5b1-0633-45d9-9672-72417cd1daa2",
  "mgr-petrichenko-ev": "88518eda-2986-48ad-93e3-92f5f554b54f",
  "mgr-arutyunyan-oa": "3c88c879-81d2-4403-ae2e-67be8e782650",
  "mgr-osmanov-fm": "7168496a-6d43-4471-86cb-8050e7a4e5a1",
  "mgr-chernousova-in": "62dcd67c-d66c-40c6-a349-c71e6e8493c4",
  "mgr-yarysh-si": "f5aad585-f020-4410-a147-36d6ca5d3886",
  "mgr-avedikyan-ka": "fb589859-1858-4725-ae74-d7a6de92ffbe",
};

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
  const allowed = new Set<string>([
    "https://tandoor-platform.vercel.app",
    "https://lk.tandoor.ru",
  ]);
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

function actualizationEmptyState(): Record<string, unknown> {
  return {
    version: 1,
    updatedAt: null,
    updatedBy: null,
    dealerOverridesById: {},
    manuallyCreatedDealersById: {},
    tradePointOverridesById: {},
    manuallyCreatedTradePointsById: {},
    archivedLegalEntitiesById: {},
    legalEntityOverridesByDealerId: {},
    dealerCardViewSettingsByUserId: {},
    unloadingOrderByDealerId: {},
    routeOrderByRouteId: {},
    dealerPhotosByDealerId: {},
    tradePointPhotosByTradePointId: {},
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function coerceActualizationState(input: unknown): Record<string, unknown> {
  const base = actualizationEmptyState();
  if (!isPlainObject(input)) return base;
  const merged = { ...base, ...input };
  if (typeof merged.version !== "number" || !Number.isFinite(merged.version)) merged.version = 1;
  for (const k of Object.keys(base)) {
    if (k === "version" || k === "updatedAt" || k === "updatedBy") continue;
    if (isPlainObject(merged[k])) continue;
    merged[k] = base[k];
  }
  return merged;
}

function mergeActualizationStates(states: Record<string, unknown>[]): Record<string, unknown> {
  const result = actualizationEmptyState();
  let maxUpdatedAt: string | null = null;

  for (const state of states) {
    const updatedAt = state.updatedAt;
    if (typeof updatedAt === "string" && (!maxUpdatedAt || updatedAt > maxUpdatedAt)) {
      maxUpdatedAt = updatedAt;
    }
  }

  result.updatedAt = maxUpdatedAt;
  result.updatedBy = typeof states[0]?.updatedBy === "string" ? states[0].updatedBy : null;

  const base = actualizationEmptyState();
  for (const field of Object.keys(base)) {
    if (field === "version" || field === "updatedAt" || field === "updatedBy") continue;
    const target = result[field];
    if (!isPlainObject(target)) continue;

    for (const state of states) {
      const value = state[field];
      if (!isPlainObject(value)) continue;
      for (const id of Object.keys(value)) {
        if (!(id in target)) {
          target[id] = value[id];
        }
      }
    }
  }

  return result;
}

function sanitizeLikeFragment(raw: string): string {
  return raw.replace(/[%_\\]/g, "");
}

async function ropCanAccessUser(pool: PoolLike, targetUserId: string, ropUserId: string): Promise<boolean> {
  const allowed = await pool.query<{ ok: boolean }>(
    `SELECT (
       $1::uuid = $2::uuid
       OR EXISTS (
         SELECT 1
           FROM user_team_memberships utm
           JOIN teams t ON t.id = utm.team_id
          WHERE utm.user_id = $1::uuid AND t.rop_user_id = $2::uuid
       )
     ) AS ok`,
    [targetUserId, ropUserId],
  );
  return Boolean(allowed.rows[0]?.ok);
}

async function denyIfRopCannotAccessUser(
  res: VercelResponse,
  pool: PoolLike,
  me: DbUserRow,
  targetUserId: string,
): Promise<boolean> {
  if (me.role !== "rop") return false;
  const allowed = await ropCanAccessUser(pool, targetUserId, me.id);
  if (allowed) return false;
  sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
  return true;
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
  // Скоуп выдачи для РОПа: только пользователи его команд + он сам.
  if (me.role === "rop") {
    conds.push(`(
      id = $${pi}::uuid
      OR id IN (
        SELECT utm.user_id
          FROM user_team_memberships utm
          JOIN teams t ON t.id = utm.team_id
         WHERE t.rop_user_id = $${pi}::uuid
      )
    )`);
    params.push(me.id);
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
  if (await denyIfRopCannotAccessUser(res, pool, me, id)) return;

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
  if (await denyIfRopCannotAccessUser(res, pool, me, id)) return;
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
  if (await denyIfRopCannotAccessUser(res, pool, me, id)) return;
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
  if (await denyIfRopCannotAccessUser(res, pool, me, id)) return;
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
  if (await denyIfRopCannotAccessUser(res, pool, me, userId)) return;

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
  for (const k of ["role", "status", "password"]) {
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
  const hasEmail = Object.prototype.hasOwnProperty.call(body, "email");
  if (!hasFull && !hasPhone && !hasEmail) {
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

  const emailSelfRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let emailPresent = false;
  let emailValue: string | null = null;
  if (hasEmail) {
    emailPresent = true;
    if (typeof body.email !== "string") {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный email." });
      return;
    }
    const em = body.email.trim().toLowerCase();
    if (!emailSelfRe.test(em)) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите корректный email." });
      return;
    }
    emailValue = em;
  }

  if (emailPresent && emailValue != null) {
    const dup = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2::uuid LIMIT 1`,
      [emailValue, me.id],
    );
    if (dup.rows[0]) {
      sendJson(res, 409, { success: false, code: "CONFLICT", message: "Этот email уже занят." });
      return;
    }
  }

  const up = await pool.query<DbUserRow>(
    `UPDATE users
       SET full_name = COALESCE($1::text, full_name),
           phone = CASE WHEN $2::boolean THEN $3::text ELSE phone END,
           email = CASE WHEN $4::boolean THEN $5::text ELSE email END,
           updated_at = NOW()
     WHERE id = $6::uuid
     RETURNING id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at, telegram_user_id`,
    [fullNameParam, phonePresent, phoneValue ?? null, emailPresent, emailValue ?? null, me.id],
  );
  const u = up.rows[0];
  if (!u) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  const fields: string[] = [];
  if (hasFull) fields.push("fullName");
  if (hasPhone) fields.push("phone");
  if (hasEmail) fields.push("email");

  if (hasEmail && emailValue != null) {
    await tryAudit(pool, {
      actorUserId: me.id,
      action: "user.email.changed",
      entityType: "user",
      entityId: me.id,
      metadata: { oldEmail: me.email.trim().toLowerCase(), newEmail: emailValue, source: "self" },
    });
  }

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

async function handleOnboardingStatus(
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

  const ures = await pool.query<{
    must_change_password: boolean;
    email: string;
    phone: string | null;
    full_name: string;
    telegram_user_id: string | null;
    onboarding_completed_at: string | null;
  }>(
    `SELECT must_change_password, email, phone, full_name, telegram_user_id, onboarding_completed_at
     FROM users WHERE id = $1::uuid LIMIT 1`,
    [me.id],
  );
  const row = ures.rows[0];
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
    return;
  }

  const emailLower = row.email.trim().toLowerCase();
  const profileNeedsUpdate =
    emailLower.endsWith("@tandoor.local") || row.phone == null || row.phone.trim() === "" || row.full_name.trim() === "";

  const telegramLinked = row.telegram_user_id != null && String(row.telegram_user_id).trim() !== "";

  sendJson(res, 200, {
    success: true,
    mustChangePassword: row.must_change_password,
    profileNeedsUpdate,
    telegramLinked,
    completedAt: row.onboarding_completed_at ?? null,
  });
}

async function handleOnboardingComplete(
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

  const up = await pool.query<{ onboarding_completed_at: string | null }>(
    `UPDATE users SET onboarding_completed_at = NOW(), updated_at = NOW()
     WHERE id = $1::uuid AND onboarding_completed_at IS NULL
     RETURNING onboarding_completed_at`,
    [me.id],
  );
  const done = up.rows[0];
  if (done?.onboarding_completed_at) {
    await tryAudit(pool, {
      actorUserId: me.id,
      action: "user.onboarding.completed",
      entityType: "user",
      entityId: me.id,
      metadata: {},
    });
  }

  sendJson(res, 200, { success: true });
}

async function handleProfileTelegramLinkToken(
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

  const rawTok = randomBytes(24).toString("base64url");
  const tokenHash = sha256Hex(rawTok);
  const ins = await pool.query<{ expires_at: string }>(
    `INSERT INTO telegram_link_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2::uuid, NOW() + interval '15 minutes')
     RETURNING expires_at`,
    [tokenHash, me.id],
  );
  const row = ins.rows[0];
  if (!row) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }

  sendJson(res, 200, {
    success: true,
    botUrl: `https://t.me/Tandoor_ibot?start=link_${rawTok}`,
    expiresAt: row.expires_at,
  });
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



const PRR_DIRECTOR_SEES_REQUESTER_ROLES: UserRole[] = ["rop", "regional_manager", "manager", "marketer", "analyst"];

function resetRequestRowVisibleToViewer(
  me: DbUserRow,
  row: { approver_user_id: string | null; requester_role: string },
): boolean {
  if (me.role === "admin") return true;
  if (me.role === "rop") return row.approver_user_id === me.id;
  if (me.role === "director") {
    return row.approver_user_id === me.id || PRR_DIRECTOR_SEES_REQUESTER_ROLES.includes(row.requester_role as UserRole);
  }
  return false;
}

function parseResetRequestsQuery(req: VercelRequest): { status: string; limit: number } {
  const q = req.query ?? {};
  const qs = (v: unknown): string | undefined => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0]!.trim();
    return undefined;
  };
  const st = qs(q.status) ?? "pending";
  const limitRaw = qs(q.limit);
  let limit = Number.parseInt(limitRaw || "50", 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  return { status: st, limit };
}

async function handleResetRequestsList(
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
  if (me.role !== "admin" && me.role !== "director" && me.role !== "rop") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  try {
    await pool.query(
      `UPDATE password_reset_requests SET status = 'expired', resolved_at = NOW() WHERE status = 'pending' AND expires_at < NOW()`,
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] reset-requests-list expire sweep", m.slice(0, 200));
  }
  const { status: statusFilter, limit } = parseResetRequestsQuery(req);
  const allowedStatus = new Set(["pending", "approved", "declined", "expired", "cancelled"]);
  const st = allowedStatus.has(statusFilter) ? statusFilter : "pending";
  try {
    let rows: Array<{
      id: string;
      requester_user_id: string;
      requester_full_name: string;
      requester_email: string;
      requester_role: string;
      status: string;
      created_at: string;
      expires_at: string;
    }>;
    if (me.role === "admin") {
      const r = await pool.query(
        `SELECT r.id, r.requester_user_id, u.full_name AS requester_full_name, u.email AS requester_email, u.role AS requester_role,
                r.status, r.created_at, r.expires_at
         FROM password_reset_requests r
         INNER JOIN users u ON u.id = r.requester_user_id
         WHERE r.status = $1
         ORDER BY r.created_at DESC
         LIMIT $2`,
        [st, limit],
      );
      rows = r.rows as typeof rows;
    } else if (me.role === "director") {
      const r = await pool.query(
        `SELECT r.id, r.requester_user_id, u.full_name AS requester_full_name, u.email AS requester_email, u.role AS requester_role,
                r.status, r.created_at, r.expires_at
         FROM password_reset_requests r
         INNER JOIN users u ON u.id = r.requester_user_id
         WHERE r.status = $1
           AND (r.approver_user_id = $2::uuid OR u.role = ANY($3::text[]))
         ORDER BY r.created_at DESC
         LIMIT $4`,
        [st, me.id, PRR_DIRECTOR_SEES_REQUESTER_ROLES, limit],
      );
      rows = r.rows as typeof rows;
    } else {
      const r = await pool.query(
        `SELECT r.id, r.requester_user_id, u.full_name AS requester_full_name, u.email AS requester_email, u.role AS requester_role,
                r.status, r.created_at, r.expires_at
         FROM password_reset_requests r
         INNER JOIN users u ON u.id = r.requester_user_id
         WHERE r.status = $1 AND r.approver_user_id = $2::uuid
         ORDER BY r.created_at DESC
         LIMIT $3`,
        [st, me.id, limit],
      );
      rows = r.rows as typeof rows;
    }
    sendJson(res, 200, {
      success: true,
      items: rows.map((x) => ({
        id: x.id,
        requesterId: x.requester_user_id,
        requesterFullName: x.requester_full_name,
        requesterEmail: x.requester_email,
        requesterRole: x.requester_role,
        status: x.status,
        createdAt: x.created_at,
        expiresAt: x.expires_at,
      })),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] reset-requests-list", m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

async function handleResetRequestApprove(
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
  if (me.role !== "admin" && me.role !== "director" && me.role !== "rop") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = (req.body ?? {}) as { id?: unknown; mode?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const modeRaw = typeof body.mode === "string" ? body.mode.trim() : "link";
  if (!id || !UUID_RE.test(id)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный идентификатор запроса." });
    return;
  }
  if (modeRaw !== "link") {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Поддерживается только mode=link." });
    return;
  }
  try {
    const sel = await pool.query<{
      id: string;
      requester_user_id: string;
      approver_user_id: string | null;
      status: string;
      expires_at: string;
      requester_role: string;
    }>(
      `SELECT r.id, r.requester_user_id, r.approver_user_id, r.status, r.expires_at, u.role AS requester_role
       FROM password_reset_requests r
       INNER JOIN users u ON u.id = r.requester_user_id
       WHERE r.id = $1::uuid
       LIMIT 1`,
      [id],
    );
    const row = sel.rows[0];
    if (!row || !resetRequestRowVisibleToViewer(me, { approver_user_id: row.approver_user_id, requester_role: row.requester_role })) {
      sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запрос недоступен." });
      return;
    }
    const expMs = Date.parse(row.expires_at);
    const notExpired = Number.isFinite(expMs) && expMs > Date.now();
    const actorOk = me.role === "admin" || row.approver_user_id === me.id;
    if (row.status !== "pending" || !notExpired || !actorOk) {
      sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запрос недоступен." });
      return;
    }
    const targetUserId = row.requester_user_id;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256Hex(token);
    await pool.query(
      `UPDATE password_reset_links SET used_at = NOW(), used_ip = 'superseded' WHERE user_id = $1::uuid AND used_at IS NULL`,
      [targetUserId],
    );
    const ins = await pool.query<{ id: string; expires_at: string }>(
      `INSERT INTO password_reset_links (user_id, token_hash, created_by, expires_at)
       VALUES ($1::uuid, $2, $3::uuid, NOW() + interval '60 minutes')
       RETURNING id, expires_at`,
      [targetUserId, tokenHash, me.id],
    );
    const linkRow = ins.rows[0];
    if (!linkRow) {
      sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      return;
    }
    await pool.query(
      `UPDATE password_reset_requests SET status = 'approved', resolved_at = NOW(), reset_link_id = $1::uuid WHERE id = $2::uuid`,
      [linkRow.id, row.id],
    );
    await tryAudit(pool, {
      actorUserId: me.id,
      action: "auth.reset_request.approved",
      entityType: "password_reset_request",
      entityId: row.id,
      metadata: { requestId: row.id, requesterId: targetUserId, mode: "link" },
    });
    const origin = pickPublicAppOrigin(headers);
    const url = `${origin}/#/reset?token=${encodeURIComponent(token)}`;
    sendJson(res, 200, { success: true, url, expiresAt: linkRow.expires_at });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] reset-request-approve", m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

async function handleResetRequestDecline(
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
  if (me.role !== "admin" && me.role !== "director" && me.role !== "rop") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = (req.body ?? {}) as { id?: unknown; reason?: unknown };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!id || !UUID_RE.test(id)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный идентификатор запроса." });
    return;
  }
  try {
    const sel = await pool.query<{
      id: string;
      status: string;
      expires_at: string;
      approver_user_id: string | null;
      requester_role: string;
    }>(
      `SELECT r.id, r.status, r.expires_at, r.approver_user_id, u.role AS requester_role
       FROM password_reset_requests r
       INNER JOIN users u ON u.id = r.requester_user_id
       WHERE r.id = $1::uuid
       LIMIT 1`,
      [id],
    );
    const row = sel.rows[0];
    if (!row || !resetRequestRowVisibleToViewer(me, { approver_user_id: row.approver_user_id, requester_role: row.requester_role })) {
      sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запрос недоступен." });
      return;
    }
    const expMs = Date.parse(row.expires_at);
    const notExpired = Number.isFinite(expMs) && expMs > Date.now();
    if (row.status !== "pending" || !notExpired) {
      sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запрос недоступен." });
      return;
    }
    await pool.query(`UPDATE password_reset_requests SET status = 'declined', resolved_at = NOW() WHERE id = $1::uuid`, [id]);
    await tryAudit(pool, {
      actorUserId: me.id,
      action: "auth.reset_request.declined",
      entityType: "password_reset_request",
      entityId: id,
      metadata: { requestId: id, reason: reason || undefined },
    });
    sendJson(res, 200, { success: true });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin] reset-request-decline", m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

type MgrScopeMigrationAction = "inserted" | "merged" | "skipped";
type MgrScopeMigrationRow = {
  mgrId: string;
  uuid: string;
  action: MgrScopeMigrationAction;
};
type ActualizationStateRow = {
  state: unknown;
  updated_at: unknown;
};

type ActualizationDedupeStateRow = {
  scope_key: string;
  user_id: string | null;
  role: string | null;
  state: unknown;
  updated_at: unknown;
};

type ActualizationDedupePlanBundle = {
  plans: ManualMergePlan[];
  stateRows: Array<ActualizationDedupeStateRow & { managerUserId: string; managerScopeUserId: string }>;
  totals: { managers: number; rowsToMerge: number; skipped: number };
};

type ContactMigrationPlanBundle = {
  plans: ContactMigrationPlan[];
  stateRows: Array<ActualizationDedupeStateRow & { managerScopeUserId: string }>;
  totals: { managers: number; contactsToMigrate: number; skipped: number };
};

type ActualizationStatsUserRow = {
  id: string;
  full_name: string;
  role: string;
  team_id: string | null;
  team_name: string | null;
  rop_user_id: string | null;
  rop_full_name: string | null;
};

type ActualizationStatsItem = {
  id: string;
  fullName: string;
  managerUserId: string;
  managerFullName: string;
  teamId: string | null;
  teamName: string;
  ropUserId: string | null;
  ropFullName: string;
  createdAt: string | null;
  inn?: string;
  phone?: string;
  legalEntity?: boolean;
  source: string;
};

type ActualizationStatsTp = {
  id: string;
  name: string;
  address: string;
  city: string;
  clientId: string;
  managerUserId: string;
  managerFullName: string;
  teamId: string | null;
  teamName: string;
  ropUserId: string | null;
  ropFullName: string;
  createdAt: string | null;
  hasPhoto: boolean;
  hasStorefront: boolean;
  source: string;
};

function parseIsoOr(v: unknown, fallback: Date): Date {
  if (typeof v !== "string" || !v.trim()) return fallback;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : fallback;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function stateRecord(v: unknown): Record<string, unknown> {
  return isPlainObject(v) ? v : {};
}

function stateString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function stateDate(fields: Record<string, unknown>, fallback?: unknown): string | null {
  const candidates = [fields.createdAt, fields.addedAt, fields.updatedAt, fallback];
  for (const c of candidates) {
    if (typeof c !== "string" || !c.trim()) continue;
    const d = new Date(c);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return null;
}

function inPeriod(iso: string | null, from: Date, to: Date): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= from.getTime() && t <= to.getTime();
}

function legacyScopeToUuid(scopeId: string): string | null {
  if (UUID_RE.test(scopeId)) return scopeId;
  if (scopeId.startsWith("mgr-")) return MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE[scopeId] ?? null;
  return null;
}

function userMeta(
  userId: string,
  usersById: Map<string, ActualizationStatsUserRow>,
): { fullName: string; teamId: string | null; teamName: string; ropUserId: string | null; ropFullName: string } {
  const u = usersById.get(userId);
  return {
    fullName: u?.full_name ?? userId,
    teamId: u?.team_id ?? null,
    teamName: u?.team_name ?? "Без команды",
    ropUserId: u?.rop_user_id ?? null,
    ropFullName: u?.rop_full_name ?? "Без РОП",
  };
}

function normalizeClientBaseStatus(raw: string): "active" | "potential" | "attention" | "archived" {
  const s = raw.trim().toLowerCase();
  if (s === "potential" || s === "потенциальный") return "potential";
  if (s === "attention" || s === "needs_review" || s === "требует внимания") return "attention";
  if (s === "archived" || s === "archive" || s === "архив") return "archived";
  return "active";
}

type ActualizationDebugStateRow = {
  scope_key: string;
  user_id: string | null;
  role: string | null;
  state: unknown;
  updated_at: unknown;
};

function queryStringParam(req: VercelRequest, key: string): string {
  const v = req.query?.[key];
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string") return v[0]!.trim();
  return "";
}

function actualizationMap(input: unknown): Record<string, unknown> {
  return isPlainObject(input) ? input : {};
}

function summarizeActualizationDebugRow(row: ActualizationDebugStateRow): Record<string, unknown> {
  const state = coerceActualizationState(row.state);
  const dealerOverridesById = actualizationMap(state.dealerOverridesById);
  const manuallyCreatedDealersById = actualizationMap(state.manuallyCreatedDealersById);
  const dealerActualizationContactsById = actualizationMap(state.dealerActualizationContactsById);
  const trashedDealersById = actualizationMap(state.trashedDealersById);
  const contactSample = Object.entries(dealerActualizationContactsById)
    .slice(0, 3)
    .map(([id, raw]) => {
      const c = actualizationMap(raw);
      return {
        id,
        dealerId: typeof c.dealerId === "string" ? c.dealerId : null,
        fullName: typeof c.fullName === "string" ? c.fullName : null,
        phone: typeof c.phone === "string" ? c.phone : null,
        email: typeof c.email === "string" ? c.email : null,
        isPrimary: typeof c.isPrimary === "boolean" ? c.isPrimary : null,
      };
    });

  return {
    scope_key: row.scope_key,
    user_id: row.user_id,
    role: row.role,
    updated_at: row.updated_at,
    dealerOverridesById_count: Object.keys(dealerOverridesById).length,
    manuallyCreatedDealersById_count: Object.keys(manuallyCreatedDealersById).length,
    dealerActualizationContactsById_count: Object.keys(dealerActualizationContactsById).length,
    dealerActualizationContactsById_sample: contactSample,
    dealerOverridesById_keys_sample: Object.keys(dealerOverridesById).slice(0, 10),
    trashedDealersById_count: Object.keys(trashedDealersById).length,
    trashedDealersById_sample: Object.keys(trashedDealersById).slice(0, 10),
  };
}

function scopeUserId(scopeKey: string): string | null {
  return scopeKey.startsWith("user:") ? scopeKey.slice("user:".length) : null;
}

/**
 * Промт 45 F1. Диагностика actualization state по `dealerId`: возвращает все scope-ы,
 * где этот dealerId встречается в `manuallyCreatedDealersById |
 * dealerOverridesById | trashedDealersById`. Доступ — только admin / director.
 */
async function handleActualizationStateTrace(
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
  if ((me.role !== "admin" && me.role !== "director") || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Доступ только для admin / director." });
    return;
  }
  const dealerId = queryStringParam(req, "dealerId");
  if (!dealerId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealerId." });
    return;
  }
  const rows = await pool.query<ActualizationDebugStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
       FROM client_base_actualization_state
      WHERE scope_key LIKE 'user:%'
      ORDER BY updated_at DESC`,
  );
  const occurrences: Array<Record<string, unknown>> = [];
  for (const row of rows.rows) {
    const st = coerceActualizationState(row.state);
    const manual = stateRecord(st.manuallyCreatedDealersById)[dealerId];
    const override = stateRecord(st.dealerOverridesById)[dealerId];
    const trashed = stateRecord(st.trashedDealersById)[dealerId];
    if (!manual && !override && !trashed) continue;
    const trashedRec = stateRecord(trashed);
    occurrences.push({
      scopeKey: row.scope_key,
      userId: row.user_id,
      role: row.role,
      stateUpdatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : typeof row.updated_at === "string"
            ? row.updated_at
            : null,
      isTrashed: Boolean(trashed),
      trashedAt: stateString(trashedRec.trashedAt) || null,
      trashedBy: stateString(trashedRec.trashedBy) || null,
      expiresAt: stateString(trashedRec.expiresAt) || null,
      isManuallyCreated: Boolean(manual),
      hasOverride: Boolean(override),
    });
  }
  sendJson(res, 200, { success: true, dealerId, occurrences });
}

async function handleActualizationDebugState(
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
  if (me.role !== "admin" || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только администратор." });
    return;
  }

  const managerScopeUserId = queryStringParam(req, "managerScopeUserId");
  if (!managerScopeUserId) {
    sendJson(res, 400, {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Укажите managerScopeUserId.",
    });
    return;
  }

  const exactScopeKey = `user:${managerScopeUserId}`;
  const rows = await pool.query<ActualizationDebugStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
     FROM client_base_actualization_state
     WHERE scope_key = $1 OR user_id = $2 OR scope_key LIKE 'user:mgr-%'
     ORDER BY updated_at DESC`,
    [exactScopeKey, managerScopeUserId],
  );

  const filtered = rows.rows.filter((row) => {
    if (row.scope_key === exactScopeKey) return true;
    if (row.user_id === managerScopeUserId) return true;
    const scopeId = scopeUserId(String(row.scope_key));
    if (!scopeId?.startsWith("mgr-")) return false;
    return MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE[scopeId] === managerScopeUserId;
  });
  const resultRows = filtered.map(summarizeActualizationDebugRow);
  sendJson(res, 200, { success: true, rows: resultRows, count: resultRows.length });
}

async function loadActualizationDedupePlanBundle(pool: PoolLike): Promise<ActualizationDedupePlanBundle> {
  const stateRes = await pool.query<ActualizationDedupeStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
     FROM client_base_actualization_state
     WHERE scope_key LIKE 'user:%'`,
  );
  const usersRes = await pool.query<{ id: string; full_name: string }>(`SELECT id, full_name FROM users`);
  const fullNameById = new Map(usersRes.rows.map((u) => [String(u.id), String(u.full_name)]));
  const plans: ManualMergePlan[] = [];
  const stateRows: ActualizationDedupePlanBundle["stateRows"] = [];

  for (const row of stateRes.rows) {
    const scopeId = scopeUserId(String(row.scope_key));
    if (!scopeId) continue;
    const managerUserId = UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE[scopeId] ?? (scopeId.startsWith("mgr-") ? scopeId : null);
    if (!managerUserId) continue;
    const managerScopeUserId = scopeId.startsWith("mgr-")
      ? (MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE[scopeId] ?? row.user_id ?? scopeId)
      : scopeId;
    const managerFullName = fullNameById.get(managerScopeUserId) ?? managerUserId;
    const state = coerceActualizationState(row.state) as unknown as Parameters<typeof buildManagerMergePlan>[0]["state"];
    const plan = buildManagerMergePlan({
      managerUserId,
      managerScopeUserId,
      managerFullName,
      state,
    });
    plans.push(plan);
    stateRows.push({ ...row, managerUserId, managerScopeUserId });
  }

  return {
    plans,
    stateRows,
    totals: {
      managers: plans.length,
      rowsToMerge: plans.reduce((sum, p) => sum + p.rows.length, 0),
      skipped: plans.reduce((sum, p) => sum + p.skipped.length, 0),
    },
  };
}

async function handleActualizationDedupeDryRun(
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if ((me.role !== "admin" && me.role !== "director") || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const bundle = await loadActualizationDedupePlanBundle(pool);
  sendJson(res, 200, { success: true, plans: bundle.plans, totals: bundle.totals });
}

async function handleActualizationDedupeApply(
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
  if (me.role !== "admin" || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только администратор." });
    return;
  }
  const body = isPlainObject(req.body) ? req.body : {};
  if (body.confirm !== true) {
    sendJson(res, 400, { success: false, code: "CONFIRM_REQUIRED", message: "Требуется confirm: true." });
    return;
  }

  const bundle = await loadActualizationDedupePlanBundle(pool);
  const planByScope = new Map<string, ManualMergePlan>();
  for (const plan of bundle.plans) {
    const first = plan.rows[0] ?? null;
    if (first) planByScope.set(first.managerScopeUserId, plan);
  }

  let applied = 0;
  const perManager: Array<{ managerUserId: string; managerScopeUserId: string; merged: number; plan: ManualMergePlan }> = [];
  for (const row of bundle.stateRows) {
    const plan = planByScope.get(row.managerScopeUserId);
    if (!plan || plan.rows.length === 0) continue;
    const current = coerceActualizationState(row.state) as unknown as Parameters<typeof applyMergePlanToState>[0];
    for (const planRow of plan.rows) {
      console.info("[actualization-dedupe] merging", {
        manager: planRow.managerUserId,
        manualId: planRow.manualDealerId,
        releaseKey: planRow.releaseDealerId,
      });
    }
    const next = applyMergePlanToState(current, plan, me.id);
    const scopeKey = `user:${row.managerScopeUserId}`;
    await pool.query(
      `INSERT INTO client_base_actualization_state (scope_key, user_id, role, state, version)
       VALUES ($1, $2, $3, $4::jsonb, 1)
       ON CONFLICT (scope_key) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         role = COALESCE(EXCLUDED.role, client_base_actualization_state.role),
         state = EXCLUDED.state,
         version = EXCLUDED.version,
         updated_at = now()`,
      [scopeKey, row.managerScopeUserId, row.role, JSON.stringify(next)],
    );
    await tryAudit(pool, {
      actorUserId: me.id,
      action: "actualization.dedupe",
      entityType: "actualization_state",
      entityId: row.managerScopeUserId,
      metadata: { mergedCount: plan.rows.length, planRows: plan.rows },
    });
    applied += plan.rows.length;
    perManager.push({
      managerUserId: row.managerUserId,
      managerScopeUserId: row.managerScopeUserId,
      merged: plan.rows.length,
      plan,
    });
  }

  sendJson(res, 200, { success: true, applied, perManager, plans: bundle.plans, totals: bundle.totals });
}

async function loadContactMigrationPlanBundle(pool: PoolLike, actorUserId: string): Promise<ContactMigrationPlanBundle> {
  const stateRes = await pool.query<ActualizationDedupeStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
     FROM client_base_actualization_state
     WHERE scope_key LIKE 'user:%'`,
  );
  const plans: ContactMigrationPlan[] = [];
  const stateRows: ContactMigrationPlanBundle["stateRows"] = [];

  for (const row of stateRes.rows) {
    const scopeId = scopeUserId(String(row.scope_key));
    if (!scopeId) continue;
    const managerScopeUserId = scopeId.startsWith("mgr-")
      ? (MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE[scopeId] ?? row.user_id ?? scopeId)
      : scopeId;
    const state = coerceActualizationState(row.state) as unknown as Parameters<typeof buildContactMigrationPlanForState>[0]["state"];
    const plan = buildContactMigrationPlanForState({ managerScopeUserId, state, actorUserId });
    plans.push(plan);
    stateRows.push({ ...row, managerScopeUserId });
  }

  return {
    plans,
    stateRows,
    totals: {
      managers: plans.length,
      contactsToMigrate: plans.reduce((sum, p) => sum + p.rows.length, 0),
      skipped: plans.reduce((sum, p) => sum + p.skipped.length, 0),
    },
  };
}

async function handleActualizationContactsMigrationDryRun(
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
  const bundle = await loadContactMigrationPlanBundle(pool, me.id);
  sendJson(res, 200, { success: true, plans: bundle.plans, totals: bundle.totals });
}

async function handleActualizationContactsMigrationApply(
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
  if (me.role !== "admin" || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только администратор." });
    return;
  }
  const body = isPlainObject(req.body) ? req.body : {};
  if (body.confirm !== true) {
    sendJson(res, 400, { success: false, code: "CONFIRM_REQUIRED", message: "Требуется confirm: true." });
    return;
  }

  const actorName = me.full_name || me.email || "admin";
  const bundle = await loadContactMigrationPlanBundle(pool, me.id);
  const planByScope = new Map<string, ContactMigrationPlan>();
  for (const plan of bundle.plans) {
    const first = plan.rows[0] ?? null;
    if (first) planByScope.set(first.managerScopeUserId, plan);
  }

  let applied = 0;
  const perManager: Array<{ managerScopeUserId: string; created: number; plan: ContactMigrationPlan }> = [];
  for (const row of bundle.stateRows) {
    const plan = planByScope.get(row.managerScopeUserId);
    if (!plan || plan.rows.length === 0) continue;
    const current = coerceActualizationState(row.state) as unknown as Parameters<typeof applyContactMigrationPlan>[0];
    const next = applyContactMigrationPlan(current, plan, me.id, actorName);
    const scopeKey = `user:${row.managerScopeUserId}`;
    await pool.query(
      `INSERT INTO client_base_actualization_state (scope_key, user_id, role, state, version)
       VALUES ($1, $2, $3, $4::jsonb, 1)
       ON CONFLICT (scope_key) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         role = COALESCE(EXCLUDED.role, client_base_actualization_state.role),
         state = EXCLUDED.state,
         version = EXCLUDED.version,
         updated_at = now()`,
      [scopeKey, row.managerScopeUserId, row.role, JSON.stringify(next)],
    );
    await tryAudit(pool, {
      actorUserId: me.id,
      action: "actualization.contacts_migration",
      entityType: "actualization_state",
      entityId: row.managerScopeUserId,
      metadata: { created: plan.rows.length, planRows: plan.rows },
    });
    applied += plan.rows.length;
    perManager.push({ managerScopeUserId: row.managerScopeUserId, created: plan.rows.length, plan });
  }

  sendJson(res, 200, { success: true, applied, perManager, plans: bundle.plans, totals: bundle.totals });
}

async function handleActualizationStatsOverview(
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
  if (!["admin", "director", "rop", "manager", "category_manager"].includes(me.role) || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const now = new Date();
  const from = parseIsoOr(queryStringParam(req, "fromIso"), new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const to = parseIsoOr(queryStringParam(req, "toIso"), now);
  const teamIdFilter = queryStringParam(req, "teamId");
  const managerFilter = queryStringParam(req, "managerUserId");

  const users = await pool.query<ActualizationStatsUserRow>(
    `SELECT u.id, u.full_name, u.role, t.id AS team_id, t.name AS team_name, t.rop_user_id, ropu.full_name AS rop_full_name
       FROM users u
       LEFT JOIN user_team_memberships m ON m.user_id = u.id
       LEFT JOIN teams t ON t.id = m.team_id
       LEFT JOIN users ropu ON ropu.id = t.rop_user_id
      WHERE u.status = 'active'`,
  );
  const usersById = new Map<string, ActualizationStatsUserRow>();
  for (const u of users.rows) {
    if (!usersById.has(u.id)) usersById.set(u.id, u);
  }

  let allowed = new Set(users.rows.map((u) => u.id));
  if (me.role === "rop") {
    allowed = new Set(users.rows.filter((u) => u.rop_user_id === me.id || u.id === me.id).map((u) => u.id));
    allowed.add(me.id);
  } else if (me.role === "manager") {
    allowed = new Set([me.id]);
  }
  if (teamIdFilter) {
    const teamMembers = new Set(users.rows.filter((u) => u.team_id === teamIdFilter).map((u) => u.id));
    allowed = new Set(Array.from(allowed).filter((id) => teamMembers.has(id)));
  }
  if (managerFilter) {
    if (!allowed.has(managerFilter)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }
    allowed = new Set([managerFilter]);
  }

  const rows = await pool.query<ActualizationDedupeStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
       FROM client_base_actualization_state
      WHERE scope_key LIKE 'user:%'`,
  );
  const statesByUser = new Map<string, Record<string, unknown>[]>();
  for (const row of rows.rows) {
    const scopeId = scopeUserId(String(row.scope_key));
    const owner = row.user_id && UUID_RE.test(row.user_id) ? row.user_id : scopeId ? legacyScopeToUuid(scopeId) : null;
    if (!owner || !allowed.has(owner)) continue;
    const arr = statesByUser.get(owner) ?? [];
    arr.push(coerceActualizationState(row.state));
    statesByUser.set(owner, arr);
  }

  const clients: ActualizationStatsItem[] = [];
  const tradePoints: ActualizationStatsTp[] = [];
  const managerUpdates = new Map<string, number>();
  const managerLast = new Map<string, string>();

  for (const userId of Array.from(allowed)) {
    const merged = mergeActualizationStates(statesByUser.get(userId) ?? [actualizationEmptyState()]);
    const meta = userMeta(userId, usersById);
    const bump = (iso: string | null) => {
      managerUpdates.set(userId, (managerUpdates.get(userId) ?? 0) + 1);
      if (iso && (!managerLast.get(userId) || iso > (managerLast.get(userId) ?? ""))) managerLast.set(userId, iso);
    };
    const manualDealers = stateRecord(merged.manuallyCreatedDealersById);
    for (const [id, raw] of Object.entries(manualDealers)) {
      const m = stateRecord(raw);
      const fields = stateRecord(m.fields);
      const createdAt = stateDate(fields, m.createdAt);
      const client = {
        id,
        fullName: stateString(fields.name) || stateString(fields.dealerName) || id,
        managerUserId: userId,
        managerFullName: meta.fullName,
        teamId: meta.teamId,
        teamName: meta.teamName,
        ropUserId: meta.ropUserId,
        ropFullName: meta.ropFullName,
        createdAt,
        inn: stateString(fields.inn),
        phone: stateString(fields.phone),
        legalEntity: Boolean(stateRecord(merged.legalEntityOverridesByDealerId)[id]),
        source: "manual",
      };
      clients.push(client);
      bump(createdAt);
    }
    const dealerOverrides = stateRecord(merged.dealerOverridesById);
    for (const [id, raw] of Object.entries(dealerOverrides)) {
      const ov = stateRecord(raw);
      const fields = stateRecord(ov.fields);
      if (!stateString(fields.phone) && !stateString(fields.email) && !stateString(fields.inn) && !stateString(fields.name) && !stateString(fields.dealerName)) continue;
      const createdAt = stateDate(fields, ov.updatedAt);
      clients.push({
        id,
        fullName: stateString(fields.name) || stateString(fields.dealerName) || id,
        managerUserId: userId,
        managerFullName: meta.fullName,
        teamId: meta.teamId,
        teamName: meta.teamName,
        ropUserId: meta.ropUserId,
        ropFullName: meta.ropFullName,
        createdAt,
        inn: stateString(fields.inn),
        phone: stateString(fields.phone),
        legalEntity: Boolean(stateRecord(merged.legalEntityOverridesByDealerId)[id]),
        source: "release",
      });
      bump(createdAt);
    }
    const manualTp = stateRecord(merged.manuallyCreatedTradePointsById);
    const photos = stateRecord(merged.tradePointPhotosByTradePointId);
    const showcase = stateRecord(merged.tradePointShowcaseActualizationById);
    for (const [id, raw] of Object.entries(manualTp)) {
      const tp = stateRecord(raw);
      const fields = stateRecord(tp.fields);
      const createdAt = stateDate(fields, tp.createdAt);
      tradePoints.push({
        id,
        name: stateString(fields.name) || id,
        address: stateString(fields.address),
        city: stateString(fields.city),
        clientId: stateString(tp.dealerId),
        managerUserId: userId,
        managerFullName: meta.fullName,
        teamId: meta.teamId,
        teamName: meta.teamName,
        ropUserId: meta.ropUserId,
        ropFullName: meta.ropFullName,
        createdAt,
        hasPhoto: Array.isArray(photos[id]) && (photos[id] as unknown[]).length > 0,
        hasStorefront: Boolean(showcase[id]),
        source: "manual",
      });
      bump(createdAt);
    }
  }

  const periodClients = clients.filter((c) => inPeriod(c.createdAt, from, to));
  const periodTps = tradePoints.filter((tp) => inPeriod(tp.createdAt, from, to));
  const byManager = Array.from(allowed).map((userId) => {
    const meta = userMeta(userId, usersById);
    const c = periodClients.filter((x) => x.managerUserId === userId).length;
    const tp = periodTps.filter((x) => x.managerUserId === userId).length;
    const updates = managerUpdates.get(userId) ?? 0;
    const lastActivityIso = managerLast.get(userId) ?? null;
    const lastHours = lastActivityIso ? Math.max(0, (Date.now() - Date.parse(lastActivityIso)) / 36e5) : 99999;
    return { userId, ...meta, clients: c, tradePoints: tp, updates, lastActivityIso, score: c * 5 + tp * 2 + Math.min(updates, 50), lastHours };
  });

  const dynamics: Array<{ dateIso: string; clients: number; tradePoints: number }> = [];
  for (let t = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())).getTime(); t <= to.getTime(); t += 86400000) {
    const d = isoDay(new Date(t));
    dynamics.push({
      dateIso: d,
      clients: periodClients.filter((c) => c.createdAt?.slice(0, 10) === d).length,
      tradePoints: periodTps.filter((tp) => tp.createdAt?.slice(0, 10) === d).length,
    });
  }

  const teams = new Map<string, typeof byManager>();
  byManager.forEach((m) => {
    const key = m.teamId ?? "__no_rop__";
    const arr = teams.get(key) ?? [];
    arr.push(m);
    teams.set(key, arr);
  });
  const ropRanking = Array.from(teams.entries()).map(([teamId, members]) => {
    const sample = members[0];
    const leader = [...members].sort((a, b) => b.clients + b.tradePoints - (a.clients + a.tradePoints))[0] ?? null;
    return {
      ropUserId: sample?.ropUserId ?? null,
      ropFullName: sample?.ropFullName ?? "Без РОП",
      teamId: teamId === "__no_rop__" ? null : teamId,
      teamName: sample?.teamName ?? "Без команды",
      totalAdded: members.reduce((s, m) => s + m.clients + m.tradePoints, 0),
      clientsAdded: members.reduce((s, m) => s + m.clients, 0),
      tradePointsAdded: members.reduce((s, m) => s + m.tradePoints, 0),
      activeManagers: members.filter((m) => m.clients + m.tradePoints > 0).length,
      inactiveManagers: members.filter((m) => m.clients + m.tradePoints === 0).length,
      leaderUserId: leader?.userId ?? null,
      leaderFullName: leader?.fullName ?? null,
      leaderTotal: leader ? leader.clients + leader.tradePoints : 0,
      managerCount: members.length,
    };
  }).sort((a, b) => b.totalAdded - a.totalAdded);

  const problemSlice = <T,>(arr: T[]) => arr.slice(0, 50);
  const managersFeed = byManager.map((m) => ({
    userId: m.userId,
    fullName: m.fullName,
    teamId: m.teamId,
    teamName: m.teamName,
    ropUserId: m.ropUserId,
    ropFullName: m.ropFullName,
    clientsTotal: clients.filter((c) => c.managerUserId === m.userId).length,
    tpTotal: tradePoints.filter((tp) => tp.managerUserId === m.userId).length,
    updates: m.updates,
    lastActivityIso: m.lastActivityIso,
    status: m.clients + m.tradePoints > 0 ? "active" : m.updates > 0 ? "weak" : "none",
  }));

  sendJson(res, 200, {
    success: true,
    generatedAt: new Date().toISOString(),
    period: { fromIso: from.toISOString(), toIso: to.toISOString() },
    totals: {
      clientsAdded: periodClients.length,
      tradePointsAdded: periodTps.length,
      activeManagers: byManager.filter((m) => m.clients + m.tradePoints > 0).length,
      inactiveManagers: byManager.filter((m) => m.clients + m.tradePoints === 0).length,
      totalManagers: byManager.length,
    },
    ropRanking,
    dynamicsByDay: dynamics,
    managersChart: byManager.map((m) => ({ userId: m.userId, fullName: m.fullName, clients: m.clients, tradePoints: m.tradePoints })).sort((a, b) => b.clients + b.tradePoints - (a.clients + a.tradePoints)).slice(0, 30),
    scoreByManager: byManager.map((m) => ({ userId: m.userId, fullName: m.fullName, score: m.score, factors: { clientsAdded: m.clients, tpAdded: m.tradePoints, updates: m.updates, lastActivityHours: m.lastHours } })).sort((a, b) => b.score - a.score).slice(0, 100),
    actionStructure: { items: [] },
    baseQuality: {
      clientsTotal: clients.length,
      clientsWithInn: clients.filter((c) => c.inn).length,
      clientsWithPhone: clients.filter((c) => c.phone).length,
      clientsWithLegalEntity: clients.filter((c) => c.legalEntity).length,
      clientsWithTradePoint: clients.filter((c) => tradePoints.some((tp) => tp.clientId === c.id)).length,
      tradePointsTotal: tradePoints.length,
      tradePointsWithAddress: tradePoints.filter((tp) => tp.address).length,
      tradePointsWithPhoto: tradePoints.filter((tp) => tp.hasPhoto).length,
      tradePointsWithStorefront: tradePoints.filter((tp) => tp.hasStorefront).length,
    },
    problemZones: {
      inactiveManagers: problemSlice(managersFeed.filter((m) => m.status === "none").map((m) => ({ userId: m.userId, fullName: m.fullName, teamName: m.teamName, lastActivityIso: m.lastActivityIso }))),
      clientsWithoutInn: problemSlice(clients.filter((c) => !c.inn).map((c) => ({ clientId: c.id, fullName: c.fullName, managerUserId: c.managerUserId, managerFullName: c.managerFullName }))),
      clientsWithoutPhone: problemSlice(clients.filter((c) => !c.phone).map((c) => ({ clientId: c.id, fullName: c.fullName, managerUserId: c.managerUserId, managerFullName: c.managerFullName }))),
      clientsWithoutLegalEntity: problemSlice(clients.filter((c) => !c.legalEntity).map((c) => ({ clientId: c.id, fullName: c.fullName, managerUserId: c.managerUserId, managerFullName: c.managerFullName }))),
      tradePointsWithoutAddress: problemSlice(
        tradePoints
          .filter((tp) => !tp.address)
          .map((tp) => ({
            id: tp.id,
            name: tp.name,
            managerFullName: tp.managerFullName,
            clientId: tp.clientId ?? null,
            dealerProfileId: tp.clientId ?? null,
          })),
      ),
      tradePointsWithoutPhoto: problemSlice(
        tradePoints
          .filter((tp) => !tp.hasPhoto)
          .map((tp) => ({
            id: tp.id,
            name: tp.name,
            managerFullName: tp.managerFullName,
            clientId: tp.clientId ?? null,
            dealerProfileId: tp.clientId ?? null,
          })),
      ),
    },
    managersFeed,
  });
}

async function handleClientBaseOverview(
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
  if (!["admin", "director", "rop", "manager", "category_manager"].includes(me.role) || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const teamIdFilter = queryStringParam(req, "teamId");
  const managerFilter = queryStringParam(req, "managerUserId");
  const users = await pool.query<ActualizationStatsUserRow>(
    `SELECT u.id, u.full_name, u.role, t.id AS team_id, t.name AS team_name, t.rop_user_id, ropu.full_name AS rop_full_name
       FROM users u
       LEFT JOIN user_team_memberships m ON m.user_id = u.id
       LEFT JOIN teams t ON t.id = m.team_id
       LEFT JOIN users ropu ON ropu.id = t.rop_user_id
      WHERE u.status = 'active'`,
  );
  const usersById = new Map<string, ActualizationStatsUserRow>();
  for (const u of users.rows) if (!usersById.has(u.id)) usersById.set(u.id, u);

  let allowed = new Set(users.rows.map((u) => u.id));
  if (me.role === "rop") {
    allowed = new Set(users.rows.filter((u) => u.rop_user_id === me.id || u.id === me.id).map((u) => u.id));
    allowed.add(me.id);
  } else if (me.role === "manager") {
    allowed = new Set([me.id]);
  }
  if (teamIdFilter) {
    const teamMembers = new Set(users.rows.filter((u) => u.team_id === teamIdFilter).map((u) => u.id));
    allowed = new Set(Array.from(allowed).filter((id) => teamMembers.has(id)));
  }
  if (managerFilter) {
    if (!allowed.has(managerFilter)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }
    allowed = new Set([managerFilter]);
  }

  const rows = await pool.query<ActualizationDedupeStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
       FROM client_base_actualization_state
      WHERE scope_key LIKE 'user:%'`,
  );
  const statesByUser = new Map<string, Record<string, unknown>[]>();
  for (const row of rows.rows) {
    const scopeId = scopeUserId(String(row.scope_key));
    const owner = row.user_id && UUID_RE.test(row.user_id) ? row.user_id : scopeId ? legacyScopeToUuid(scopeId) : null;
    if (!owner || !allowed.has(owner)) continue;
    const arr = statesByUser.get(owner) ?? [];
    arr.push(coerceActualizationState(row.state));
    statesByUser.set(owner, arr);
  }

  const clients: Array<ActualizationStatsItem & { status: string; city: string; updatedAt: string | null }> = [];
  const tradePoints: ActualizationStatsTp[] = [];
  for (const userId of Array.from(allowed)) {
    const merged = mergeActualizationStates(statesByUser.get(userId) ?? [actualizationEmptyState()]);
    const meta = userMeta(userId, usersById);
    const manualDealers = stateRecord(merged.manuallyCreatedDealersById);
    const dealerOverrides = stateRecord(merged.dealerOverridesById);
    const legalByDealer = stateRecord(merged.legalEntityOverridesByDealerId);
    const addClient = (id: string, fields: Record<string, unknown>, source: string, fallbackDate?: unknown) => {
      const updatedAt = stateDate(fields, fallbackDate);
      clients.push({
        id,
        fullName: stateString(fields.name) || stateString(fields.dealerName) || id,
        managerUserId: userId,
        managerFullName: meta.fullName,
        teamId: meta.teamId,
        teamName: meta.teamName,
        ropUserId: meta.ropUserId,
        ropFullName: meta.ropFullName,
        createdAt: updatedAt,
        updatedAt,
        city: stateString(fields.city),
        status: normalizeClientBaseStatus(stateString(fields.status)),
        inn: stateString(fields.inn),
        phone: stateString(fields.phone),
        legalEntity: Boolean(legalByDealer[id]),
        source,
      });
    };
    for (const [id, raw] of Object.entries(manualDealers)) {
      const m = stateRecord(raw);
      addClient(id, stateRecord(m.fields), "manual", m.updatedAt ?? m.createdAt);
    }
    for (const [id, raw] of Object.entries(dealerOverrides)) {
      const ov = stateRecord(raw);
      const fields = stateRecord(ov.fields);
      if (!stateString(fields.phone) && !stateString(fields.email) && !stateString(fields.inn) && !stateString(fields.name) && !stateString(fields.dealerName)) continue;
      addClient(id, fields, "release", ov.updatedAt);
    }
    const manualTp = stateRecord(merged.manuallyCreatedTradePointsById);
    const photos = stateRecord(merged.tradePointPhotosByTradePointId);
    const showcase = stateRecord(merged.tradePointShowcaseActualizationById);
    for (const [id, raw] of Object.entries(manualTp)) {
      const tp = stateRecord(raw);
      const fields = stateRecord(tp.fields);
      tradePoints.push({
        id,
        name: stateString(fields.name) || id,
        address: stateString(fields.address),
        city: stateString(fields.city),
        clientId: stateString(tp.dealerId),
        managerUserId: userId,
        managerFullName: meta.fullName,
        teamId: meta.teamId,
        teamName: meta.teamName,
        ropUserId: meta.ropUserId,
        ropFullName: meta.ropFullName,
        createdAt: stateDate(fields, tp.updatedAt ?? tp.createdAt),
        hasPhoto: Array.isArray(photos[id]) && (photos[id] as unknown[]).length > 0,
        hasStorefront: Boolean(showcase[id]),
        source: "manual",
      });
    }
  }

  const nonArchivedClients = clients.filter((c) => c.status !== "archived");
  const nonArchivedClientIds = new Set(nonArchivedClients.map((c) => c.id));
  const visibleTradePoints = tradePoints.filter((tp) => nonArchivedClientIds.has(tp.clientId));
  const clientsById = new Map(nonArchivedClients.map((c) => [c.id, c]));
  const activeClients = nonArchivedClients.filter((c) => c.status === "active");
  const potentialClients = nonArchivedClients.filter((c) => c.status === "potential");
  const staleCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const attentionClients = nonArchivedClients.filter((c) => c.status === "attention" || (c.updatedAt ? Date.parse(c.updatedAt) < staleCutoff : false));
  const clientsWithTp = new Set(visibleTradePoints.map((tp) => tp.clientId));
  const cityMap = new Map<string, { city: string | null; clients: number; tradePoints: number }>();
  const cityKey = (city: string) => city.trim() || "__without__";
  for (const c of nonArchivedClients) {
    const key = cityKey(c.city);
    const cur = cityMap.get(key) ?? { city: key === "__without__" ? null : c.city, clients: 0, tradePoints: 0 };
    cur.clients += 1;
    cityMap.set(key, cur);
  }
  for (const tp of visibleTradePoints) {
    const ownerCity = clientsById.get(tp.clientId)?.city || tp.city;
    const key = cityKey(ownerCity);
    const cur = cityMap.get(key) ?? { city: key === "__without__" ? null : ownerCity, clients: 0, tradePoints: 0 };
    cur.tradePoints += 1;
    cityMap.set(key, cur);
  }
  const cities = Array.from(cityMap.values()).filter((c) => c.city).sort((a, b) => b.clients - a.clients).slice(0, 15);
  const withoutCity = cityMap.get("__without__") ?? { clients: 0, tradePoints: 0 };
  const byManager = Array.from(allowed).map((userId) => {
    const meta = userMeta(userId, usersById);
    const managerClients = nonArchivedClients.filter((c) => c.managerUserId === userId);
    const managerTps = visibleTradePoints.filter((tp) => tp.managerUserId === userId);
    return {
      userId,
      fullName: meta.fullName,
      teamId: meta.teamId,
      teamName: meta.teamName,
      ropUserId: meta.ropUserId,
      ropFullName: meta.ropFullName,
      active: managerClients.filter((c) => c.status === "active").length,
      tradePoints: managerTps.filter((tp) => nonArchivedClientIds.has(tp.clientId)).length,
      segment: null,
      potential: managerClients.filter((c) => c.status === "potential").length,
      attention: managerClients.filter((c) => attentionClients.some((a) => a.id === c.id)).length,
    };
  });
  const teams = new Map<string, typeof byManager>();
  for (const m of byManager) {
    const key = m.teamId ?? "__no_rop__";
    const arr = teams.get(key) ?? [];
    arr.push(m);
    teams.set(key, arr);
  }
  const ropGroups = Array.from(teams.entries()).map(([teamId, managers]) => {
    const sample = managers[0];
    const groupClients = nonArchivedClients.filter((c) => (c.teamId ?? "__no_rop__") === teamId);
    const groupTp = visibleTradePoints.filter((tp) => (tp.teamId ?? "__no_rop__") === teamId);
    return {
      ropUserId: sample?.ropUserId ?? null,
      ropFullName: sample?.ropFullName ?? "Без РОП",
      teamId: teamId === "__no_rop__" ? null : teamId,
      teamName: sample?.teamName ?? "Без команды",
      clients: groupClients.filter((c) => c.status === "active").length,
      tradePoints: groupTp.length,
      potential: groupClients.filter((c) => c.status === "potential").length,
      attention: groupClients.filter((c) => attentionClients.some((a) => a.id === c.id)).length,
      managerCount: managers.length,
      managersWithEmptyBase: managers.filter((m) => m.active === 0).length,
      managers,
    };
  }).sort((a, b) => b.clients - a.clients);
  const ropClientsSum = ropGroups.reduce((sum, g) => sum + g.clients, 0);
  if (ropClientsSum !== activeClients.length) {
    console.warn("[client-base-overview] active client invariant mismatch", {
      activeClients: activeClients.length,
      ropClientsSum,
    });
  }

  sendJson(res, 200, {
    success: true,
    generatedAt: new Date().toISOString(),
    structure: {
      activeClients: activeClients.length,
      tradePoints: visibleTradePoints.length,
      potentialClients: potentialClients.length,
      attentionClients: attentionClients.length,
      averageDistributionPct: nonArchivedClients.length ? Math.round((clientsWithTp.size / nonArchivedClients.length) * 100) : 0,
      avgTpPerClient: activeClients.length ? Number((visibleTradePoints.length / activeClients.length).toFixed(2)) : 0,
      managersWithClientsWithoutTp: byManager.filter((m) => nonArchivedClients.some((c) => c.managerUserId === m.userId && !clientsWithTp.has(c.id))).length,
      citiesWithClientsWithoutTp: new Set(nonArchivedClients.filter((c) => !clientsWithTp.has(c.id)).map((c) => c.city || "__without__")).size,
    },
    topActiveClients: [...activeClients].map((c) => ({
      clientId: c.id,
      fullName: c.fullName,
      tradePointsCount: visibleTradePoints.filter((tp) => tp.clientId === c.id).length,
      managerUserId: c.managerUserId,
      managerFullName: c.managerFullName,
      city: c.city,
    })).sort((a, b) => b.tradePointsCount - a.tradePointsCount).slice(0, 10),
    cities,
    withoutCity,
    ropGroups,
  });
}

async function handleClientBaseClientsList(
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
  if (!["admin", "director", "rop", "manager", "category_manager"].includes(me.role) || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const teamIdFilter = queryStringParam(req, "teamId");
  const managerFilter = queryStringParam(req, "managerUserId");
  const users = await pool.query<ActualizationStatsUserRow>(
    `SELECT u.id, u.full_name, u.role, t.id AS team_id, t.name AS team_name, t.rop_user_id, ropu.full_name AS rop_full_name
       FROM users u
       LEFT JOIN user_team_memberships m ON m.user_id = u.id
       LEFT JOIN teams t ON t.id = m.team_id
       LEFT JOIN users ropu ON ropu.id = t.rop_user_id
      WHERE u.status = 'active'`,
  );
  const usersById = new Map<string, ActualizationStatsUserRow>();
  for (const u of users.rows) if (!usersById.has(u.id)) usersById.set(u.id, u);

  let allowed = new Set(users.rows.map((u) => u.id));
  if (me.role === "rop") {
    allowed = new Set(users.rows.filter((u) => u.rop_user_id === me.id || u.id === me.id).map((u) => u.id));
    allowed.add(me.id);
  } else if (me.role === "manager") {
    allowed = new Set([me.id]);
  }
  if (teamIdFilter) {
    const teamMembers = new Set(users.rows.filter((u) => u.team_id === teamIdFilter).map((u) => u.id));
    allowed = new Set(Array.from(allowed).filter((id) => teamMembers.has(id)));
  }
  if (managerFilter) {
    if (!allowed.has(managerFilter)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }
    allowed = new Set([managerFilter]);
  }

  const catalogKeys = new Set<string>();
  for (const userId of Array.from(allowed)) {
    const u = usersById.get(userId);
    if (!u) continue;
    const scope = await computeDbScopeForUser(pool, userId, u.role as import("../../shared/auth.js").UserRole);
    for (const k of scope.active_dealer_external_keys) catalogKeys.add(k);
  }

  const catalogMeta = new Map<string, ClientBaseCatalogDealerMeta>();
  if (catalogKeys.size > 0) {
    const keysArr = Array.from(catalogKeys);
    const dealersQ = await pool.query<{
      external_key: string;
      name: string | null;
      city: string | null;
      manager_user_id: string | null;
      manager_full_name: string | null;
      regional_manager_id: string | null;
      dealer_rop_id: string | null;
      team_rop_user_id: string | null;
      has_assignment_manager: boolean;
      has_assignment_regional: boolean;
      has_assignment_rop: boolean;
    }>(
      `SELECT d.external_key, d.name, d.city,
              ca.responsible_user_id::text AS manager_user_id,
              mu.full_name AS manager_full_name,
              d_ov.regional_manager_id::text AS regional_manager_id,
              d_ov.rop_id::text AS dealer_rop_id,
              t.rop_user_id::text AS team_rop_user_id,
              EXISTS (
                SELECT 1 FROM responsibility_assignments ra
                WHERE ra.scope_kind = 'dealer'
                  AND (ra.scope_key = d.external_key OR ra.scope_key = d.id::text)
                  AND ra.responsible_role IN ('manager', 'sales_manager')
              ) AS has_assignment_manager,
              EXISTS (
                SELECT 1 FROM responsibility_assignments ra
                WHERE ra.scope_kind = 'dealer'
                  AND (ra.scope_key = d.external_key OR ra.scope_key = d.id::text)
                  AND ra.responsible_role = 'regional_manager'
              ) AS has_assignment_regional,
              EXISTS (
                SELECT 1 FROM responsibility_assignments ra
                WHERE ra.scope_kind = 'dealer'
                  AND (ra.scope_key = d.external_key OR ra.scope_key = d.id::text)
                  AND ra.responsible_role = 'rop'
              ) AS has_assignment_rop
         FROM dealers d
         LEFT JOIN client_assignments ca ON ca.client_code = d.release_code
         LEFT JOIN users mu ON mu.id = ca.responsible_user_id
         LEFT JOIN teams t ON t.id = ca.team_id
         ${DEALER_OVERRIDE_JOIN}
        WHERE d.external_key = ANY($1::text[])
          AND ${dealerJoinStatusActive("d_ov")}`,
      [keysArr],
    );
    const tpCountQ = await pool.query<{ dealer_external_key: string; tp_id: string }>(
      `SELECT d.external_key AS dealer_external_key,
              COALESCE(tpo.tp_id, tp.external_key, tp.id::text) AS tp_id
         FROM trade_points tp
         INNER JOIN dealers d ON d.id = tp.dealer_id
         ${DEALER_OVERRIDE_JOIN}
         ${TRADE_POINT_OVERRIDE_JOIN}
        WHERE d.external_key = ANY($1::text[])
          AND tp.is_active = TRUE
          AND ${dealerJoinStatusActive("d_ov")}
          AND ${tpJoinStatusActive("tpo")}`,
      [keysArr],
    );
    const tpByDealer = new Map<string, string[]>();
    for (const row of tpCountQ.rows) {
      const arr = tpByDealer.get(row.dealer_external_key) ?? [];
      arr.push(row.tp_id);
      tpByDealer.set(row.dealer_external_key, arr);
    }
    for (const row of dealersQ.rows) {
      const tpIds = tpByDealer.get(row.external_key) ?? [];
      catalogMeta.set(row.external_key, {
        externalKey: row.external_key,
        fullName: row.name?.trim() || row.external_key,
        city: row.city?.trim() || null,
        managerUserId: row.manager_user_id,
        managerFullName: row.manager_full_name,
        inn: null,
        phone: null,
        legalEntity: false,
        tradePointIds: tpIds,
        tradePointsCount: tpIds.length,
        hasManager: Boolean(row.manager_user_id) || row.has_assignment_manager === true,
        hasRegional: Boolean(row.regional_manager_id) || row.has_assignment_regional === true,
        hasRop:
          Boolean(row.dealer_rop_id?.trim() || row.team_rop_user_id?.trim()) ||
          row.has_assignment_rop === true,
      });
    }
    for (const key of keysArr) {
      if (!catalogMeta.has(key)) {
        catalogMeta.set(key, {
          externalKey: key,
          fullName: key,
          city: null,
          managerUserId: null,
          managerFullName: null,
          inn: null,
          phone: null,
          legalEntity: false,
          tradePointIds: tpByDealer.get(key) ?? [],
          tradePointsCount: (tpByDealer.get(key) ?? []).length,
          hasManager: false,
          hasRegional: false,
          hasRop: false,
        });
      }
    }
  }

  const rows = await pool.query<ActualizationDedupeStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
       FROM client_base_actualization_state
      WHERE scope_key LIKE 'user:%'`,
  );
  const statesByUser = new Map<string, Record<string, unknown>[]>();
  for (const row of rows.rows) {
    const scopeId = scopeUserId(String(row.scope_key));
    const owner = row.user_id && UUID_RE.test(row.user_id) ? row.user_id : scopeId ? legacyScopeToUuid(scopeId) : null;
    if (!owner || !allowed.has(owner)) continue;
    const arr = statesByUser.get(owner) ?? [];
    arr.push(coerceActualizationState(row.state));
    statesByUser.set(owner, arr);
  }

  const actualizationClients: ClientBaseActualizationClient[] = [];
  for (const userId of Array.from(allowed)) {
    const merged = mergeActualizationStates(statesByUser.get(userId) ?? [actualizationEmptyState()]);
    const meta = userMeta(userId, usersById);
    const manualDealers = stateRecord(merged.manuallyCreatedDealersById);
    const dealerOverrides = stateRecord(merged.dealerOverridesById);
    const legalByDealer = stateRecord(merged.legalEntityOverridesByDealerId);
    const manualTp = stateRecord(merged.manuallyCreatedTradePointsById);
    const addClient = (id: string, fields: Record<string, unknown>, fallbackDate?: unknown) => {
      const normalizedStatus = normalizeClientBaseStatus(stateString(fields.status));
      if (normalizedStatus === "archived") return;
      const tpIds = Object.entries(manualTp)
        .filter(([, raw]) => {
          const dealerId = stateString(stateRecord(raw).dealerId);
          return dealerId === id || resolveClientExternalKey(dealerId, catalogKeys) === resolveClientExternalKey(id, catalogKeys);
        })
        .map(([tpId]) => tpId);
      actualizationClients.push({
        id,
        fullName: stateString(fields.name) || stateString(fields.dealerName) || id,
        city: stateString(fields.city) || null,
        managerUserId: userId,
        managerFullName: meta.fullName,
        inn: stateString(fields.inn) || null,
        phone: stateString(fields.phone) || null,
        legalEntity: Boolean(legalByDealer[id]),
        normalizedStatus,
        updatedAt: stateDate(fields, fallbackDate),
        tradePointIds: tpIds,
      });
    };
    for (const [id, raw] of Object.entries(manualDealers)) {
      const m = stateRecord(raw);
      addClient(id, stateRecord(m.fields), m.updatedAt ?? m.createdAt);
    }
    for (const [id, raw] of Object.entries(dealerOverrides)) {
      const ov = stateRecord(raw);
      const fields = stateRecord(ov.fields);
      if (!stateString(fields.phone) && !stateString(fields.email) && !stateString(fields.inn) && !stateString(fields.name) && !stateString(fields.dealerName)) {
        continue;
      }
      addClient(id, fields, ov.updatedAt);
    }
  }

  const staleCutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const clients = mergeClientBaseClientsList({
    catalogKeys,
    catalogMeta,
    actualizationClients,
    staleCutoffMs,
  });

  const viewerScope = await computeDbScopeForUser(pool, me.id, me.role as import("../../shared/auth.js").UserRole);
  const scopedTpRows =
    me.role === "regional_manager"
      ? []
      : await fetchScopedTradePointsRows(pool, viewerScope, { activeOnly: true });
  const tradePoints = scopedTpRows.map((row) => {
    const tp = mapScopedTradePointRow(row);
    return {
      id: tp.externalKey || tp.id,
      name: tp.name,
      address: tp.address ?? "",
      city: tp.city ?? tp.dealerCity ?? "",
      clientId: tp.dealerExternalKey,
      hasPhoto: false,
      hasStorefront: false,
      updatedAt: null as string | null,
    };
  });

  const activeCount = clients.filter((c) => c.status === "active").length;
  const inCatalogCount = clients.filter((c) => c.inCatalog).length;
  if (inCatalogCount !== catalogKeys.size) {
    console.warn("[client-base-clients-list] catalog count mismatch", {
      inCatalogCount,
      catalogKeys: catalogKeys.size,
    });
  }

  sendJson(res, 200, {
    success: true,
    generatedAt: new Date().toISOString(),
    clients,
    tradePoints,
    meta: {
      catalogTotal: catalogKeys.size,
      activeCount,
      tradePointsCount: tradePoints.length,
    },
  });
}

async function handleClientBaseManagerDetail(
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
  if (!["admin", "director", "rop", "manager", "category_manager"].includes(me.role) || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const managerUserId = queryStringParam(req, "managerUserId");
  if (!managerUserId || !UUID_RE.test(managerUserId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите managerUserId." });
    return;
  }
  if (me.role === "manager" && managerUserId !== me.id) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (me.role === "rop" && (await denyIfRopCannotAccessUser(res, pool, me, managerUserId))) return;

  const users = await pool.query<ActualizationStatsUserRow>(
    `SELECT u.id, u.full_name, u.role, t.id AS team_id, t.name AS team_name, t.rop_user_id, ropu.full_name AS rop_full_name
       FROM users u
       LEFT JOIN user_team_memberships m ON m.user_id = u.id
       LEFT JOIN teams t ON t.id = m.team_id
       LEFT JOIN users ropu ON ropu.id = t.rop_user_id
      WHERE u.status = 'active'`,
  );
  const usersById = new Map<string, ActualizationStatsUserRow>();
  for (const u of users.rows) if (!usersById.has(u.id)) usersById.set(u.id, u);
  const meta = userMeta(managerUserId, usersById);

  const rows = await pool.query<ActualizationDedupeStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
       FROM client_base_actualization_state
      WHERE scope_key LIKE 'user:%'`,
  );
  const states: Record<string, unknown>[] = [];
  for (const row of rows.rows) {
    const scopeId = scopeUserId(String(row.scope_key));
    const owner = row.user_id && UUID_RE.test(row.user_id) ? row.user_id : scopeId ? legacyScopeToUuid(scopeId) : null;
    if (owner === managerUserId) states.push(coerceActualizationState(row.state));
  }
  const merged = mergeActualizationStates(states.length > 0 ? states : [actualizationEmptyState()]);
  const clients: Array<Record<string, unknown>> = [];
  const tradePoints: Array<Record<string, unknown>> = [];
  const legalByDealer = stateRecord(merged.legalEntityOverridesByDealerId);
  const addClient = (id: string, fields: Record<string, unknown>, fallbackDate?: unknown) => {
    const status = normalizeClientBaseStatus(stateString(fields.status));
    if (status === "archived") return;
    const tpIds = Object.entries(stateRecord(merged.manuallyCreatedTradePointsById))
      .filter(([, raw]) => stateString(stateRecord(raw).dealerId) === id)
      .map(([tpId]) => tpId);
    clients.push({
      id,
      fullName: stateString(fields.name) || stateString(fields.dealerName) || id,
      inn: stateString(fields.inn) || null,
      phone: stateString(fields.phone) || null,
      legalEntity: Boolean(legalByDealer[id]),
      city: stateString(fields.city) || null,
      status,
      tradePointIds: tpIds,
      tradePointsCount: tpIds.length,
      updatedAt: stateDate(fields, fallbackDate),
      dealerProfileId: id,
    });
  };
  for (const [id, raw] of Object.entries(stateRecord(merged.manuallyCreatedDealersById))) {
    const m = stateRecord(raw);
    addClient(id, stateRecord(m.fields), m.updatedAt ?? m.createdAt);
  }
  for (const [id, raw] of Object.entries(stateRecord(merged.dealerOverridesById))) {
    const ov = stateRecord(raw);
    const fields = stateRecord(ov.fields);
    if (!stateString(fields.phone) && !stateString(fields.email) && !stateString(fields.inn) && !stateString(fields.name) && !stateString(fields.dealerName)) continue;
    addClient(id, fields, ov.updatedAt);
  }
  const clientIds = new Set(clients.map((c) => String(c.id)));
  const photos = stateRecord(merged.tradePointPhotosByTradePointId);
  const showcase = stateRecord(merged.tradePointShowcaseActualizationById);
  for (const [id, raw] of Object.entries(stateRecord(merged.manuallyCreatedTradePointsById))) {
    const tp = stateRecord(raw);
    const fields = stateRecord(tp.fields);
    const clientId = stateString(tp.dealerId);
    if (!clientIds.has(clientId)) continue;
    tradePoints.push({
      id,
      name: stateString(fields.name) || id,
      address: stateString(fields.address),
      city: stateString(fields.city),
      clientId,
      hasPhoto: Array.isArray(photos[id]) && (photos[id] as unknown[]).length > 0,
      hasStorefront: Boolean(showcase[id]),
      updatedAt: stateDate(fields, tp.updatedAt ?? tp.createdAt),
    });
  }
  sendJson(res, 200, {
    success: true,
    manager: {
      userId: managerUserId,
      fullName: meta.fullName,
      teamId: meta.teamId,
      ropFullName: meta.ropFullName,
    },
    clients: clients.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), "ru")),
    tradePoints,
  });
}

type TradePointAggRow = {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  clientId: string;
  hasPhoto: boolean;
  notFilled: boolean;
  updatedAt: string;
  userId: string;
};

type TradePointOwnerClient = {
  id: string;
  fullName: string;
  city: string | null;
  status: "active" | "potential" | "attention";
};

function collectTradePointsForUser(
  userId: string,
  states: Record<string, unknown>[],
): { tradePoints: TradePointAggRow[]; clientsById: Map<string, TradePointOwnerClient> } {
  const merged = mergeActualizationStates(states.length > 0 ? states : [actualizationEmptyState()]);
  const clientsById = new Map<string, TradePointOwnerClient>();
  const collectClient = (id: string, fields: Record<string, unknown>): void => {
    const status = normalizeClientBaseStatus(stateString(fields.status));
    if (status === "archived") return;
    if (clientsById.has(id)) return;
    clientsById.set(id, {
      id,
      fullName: stateString(fields.name) || stateString(fields.dealerName) || id,
      city: stateString(fields.city) || null,
      status,
    });
  };
  for (const [id, raw] of Object.entries(stateRecord(merged.manuallyCreatedDealersById))) {
    const m = stateRecord(raw);
    collectClient(id, stateRecord(m.fields));
  }
  for (const [id, raw] of Object.entries(stateRecord(merged.dealerOverridesById))) {
    const ov = stateRecord(raw);
    const fields = stateRecord(ov.fields);
    if (
      !stateString(fields.phone) &&
      !stateString(fields.email) &&
      !stateString(fields.inn) &&
      !stateString(fields.name) &&
      !stateString(fields.dealerName)
    ) {
      continue;
    }
    collectClient(id, fields);
  }
  const photos = stateRecord(merged.tradePointPhotosByTradePointId);
  const tradePoints: TradePointAggRow[] = [];
  for (const [id, raw] of Object.entries(stateRecord(merged.manuallyCreatedTradePointsById))) {
    const tp = stateRecord(raw);
    const fields = stateRecord(tp.fields);
    const clientId = stateString(tp.dealerId);
    if (!clientId || !clientsById.has(clientId)) continue;
    const address = stateString(fields.address) || null;
    const city = stateString(fields.city) || null;
    const photoArr = Array.isArray(photos[id]) ? (photos[id] as unknown[]) : [];
    const photoUrl = stateString(fields.photoUrl);
    const hasPhotoFlag = fields.hasPhoto === true;
    tradePoints.push({
      id,
      name: stateString(fields.name) || null,
      address,
      city,
      clientId,
      hasPhoto: photoArr.length > 0 || photoUrl.length > 0 || hasPhotoFlag,
      notFilled: !address || !city,
      updatedAt: stateDate(fields, tp.updatedAt ?? tp.createdAt) ?? new Date(0).toISOString(),
      userId,
    });
  }
  return { tradePoints, clientsById };
}

/** client_code → responsible_user_id (все строки client_assignments). */
async function loadActiveClientAssignmentsByClient(pool: PoolLike): Promise<Map<string, string>> {
  try {
    const r = await pool.query<{ client_code: string; responsible_user_id: string }>(
      `SELECT client_code, responsible_user_id FROM client_assignments`,
    );
    const m = new Map<string, string>();
    for (const row of r.rows) {
      if (row.client_code && row.responsible_user_id) m.set(row.client_code, row.responsible_user_id);
    }
    return m;
  } catch (err) {
    console.warn("[trade-points-overview] client_assignments unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return new Map();
  }
}

function resolveAssignmentUserId(
  clientId: string,
  assignmentByClient: Map<string, string>,
  allowed: Set<string>,
): string | null {
  const assignee = assignmentByClient.get(clientId) ?? null;
  if (!assignee || !allowed.has(assignee)) return null;
  return assignee;
}

function pickTradePointWinner(
  cur: TradePointAggRow,
  candidate: TradePointAggRow,
  assignmentByClient: Map<string, string>,
  allowed: Set<string>,
): TradePointAggRow {
  const assignee = resolveAssignmentUserId(candidate.clientId, assignmentByClient, allowed);
  if (assignee) {
    if (cur.userId === assignee && candidate.userId !== assignee) return cur;
    if (candidate.userId === assignee && cur.userId !== assignee) return candidate;
  }
  const curT = Date.parse(cur.updatedAt) || 0;
  const newT = Date.parse(candidate.updatedAt) || 0;
  if (newT > curT) return candidate;
  if (newT < curT) return cur;
  return candidate.userId < cur.userId ? candidate : cur;
}

/**
 * Промт 44 A1. Активность менеджера за период.
 *
 * Возвращает per-period stats и полный список клиентов / ТТ менеджера (сортированных по updatedAt desc).
 * Согласно спецификации C8.1 — clients/tradePoints возвращаем полностью; stats считаем по периоду
 * (так Sheet рендерится без отдельной выгрузки). UI решает, как фильтровать визуально.
 */
async function handleManagerActivityDetail(
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
  if (!["admin", "director", "rop", "manager", "category_manager"].includes(me.role) || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const managerUserId = queryStringParam(req, "managerUserId");
  if (!managerUserId || !UUID_RE.test(managerUserId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите managerUserId." });
    return;
  }
  if (me.role === "manager" && managerUserId !== me.id) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (me.role === "rop" && (await denyIfRopCannotAccessUser(res, pool, me, managerUserId))) return;

  const now = new Date();
  const from = parseIsoOr(queryStringParam(req, "fromIso"), new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const to = parseIsoOr(queryStringParam(req, "toIso"), now);

  const users = await pool.query<ActualizationStatsUserRow>(
    `SELECT u.id, u.full_name, u.role, t.id AS team_id, t.name AS team_name, t.rop_user_id, ropu.full_name AS rop_full_name
       FROM users u
       LEFT JOIN user_team_memberships m ON m.user_id = u.id
       LEFT JOIN teams t ON t.id = m.team_id
       LEFT JOIN users ropu ON ropu.id = t.rop_user_id
      WHERE u.status = 'active'`,
  );
  const usersById = new Map<string, ActualizationStatsUserRow>();
  for (const u of users.rows) if (!usersById.has(u.id)) usersById.set(u.id, u);
  const meta = userMeta(managerUserId, usersById);

  const rows = await pool.query<ActualizationDedupeStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
       FROM client_base_actualization_state
      WHERE scope_key LIKE 'user:%'`,
  );
  const states: Record<string, unknown>[] = [];
  for (const row of rows.rows) {
    const scopeId = scopeUserId(String(row.scope_key));
    const owner = row.user_id && UUID_RE.test(row.user_id) ? row.user_id : scopeId ? legacyScopeToUuid(scopeId) : null;
    if (owner === managerUserId) states.push(coerceActualizationState(row.state));
  }
  const merged = mergeActualizationStates(states.length > 0 ? states : [actualizationEmptyState()]);

  const legalByDealer = stateRecord(merged.legalEntityOverridesByDealerId);
  const photos = stateRecord(merged.tradePointPhotosByTradePointId);

  type DealerCollected = {
    id: string;
    fullName: string;
    inn: string | null;
    phone: string | null;
    legalEntity: boolean;
    city: string | null;
    status: "active" | "potential" | "attention";
    addedAtIso: string | null;
    updatedAtIso: string | null;
  };

  const clientById = new Map<string, DealerCollected>();
  const addClient = (id: string, fields: Record<string, unknown>, addedAtIso: string | null, updatedAtIso: string | null): void => {
    const status = normalizeClientBaseStatus(stateString(fields.status));
    if (status === "archived") return;
    const prev = clientById.get(id);
    if (prev) {
      // Если запись уже есть — обновляем «свежими» полями, обновляем дату updatedAt.
      const merged: DealerCollected = {
        ...prev,
        fullName: stateString(fields.name) || stateString(fields.dealerName) || prev.fullName,
        inn: stateString(fields.inn) || prev.inn,
        phone: stateString(fields.phone) || prev.phone,
        city: stateString(fields.city) || prev.city,
        legalEntity: prev.legalEntity || Boolean(legalByDealer[id]),
        status,
        updatedAtIso:
          updatedAtIso && (!prev.updatedAtIso || updatedAtIso > prev.updatedAtIso) ? updatedAtIso : prev.updatedAtIso,
        addedAtIso:
          prev.addedAtIso ?? addedAtIso ?? null,
      };
      clientById.set(id, merged);
      return;
    }
    clientById.set(id, {
      id,
      fullName: stateString(fields.name) || stateString(fields.dealerName) || id,
      inn: stateString(fields.inn) || null,
      phone: stateString(fields.phone) || null,
      legalEntity: Boolean(legalByDealer[id]),
      city: stateString(fields.city) || null,
      status,
      addedAtIso,
      updatedAtIso,
    });
  };
  for (const [id, raw] of Object.entries(stateRecord(merged.manuallyCreatedDealersById))) {
    const m = stateRecord(raw);
    const fields = stateRecord(m.fields);
    const added = stateDate(fields, m.createdAt);
    const updated = stateDate(fields, m.updatedAt ?? m.createdAt) ?? added;
    addClient(id, fields, added, updated);
  }
  for (const [id, raw] of Object.entries(stateRecord(merged.dealerOverridesById))) {
    const ov = stateRecord(raw);
    const fields = stateRecord(ov.fields);
    if (
      !stateString(fields.phone) &&
      !stateString(fields.email) &&
      !stateString(fields.inn) &&
      !stateString(fields.name) &&
      !stateString(fields.dealerName)
    ) {
      continue;
    }
    const updated = stateDate(fields, ov.updatedAt);
    addClient(id, fields, null, updated);
  }

  type TpCollected = {
    id: string;
    name: string | null;
    address: string | null;
    city: string | null;
    hasPhoto: boolean;
    notFilled: boolean;
    clientId: string;
    addedAtIso: string | null;
    updatedAtIso: string | null;
  };
  const tpById = new Map<string, TpCollected>();
  for (const [id, raw] of Object.entries(stateRecord(merged.manuallyCreatedTradePointsById))) {
    const tp = stateRecord(raw);
    const fields = stateRecord(tp.fields);
    const clientId = stateString(tp.dealerId);
    if (!clientId || !clientById.has(clientId)) continue;
    const address = stateString(fields.address) || null;
    const city = stateString(fields.city) || null;
    const photoArr = Array.isArray(photos[id]) ? (photos[id] as unknown[]) : [];
    const photoUrl = stateString(fields.photoUrl);
    const hasPhotoFlag = fields.hasPhoto === true;
    const added = stateDate(fields, tp.createdAt);
    const updated = stateDate(fields, tp.updatedAt ?? tp.createdAt) ?? added;
    tpById.set(id, {
      id,
      name: stateString(fields.name) || null,
      address,
      city,
      hasPhoto: photoArr.length > 0 || photoUrl.length > 0 || hasPhotoFlag,
      notFilled: !address || !city,
      clientId,
      addedAtIso: added,
      updatedAtIso: updated,
    });
  }

  const tpCountByClient = new Map<string, number>();
  tpById.forEach((tp) => {
    tpCountByClient.set(tp.clientId, (tpCountByClient.get(tp.clientId) ?? 0) + 1);
  });

  const clientsArr = Array.from(clientById.values()).map((c) => ({
    id: c.id,
    fullName: c.fullName,
    inn: c.inn,
    phone: c.phone,
    legalEntity: c.legalEntity,
    city: c.city,
    status: c.status,
    tradePointsCount: tpCountByClient.get(c.id) ?? 0,
    dealerProfileId: c.id,
    addedAtIso: c.addedAtIso,
    updatedAtIso: c.updatedAtIso,
    problems: {
      noInn: !c.inn,
      noPhone: !c.phone,
      noLegalEntity: !c.legalEntity,
      noTradePoint: (tpCountByClient.get(c.id) ?? 0) === 0,
    },
  }));
  clientsArr.sort((a, b) => {
    const ua = a.updatedAtIso ?? a.addedAtIso ?? "";
    const ub = b.updatedAtIso ?? b.addedAtIso ?? "";
    return ub.localeCompare(ua);
  });

  const tpsArr = Array.from(tpById.values()).map((tp) => {
    const owner = clientById.get(tp.clientId);
    return {
      id: tp.id,
      name: tp.name,
      address: tp.address,
      city: tp.city,
      hasPhoto: tp.hasPhoto,
      notFilled: tp.notFilled,
      clientId: tp.clientId,
      clientFullName: owner?.fullName ?? tp.clientId,
      clientDealerProfileId: tp.clientId,
      addedAtIso: tp.addedAtIso,
      updatedAtIso: tp.updatedAtIso,
      problems: { noAddress: !tp.address, noPhoto: !tp.hasPhoto },
    };
  });
  tpsArr.sort((a, b) => {
    const ua = a.updatedAtIso ?? a.addedAtIso ?? "";
    const ub = b.updatedAtIso ?? b.addedAtIso ?? "";
    return ub.localeCompare(ua);
  });

  const clientsAdded = clientsArr.filter((c) => c.addedAtIso && inPeriod(c.addedAtIso, from, to)).length;
  const clientsUpdated = clientsArr.filter((c) => c.updatedAtIso && inPeriod(c.updatedAtIso, from, to)).length;
  const tradePointsAdded = tpsArr.filter((tp) => tp.addedAtIso && inPeriod(tp.addedAtIso, from, to)).length;
  const tradePointsUpdated = tpsArr.filter((tp) => tp.updatedAtIso && inPeriod(tp.updatedAtIso, from, to)).length;
  const allTimestamps = [
    ...clientsArr.map((c) => c.updatedAtIso ?? c.addedAtIso),
    ...tpsArr.map((tp) => tp.updatedAtIso ?? tp.addedAtIso),
  ].filter((iso): iso is string => !!iso);
  const lastActivityIso = allTimestamps.length > 0 ? allTimestamps.sort().pop() ?? null : null;
  const updatesInPeriod = clientsUpdated + tradePointsUpdated;
  const score = clientsAdded * 5 + tradePointsAdded * 2 + Math.min(updatesInPeriod, 50);

  sendJson(res, 200, {
    success: true,
    manager: {
      userId: managerUserId,
      fullName: meta.fullName,
      teamId: meta.teamId,
      teamName: meta.teamName,
      ropFullName: meta.ropFullName,
    },
    period: { fromIso: from.toISOString(), toIso: to.toISOString() },
    stats: {
      clientsAdded,
      clientsUpdated,
      tradePointsAdded,
      tradePointsUpdated,
      lastActivityIso,
      score,
    },
    clients: clientsArr,
    tradePoints: tpsArr,
  });
}

async function loadShowcaseStatsForOverview(
  pool: PoolLike,
): Promise<Map<string, { withoutPhoto: boolean; notFilled: boolean }>> {
  const rows = await pool.query<{ state: unknown }>(
    `SELECT state FROM client_base_actualization_state WHERE scope_key LIKE 'user:%'`,
  );
  const map = new Map<string, { withoutPhoto: boolean; notFilled: boolean }>();
  for (const row of rows.rows) {
    const s = coerceActualizationState(row.state);
    const photos = stateRecord(s.tradePointPhotosByTradePointId);
    for (const [id, raw] of Object.entries(stateRecord(s.manuallyCreatedTradePointsById))) {
      const tp = stateRecord(raw);
      const fields = stateRecord(tp.fields);
      const photoArr = Array.isArray(photos[id]) ? (photos[id] as unknown[]) : [];
      const photoUrl = stateString(fields.photoUrl);
      const hasPhotoFlag = fields.hasPhoto === true;
      const hasPhoto = photoArr.length > 0 || photoUrl.length > 0 || hasPhotoFlag;
      const address = stateString(fields.address);
      const city = stateString(fields.city);
      map.set(id, { withoutPhoto: !hasPhoto, notFilled: !address || !city });
    }
  }
  return map;
}

async function resolveViewerOwnTeam(
  pool: PoolLike,
  userId: string,
  role: string,
): Promise<TradePointsOverviewViewerTeam | null> {
  if (role !== "rop" && role !== "regional_manager") return null;
  const r = await pool.query<{
    team_id: string;
    team_name: string;
    rop_user_id: string | null;
    rop_full_name: string | null;
  }>(
    `SELECT t.id::text AS team_id, t.name AS team_name,
            t.rop_user_id::text AS rop_user_id, u.full_name AS rop_full_name
       FROM user_team_memberships m
       JOIN teams t ON t.id = m.team_id
       LEFT JOIN users u ON u.id = t.rop_user_id
      WHERE m.user_id = $1::uuid
      ORDER BY (t.rop_user_id = $1::uuid) DESC, t.name
      LIMIT 1`,
    [userId],
  );
  let row = r.rows[0];
  if (!row && role === "rop") {
    const ropOwned = await pool.query<{
      team_id: string;
      team_name: string;
      rop_user_id: string | null;
      rop_full_name: string | null;
    }>(
      `SELECT t.id::text AS team_id, t.name AS team_name,
              t.rop_user_id::text AS rop_user_id, u.full_name AS rop_full_name
         FROM teams t
         LEFT JOIN users u ON u.id = t.rop_user_id
        WHERE t.rop_user_id = $1::uuid
        ORDER BY t.name
        LIMIT 1`,
      [userId],
    );
    row = ropOwned.rows[0];
  }
  if (!row) return null;
  return {
    teamId: row.team_id,
    teamName: row.team_name?.trim() || "Моя команда",
    ropUserId: row.rop_user_id,
    ropFullName: row.rop_full_name?.trim() || "—",
  };
}

async function handleTradePointsOverview(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  let me: Awaited<ReturnType<typeof resolveCurrentUser>> | undefined;
  try {
    me = await resolveCurrentUser(pool, headers);
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (!["admin", "director", "rop", "manager", "regional_manager", "category_manager"].includes(me.role) || me.status !== "active") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }

    let showcaseMap = new Map<string, { withoutPhoto: boolean; notFilled: boolean }>();
    try {
      showcaseMap = await loadShowcaseStatsForOverview(pool);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[trade-points-overview] showcase stats failed", { userId: me.id, role: me.role, message: m });
    }

    const viewerTeam = await resolveViewerOwnTeam(pool, me.id, me.role);
    const payload = await buildTradePointsOverviewFromDb(
      pool,
      me.id,
      me.role as import("../../shared/auth.js").UserRole,
      showcaseMap,
      viewerTeam,
    );
    sendJson(res, 200, payload);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[trade-points-overview] failed", {
      message: m,
      stack,
      userId: me?.id,
      role: me?.role,
    });
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Не удалось загрузить обзор торговых точек." });
  }
}


/** Сумма TP-объектов по всем state-записям пользователя без merge/dedup между записями. */
function countRawTpObjectsAcrossStates(states: Record<string, unknown>[]): number {
  let sum = 0;
  for (const st of states) {
    const s = coerceActualizationState(st);
    const tps = stateRecord(s.manuallyCreatedTradePointsById);
    sum += Object.keys(tps).length;
  }
  return sum;
}

/** Read-only диагностика расхождения числа ТТ (промт 87). */
async function handleTpCountDiag(
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
  if (!["admin", "director", "rop", "analyst"].includes(me.role) || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const filterUserId = queryStringParam(req, "userId");
  if (filterUserId && !UUID_RE.test(filterUserId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный userId." });
    return;
  }

  const users = await pool.query<ActualizationStatsUserRow>(
    `SELECT u.id, u.full_name, u.role, t.id AS team_id, t.name AS team_name, t.rop_user_id, ropu.full_name AS rop_full_name
       FROM users u
       LEFT JOIN user_team_memberships m ON m.user_id = u.id
       LEFT JOIN teams t ON t.id = m.team_id
       LEFT JOIN users ropu ON ropu.id = t.rop_user_id
      WHERE u.status = 'active'`,
  );
  const usersById = new Map<string, ActualizationStatsUserRow>();
  for (const u of users.rows) if (!usersById.has(u.id)) usersById.set(u.id, u);

  let allowed = new Set(users.rows.map((u) => u.id));
  if (me.role === "rop") {
    allowed = new Set(users.rows.filter((u) => u.rop_user_id === me.id || u.id === me.id).map((u) => u.id));
    allowed.add(me.id);
  }

  if (filterUserId) {
    if (!allowed.has(filterUserId)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав для userId." });
      return;
    }
    allowed = new Set([filterUserId]);
  }

  const rows = await pool.query<ActualizationDedupeStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
       FROM client_base_actualization_state
      WHERE scope_key LIKE 'user:%'`,
  );
  const statesByUser = new Map<string, Record<string, unknown>[]>();
  for (const row of rows.rows) {
    const scopeId = scopeUserId(String(row.scope_key));
    const owner = row.user_id && UUID_RE.test(row.user_id) ? row.user_id : scopeId ? legacyScopeToUuid(scopeId) : null;
    if (!owner || !allowed.has(owner)) continue;
    const arr = statesByUser.get(owner) ?? [];
    arr.push(coerceActualizationState(row.state));
    statesByUser.set(owner, arr);
  }

  const perUser: Array<{
    userId: string;
    fullName: string;
    teamId: string | null;
    rawStateRecords: number;
    rawTpCountAcrossStates: number;
    uniqueTpAfterCollect: number;
    uniqueClients: number;
    withoutPhoto: number;
    notFilled: number;
  }> = [];

  const globalTpById = new Map<string, TradePointAggRow>();

  for (const userId of Array.from(allowed)) {
    const states = statesByUser.get(userId) ?? [];
    const rawTpCountAcrossStates = countRawTpObjectsAcrossStates(states);
    const { tradePoints, clientsById } = collectTradePointsForUser(userId, states);
    const meta = userMeta(userId, usersById);
    for (const tp of tradePoints) {
      if (!globalTpById.has(tp.id)) globalTpById.set(tp.id, tp);
    }
    perUser.push({
      userId,
      fullName: meta.fullName,
      teamId: meta.teamId,
      rawStateRecords: states.length,
      rawTpCountAcrossStates,
      uniqueTpAfterCollect: tradePoints.length,
      uniqueClients: clientsById.size,
      withoutPhoto: tradePoints.filter((tp) => !tp.hasPhoto).length,
      notFilled: tradePoints.filter((tp) => tp.notFilled).length,
    });
  }

  perUser.sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));

  const totals = {
    sumRawAcrossStates: perUser.reduce((s, u) => s + u.rawTpCountAcrossStates, 0),
    sumUniqueAfterCollect: perUser.reduce((s, u) => s + u.uniqueTpAfterCollect, 0),
    globalUniqueTpById: globalTpById.size,
  };

  sendJson(res, 200, {
    success: true,
    actorRole: me.role,
    actorUserId: me.id,
    allowedUserCount: allowed.size,
    filterUserId: filterUserId || null,
    perUser,
    totals,
  });
}

async function handleTradePointsManagerDetail(
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
  if (!["admin", "director", "rop", "manager", "category_manager"].includes(me.role) || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const managerUserId = queryStringParam(req, "managerUserId");
  if (!managerUserId || !UUID_RE.test(managerUserId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите managerUserId." });
    return;
  }
  if (me.role === "manager" && managerUserId !== me.id) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  if (me.role === "rop" && (await denyIfRopCannotAccessUser(res, pool, me, managerUserId))) return;

  const users = await pool.query<ActualizationStatsUserRow>(
    `SELECT u.id, u.full_name, u.role, t.id AS team_id, t.name AS team_name, t.rop_user_id, ropu.full_name AS rop_full_name
       FROM users u
       LEFT JOIN user_team_memberships m ON m.user_id = u.id
       LEFT JOIN teams t ON t.id = m.team_id
       LEFT JOIN users ropu ON ropu.id = t.rop_user_id
      WHERE u.status = 'active'`,
  );
  const usersById = new Map<string, ActualizationStatsUserRow>();
  for (const u of users.rows) if (!usersById.has(u.id)) usersById.set(u.id, u);
  const meta = userMeta(managerUserId, usersById);

  const rows = await pool.query<ActualizationDedupeStateRow>(
    `SELECT scope_key, user_id, role, state, updated_at
       FROM client_base_actualization_state
      WHERE scope_key LIKE 'user:%'`,
  );
  const states: Record<string, unknown>[] = [];
  for (const row of rows.rows) {
    const scopeId = scopeUserId(String(row.scope_key));
    const owner = row.user_id && UUID_RE.test(row.user_id) ? row.user_id : scopeId ? legacyScopeToUuid(scopeId) : null;
    if (owner === managerUserId) states.push(coerceActualizationState(row.state));
  }

  const { tradePoints: aggTpsRaw, clientsById: clientsByIdRaw } = collectTradePointsForUser(managerUserId, states);

  let aggTps = aggTpsRaw;
  let clientsById = clientsByIdRaw;
  if (me.role === "rop" && shouldIntersectManagerDetailWithRopViewerScope(me.role, me.id, managerUserId)) {
    try {
      const viewerScope = await computeDbScopeForUser(pool, me.id, "rop");
      const filtered = filterManagerDetailByRopViewerScope({
        clientsById,
        tradePoints: aggTps,
        viewerScopeExternalKeys: viewerScope.active_dealer_external_keys,
      });
      clientsById = filtered.clientsById;
      aggTps = filtered.tradePoints;
    } catch (err) {
      console.warn("[trade-points-manager-detail] rop viewer scope filter failed", {
        ropUserId: me.id,
        managerUserId,
        message: err instanceof Error ? err.message : String(err),
      });
      clientsById = new Map();
      aggTps = [];
    }
  }

  const tpCountByClient = new Map<string, number>();
  for (const tp of aggTps) {
    tpCountByClient.set(tp.clientId, (tpCountByClient.get(tp.clientId) ?? 0) + 1);
  }

  const tradePoints = aggTps.map((tp) => {
    const owner = clientsById.get(tp.clientId);
    return {
      id: tp.id,
      name: tp.name,
      address: tp.address,
      city: tp.city,
      hasPhoto: tp.hasPhoto,
      notFilled: tp.notFilled,
      clientId: tp.clientId,
      clientFullName: owner?.fullName ?? tp.clientId,
      clientStatus: (owner?.status ?? "active") as "active" | "potential" | "attention",
      dealerProfileId: tp.clientId,
      updatedAt: tp.updatedAt,
    };
  });
  tradePoints.sort((a, b) => {
    const c = a.clientFullName.localeCompare(b.clientFullName, "ru");
    if (c !== 0) return c;
    return (a.name ?? "").localeCompare(b.name ?? "", "ru");
  });

  const clients = Array.from(clientsById.values())
    .map((c) => ({
      id: c.id,
      fullName: c.fullName,
      city: c.city,
      status: c.status,
      tradePointsCount: tpCountByClient.get(c.id) ?? 0,
      dealerProfileId: c.id,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));

  sendJson(res, 200, {
    success: true,
    manager: {
      userId: managerUserId,
      fullName: meta.fullName,
      teamId: meta.teamId,
      ropFullName: meta.ropFullName,
    },
    tradePoints,
    clients,
  });
}

async function handleMigrateMgrScopes(res: VercelResponse, pool: PoolLike): Promise<void> {
  const migrated: MgrScopeMigrationRow[] = [];

  for (const [mgrId, uuid] of Object.entries(MGR_TO_UUID)) {
    const mgrScopeKey = `user:${mgrId}`;
    const uuidScopeKey = `user:${uuid}`;
    const mgrRows = await pool.query<ActualizationStateRow>(
      `SELECT state, updated_at FROM client_base_actualization_state WHERE scope_key = $1 LIMIT 1`,
      [mgrScopeKey],
    );
    const mgrRow = mgrRows.rows[0];
    if (!mgrRow) {
      migrated.push({ mgrId, uuid, action: "skipped" });
      continue;
    }

    const uuidRows = await pool.query<ActualizationStateRow>(
      `SELECT state, updated_at FROM client_base_actualization_state WHERE scope_key = $1 LIMIT 1`,
      [uuidScopeKey],
    );
    const uuidRow = uuidRows.rows[0];
    const mgrState = coerceActualizationState(mgrRow.state);

    if (!uuidRow) {
      await pool.query(
        `INSERT INTO client_base_actualization_state (scope_key, user_id, role, state, version)
         VALUES ($1, $2, NULL, $3::jsonb, 1)`,
        [uuidScopeKey, uuid, JSON.stringify(mgrState)],
      );
      await pool.query(`DELETE FROM client_base_actualization_state WHERE scope_key = $1`, [mgrScopeKey]);
      migrated.push({ mgrId, uuid, action: "inserted" });
      continue;
    }

    const uuidState = coerceActualizationState(uuidRow.state);
    const merged = mergeActualizationStates([mgrState, uuidState]);
    await pool.query(`UPDATE client_base_actualization_state SET state = $2::jsonb WHERE scope_key = $1`, [
      uuidScopeKey,
      JSON.stringify(merged),
    ]);
    await pool.query(`DELETE FROM client_base_actualization_state WHERE scope_key = $1`, [mgrScopeKey]);
    migrated.push({ mgrId, uuid, action: "merged" });
  }

  const report = { success: true, migrated, total: migrated.length };
  console.log("[api/admin] migrate-mgr-scopes", report);
  sendJson(res, 200, report);
}

async function handleMigrationsRun(
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
  if (me.role !== "admin" || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только администратор." });
    return;
  }
  if (pickMigrationsRunAction(req) === "migrate-mgr-scopes") {
    await handleMigrateMgrScopes(res, pool);
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

    await pool.query(
      `CREATE TABLE IF NOT EXISTS password_reset_requests (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         requester_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         approver_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
         status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','expired','cancelled')),
         created_at timestamptz NOT NULL DEFAULT NOW(),
         expires_at timestamptz NOT NULL,
         resolved_at timestamptz,
         reset_link_id uuid REFERENCES password_reset_links(id) ON DELETE SET NULL
       )`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_prr_approver_pending ON password_reset_requests(approver_user_id) WHERE status = 'pending'`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_prr_requester ON password_reset_requests(requester_user_id)`);
    applied.push("password_reset_requests table");

    await pool.query(`ALTER TABLE audit_log ALTER COLUMN actor_user_id DROP NOT NULL`);
    applied.push("audit_log.actor_user_id nullable");

    await pool.query(`DELETE FROM sessions WHERE expires_at < NOW() AND revoked_at IS NULL`);
    applied.push("sessions cleanup (initial)");

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz`);
    applied.push("users.onboarding_completed_at");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS telegram_link_tokens (
         token_hash text PRIMARY KEY,
         user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         expires_at timestamptz NOT NULL,
         used_at timestamptz
       )`,
    );
    applied.push("telegram_link_tokens table");

    // client_assignments (Promt 18.1)
    await pool.query(
      `CREATE TABLE IF NOT EXISTS client_assignments (
         client_code text PRIMARY KEY,
         responsible_user_id uuid NOT NULL REFERENCES users(id),
         team_id uuid REFERENCES teams(id),
         since timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_assignments_user ON client_assignments(responsible_user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_assignments_team ON client_assignments(team_id)`);
    applied.push("client_assignments");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS client_assignment_history (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         client_code text NOT NULL,
         from_user_id uuid REFERENCES users(id),
         to_user_id uuid NOT NULL REFERENCES users(id),
         from_team_id uuid,
         to_team_id uuid,
         actor_user_id uuid REFERENCES users(id),
         reason text,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cah_client_code ON client_assignment_history(client_code)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cah_to_user ON client_assignment_history(to_user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cah_created_at ON client_assignment_history(created_at)`);
    applied.push("client_assignment_history");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS user_team_history (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id uuid NOT NULL REFERENCES users(id),
         from_team_id uuid,
         to_team_id uuid,
         role_in_team text,
         actor_user_id uuid REFERENCES users(id),
         reason text,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    await pool.query(`ALTER TABLE user_team_history ADD COLUMN IF NOT EXISTS role_in_team text`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_uth_user ON user_team_history(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_uth_created_at ON user_team_history(created_at)`);
    applied.push("user_team_history");

    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS teams_name_unique ON teams(name)`);
    applied.push("teams_name_unique index");

    // Промт 64: юрлица и платёжные реквизиты
    await pool.query(
      `CREATE TABLE IF NOT EXISTS legal_entities (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         client_id TEXT NOT NULL,
         name TEXT,
         inn TEXT,
         kpp TEXT,
         ogrn TEXT,
         legal_address TEXT,
         payment_form TEXT,
         payment_delay_days INTEGER,
         credit_limit_rub NUMERIC(14, 2),
         edo_enabled BOOLEAN,
         edo_operator TEXT,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_legal_entities_client_id ON legal_entities(client_id)`);
    await pool.query(
      `CREATE TABLE IF NOT EXISTS trade_point_legal_entity_links (
         trade_point_id TEXT NOT NULL,
         legal_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         PRIMARY KEY (trade_point_id, legal_entity_id)
       )`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_tp_le_links_legal_entity ON trade_point_legal_entity_links(legal_entity_id)`,
    );
    try {
      await pool.query(`ALTER TABLE trade_point_legal_entity_links DROP CONSTRAINT IF EXISTS trade_point_legal_entity_links_pkey`);
      await pool.query(
        `ALTER TABLE trade_point_legal_entity_links ADD PRIMARY KEY (trade_point_id, legal_entity_id)`,
      );
      applied.push("trade_point_legal_entity_links_composite_pk");
    } catch {
      /* уже composite PK */
    }
    applied.push("legal_entities_payment_terms");

    // Промт 66: контакты клиента (Postgres)
    await pool.query(
      `CREATE TABLE IF NOT EXISTS client_contacts (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         client_id TEXT NOT NULL,
         scope TEXT NOT NULL CHECK (scope IN ('dealer','legal_entity','trade_point')),
         scope_ref TEXT,
         full_name TEXT NOT NULL,
         role TEXT,
         phone TEXT,
         whatsapp TEXT,
         telegram TEXT,
         email TEXT,
         comment TEXT,
         is_primary BOOLEAN NOT NULL DEFAULT false,
         is_actual BOOLEAN NOT NULL DEFAULT true,
         source TEXT NOT NULL DEFAULT 'manual',
         delete_requested_at TIMESTAMPTZ,
         delete_request_reason TEXT,
         created_by_user_id UUID,
         created_by_name TEXT,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS ix_client_contacts_client ON client_contacts(client_id)`);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ix_client_contacts_scope ON client_contacts(client_id, scope, scope_ref)`,
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS client_contact_events (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         client_id TEXT NOT NULL,
         scope TEXT,
         scope_ref TEXT,
         body TEXT NOT NULL,
         actor_user_id UUID,
         actor_name TEXT,
         at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ix_client_contact_events_client_at ON client_contact_events(client_id, at DESC)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ix_client_contact_events_scope_at ON client_contact_events(client_id, scope, scope_ref, at DESC)`,
    );
    applied.push("client_contacts_v1");

    // Промт 66.1: одноразовая чистка тестовых контактов (верификация Промта 66)
    await pool.query(
      `DELETE FROM client_contacts
       WHERE client_id = 'client-ma-ma121186'
         AND delete_request_reason = 'ADMIN CLEANUP test data (Промт 66 verification)'`,
    );
    await pool.query(
      `DELETE FROM client_contact_events
       WHERE client_id = 'client-ma-ma121186'
         AND body LIKE 'Запрошено снятие контакта%ADMIN CLEANUP test data (Промт 66 verification)%'`,
    );
    applied.push("client_contacts_cleanup_admin_test_v1");

    // Промт 66.2: тестовое событие dealerTimeline из верификации Промта 66
    await pool.query(
      `DELETE FROM client_contact_events
       WHERE client_id = 'client-ma-ma121186'
         AND scope IS NULL
         AND body = 'Добавлен контакт'
         AND actor_name = 'admin'
         AND at::text LIKE '2026-05-20%'`,
    );
    applied.push("client_contacts_cleanup_admin_test_event_v1");

    // Промт 66.3: scope-таймлайны — тестовые события request-delete (верификация Промта 66)
    await pool.query(
      `DELETE FROM client_contact_events
       WHERE client_id = 'client-ma-ma121186'
         AND scope IS NOT NULL
         AND body IN (
           'Запрошено снятие контакта: Иванов Иван (главный)',
           'Запрошено снятие контакта: Петров Пётр',
           'Запрошено снятие контакта: Сидоров Семён',
           'Запрошено снятие контакта: Юр.контакт 1',
           'Запрошено снятие контакта: Кассир ТТ-1',
           'Запрошено снятие контакта: Зам.кассир ТТ-1',
           'Запрошено снятие контакта: Управ. ТТ-2'
         )`,
    );
    applied.push("client_contacts_cleanup_admin_test_scope_events_v1");

    // Промт 67: юрлица из актуализации (расширение legal_entities + таймлайн)
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS internal_code TEXT`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS entity_type TEXT`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS actual_address TEXT`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS primary_contact TEXT`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS phone TEXT`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS email TEXT`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'additional'`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS comment TEXT`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS updated_by_user_id UUID`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS updated_by_name TEXT`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`);
    await pool.query(`ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(
      `CREATE TABLE IF NOT EXISTS legal_entity_events (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         client_id TEXT NOT NULL,
         legal_entity_id UUID,
         at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         meta TEXT,
         body TEXT NOT NULL,
         actor_user_id UUID,
         actor_name TEXT
       )`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS ix_legal_entity_events_client ON legal_entity_events(client_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS ix_legal_entity_events_le ON legal_entity_events(legal_entity_id)`);
    applied.push("dealer_legal_entities_v1");

    // Промт 68: персональный рабочий план менеджера
    await pool.query(
      `CREATE TABLE IF NOT EXISTS dealer_work_plan (
         user_id UUID NOT NULL,
         dealer_id TEXT NOT NULL,
         is_hidden BOOLEAN NOT NULL DEFAULT false,
         scheduled_date DATE,
         scheduled_note TEXT,
         scheduled_updated_at TIMESTAMPTZ,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         PRIMARY KEY (user_id, dealer_id)
       )`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS ix_dwp_user ON dealer_work_plan(user_id)`);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ix_dwp_scheduled ON dealer_work_plan(user_id, scheduled_date) WHERE scheduled_date IS NOT NULL`,
    );
    applied.push("dealer_work_plan_v1");

    // Промт 69: комментарии клиента и торговых точек
    await pool.query(
      `CREATE TABLE IF NOT EXISTS client_comments (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         client_id TEXT NOT NULL,
         scope TEXT NOT NULL CHECK (scope IN ('dealer','trade_point')),
         scope_ref TEXT,
         type TEXT NOT NULL DEFAULT 'general',
         body TEXT NOT NULL,
         is_deleted BOOLEAN NOT NULL DEFAULT false,
         created_by_user_id UUID,
         created_by_name TEXT,
         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS ix_client_comments_client ON client_comments(client_id)`);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ix_client_comments_scope ON client_comments(client_id, scope, scope_ref)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS ix_client_comments_tp ON client_comments(scope_ref) WHERE scope = 'trade_point'`,
    );
    applied.push("client_comments_v1");

    // Промт 20: impersonation
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS impersonator_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_impersonator ON sessions(impersonator_user_id) WHERE impersonator_user_id IS NOT NULL`);
    applied.push("sessions.impersonator_user_id");

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

  if (textRaw.startsWith("/start")) {
    const parts = textRaw.split(/\s+/).filter((x) => x.length > 0);
    const payload = parts[1];
    if (payload && payload.startsWith("link_")) {
      const rawTok = payload.slice("link_".length);
      if (rawTok) {
        const tokenHash = sha256Hex(rawTok);
        const tokSel = await pool.query<{ user_id: string; expires_at: string; used_at: string | null }>(
          `SELECT user_id, expires_at, used_at FROM telegram_link_tokens WHERE token_hash = $1 LIMIT 1`,
          [tokenHash],
        );
        const tok = tokSel.rows[0];
        const nowMs = Date.now();
        if (!tok || tok.used_at != null) {
          if (chatId != null) await tgSendMessage(chatId, "Ссылка недействительна или срок её действия истёк.");
          sendJson(res, 200, { ok: true });
          return;
        }
        const expMs = Date.parse(tok.expires_at);
        if (!Number.isFinite(expMs) || expMs <= nowMs) {
          if (chatId != null) await tgSendMessage(chatId, "Ссылка недействительна или срок её действия истёк.");
          sendJson(res, 200, { ok: true });
          return;
        }

        const userRows = await pool.query<{ id: string; full_name: string; status: string; telegram_user_id: string | null }>(
          `SELECT id, full_name, status, telegram_user_id FROM users WHERE id = $1::uuid LIMIT 1`,
          [tok.user_id],
        );
        const targ = userRows.rows[0];
        if (!targ || targ.status !== "active") {
          if (chatId != null) await tgSendMessage(chatId, "Ссылка недействительна или срок её действия истёк.");
          sendJson(res, 200, { ok: true });
          return;
        }

        const fromStr = String(fromId);
        if (targ.telegram_user_id != null && String(targ.telegram_user_id) === fromStr) {
          await pool.query(`UPDATE telegram_link_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL`, [tokenHash]);
          if (chatId != null) {
            await tgSendMessage(
              chatId,
              `Привет, ${targ.full_name.trim() || "коллега"}. Telegram привязан. Будешь получать уведомления здесь.`,
            );
          }
          sendJson(res, 200, { ok: true });
          return;
        }

        const taken = await pool.query<{ id: string }>(
          `SELECT id FROM users WHERE telegram_user_id = $1::bigint AND id <> $2::uuid LIMIT 1`,
          [fromStr, targ.id],
        );
        if (taken.rows[0]) {
          if (chatId != null) {
            await tgSendMessage(chatId, "Этот Telegram уже привязан к другой учётной записи Tandoor.");
          }
          sendJson(res, 200, { ok: true });
          return;
        }

        const oldId = targ.telegram_user_id;
        await pool.query(`UPDATE users SET telegram_user_id = $1::bigint, updated_at = NOW() WHERE id = $2::uuid`, [fromStr, targ.id]);
        await pool.query(`UPDATE telegram_link_tokens SET used_at = NOW() WHERE token_hash = $1`, [tokenHash]);

        await tryAudit(pool, {
          actorUserId: targ.id,
          action: "user.telegram_link.changed",
          entityType: "user",
          entityId: targ.id,
          metadata: { oldId: oldId ?? null, newId: fromStr, source: "onboarding" },
        });

        if (chatId != null) {
          await tgSendMessage(
            chatId,
            `Привет, ${targ.full_name.trim() || "коллега"}. Telegram привязан. Будешь получать уведомления здесь.`,
          );
        }
        sendJson(res, 200, { ok: true });
        return;
      }
    }
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

function pickPathAction(req: VercelRequest): string {
  const url = typeof req.url === "string" ? req.url : "";
  try {
    const u = new URL(url, "http://localhost");
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last?.trim() ?? "";
  } catch {
    return "";
  }
}

function pickMigrationsRunAction(req: VercelRequest): string {
  const url = typeof req.url === "string" ? req.url : "";
  try {
    const u = new URL(url, "http://localhost");
    const fromUrl = u.searchParams.getAll("action").find((v) => v.trim() && v.trim() !== "migrations-run");
    if (fromUrl) return fromUrl.trim();
  } catch {
    // Fall through to req.query/body below.
  }

  const values = Array.isArray(req.query?.action) ? req.query.action : [req.query?.action];
  const fromQuery = values.find((v) => typeof v === "string" && v.trim() && v.trim() !== "migrations-run");
  if (typeof fromQuery === "string") return fromQuery.trim();

  const body = isPlainObject(req.body) ? req.body : {};
  const fromBody = body.action;
  return typeof fromBody === "string" && fromBody.trim() !== "migrations-run" ? fromBody.trim() : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = pickAction(req);
  const pathAction = pickPathAction(req);
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
    if (action === "reset-requests-list" && req.method === "GET") {
      await handleResetRequestsList(req, res, pool, headers);
      return;
    }
    if (action === "reset-request-approve" && req.method === "POST") {
      await handleResetRequestApprove(req, res, pool, headers);
      return;
    }
    if (action === "reset-request-decline" && req.method === "POST") {
      await handleResetRequestDecline(req, res, pool, headers);
      return;
    }
    if (action === "audit-list" && req.method === "GET") {
      await handleAuditList(req, res, pool, headers);
      return;
    }
    if (action === "actualization-debug-state" && req.method === "GET") {
      await handleActualizationDebugState(req, res, pool, headers);
      return;
    }
    if (action === "actualization-state-trace" && req.method === "GET") {
      await handleActualizationStateTrace(req, res, pool, headers);
      return;
    }
    if (action === "actualization-dedupe-dry-run" && req.method === "POST") {
      await handleActualizationDedupeDryRun(res, pool, headers);
      return;
    }
    if (action === "actualization-dedupe-apply" && req.method === "POST") {
      await handleActualizationDedupeApply(req, res, pool, headers);
      return;
    }
    if (action === "actualization-contacts-migration-dry-run" && req.method === "POST") {
      await handleActualizationContactsMigrationDryRun(res, pool, headers);
      return;
    }
    if (action === "actualization-contacts-migration-apply" && req.method === "POST") {
      await handleActualizationContactsMigrationApply(req, res, pool, headers);
      return;
    }
    if (action === "actualization-stats-overview" && req.method === "GET") {
      await handleActualizationStatsOverview(req, res, pool, headers);
      return;
    }
    if (action === "client-base-overview" && req.method === "GET") {
      await handleClientBaseOverview(req, res, pool, headers);
      return;
    }
    if (action === "client-base-manager-detail" && req.method === "GET") {
      await handleClientBaseManagerDetail(req, res, pool, headers);
      return;
    }
    if (action === "client-base-clients-list" && req.method === "GET") {
      await handleClientBaseClientsList(req, res, pool, headers);
      return;
    }
    if (action === "manager-activity-detail" && req.method === "GET") {
      await handleManagerActivityDetail(req, res, pool, headers);
      return;
    }
    if (action === "trade-points-overview" && req.method === "GET") {
      await handleTradePointsOverview(req, res, pool, headers);
      return;
    }
    if (action === "tp-count-diag" && req.method === "GET") {
      await handleTpCountDiag(req, res, pool, headers);
      return;
    }
    if (action === "purge-queue" && req.method === "GET") {
      const { handleAdminPurgeQueue } = await import("../../shared/admin-purge-queue-handlers.js");
      await handleAdminPurgeQueue(req, res, pool, headers);
      return;
    }
    if (action === "scope-debug" && req.method === "GET") {
      const { handleScopeDebugRequest } = await import("../../shared/scope-debug-handlers.js");
      await handleScopeDebugRequest(req, res, pool, headers);
      return;
    }
    if (action === "trade-points-manager-detail" && req.method === "GET") {
      await handleTradePointsManagerDetail(req, res, pool, headers);
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
    if (action === "onboarding-status" && req.method === "GET") {
      await handleOnboardingStatus(res, pool, headers);
      return;
    }
    if (action === "onboarding-complete" && req.method === "POST") {
      await handleOnboardingComplete(res, pool, headers);
      return;
    }
    if (action === "profile-telegram-link-token" && req.method === "POST") {
      await handleProfileTelegramLinkToken(res, pool, headers);
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
    if ((action === "migrations-run" || pathAction === "migrations-run") && req.method === "POST") {
      await handleMigrationsRun(req, res, pool, headers);
      return;
    }
    if (action === "users-bulk-create" && req.method === "POST") {
      const me = await resolveCurrentUser(pool, headers);
      if (!me || me.role !== "admin" || me.status !== "active") {
        sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
        return;
      }
      const body = (req.body ?? {}) as { users?: unknown };
      const arr = Array.isArray(body.users) ? (body.users as unknown[]) : null;
      if (!arr) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Требуется массив users." });
        return;
      }
      const ALLOWED_ROLES = new Set(["director", "rop", "regional_manager", "manager", "marketer", "analyst"]);
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const results: Array<{ email: string; status: "created" | "skipped" | "error"; id?: string; tempPassword?: string; reason?: string }> = [];
      for (const raw of arr) {
        const u = (raw ?? {}) as { email?: unknown; fullName?: unknown; role?: unknown; phone?: unknown };
        const email = typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
        const fullName = typeof u.fullName === "string" ? u.fullName.trim().slice(0, 120) : "";
        const role = typeof u.role === "string" ? u.role.trim() : "";
        const phone = typeof u.phone === "string" ? u.phone.trim().slice(0, 32) : null;
        if (!emailRe.test(email) || !fullName || !ALLOWED_ROLES.has(role)) {
          results.push({ email, status: "error", reason: "VALIDATION" });
          continue;
        }
        const existing = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
        if (existing.rowCount && existing.rowCount > 0) {
          results.push({ email, status: "skipped", reason: "EXISTS" });
          continue;
        }
        // 12-символьный временный пароль (без путающих символов)
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        let tempPassword = "";
        const buf = new Uint8Array(12);
        (globalThis.crypto ?? require("node:crypto").webcrypto).getRandomValues(buf);
        for (let i = 0; i < 12; i++) tempPassword += alphabet[buf[i] % alphabet.length];
        const hash = await bcrypt.hash(tempPassword, 10);
        try {
          const ins = await pool.query(
            `INSERT INTO users (email, full_name, role, status, password_hash, must_change_password, phone, created_by)
             VALUES ($1, $2, $3, 'active', $4, true, $5, $6)
             RETURNING id`,
            [email, fullName, role, hash, phone, me.id],
          );
          const id = String(ins.rows[0].id);
          await tryAudit(pool, {
            actorUserId: me.id,
            action: "user.bulk_created",
            entityType: "user",
            entityId: id,
            metadata: { email, role, fullName },
          });
          results.push({ email, status: "created", id, tempPassword });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push({ email, status: "error", reason: msg.slice(0, 120) });
        }
      }
      sendJson(res, 200, { success: true, results });
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
    if (action === "teams-list" && req.method === "GET") {
      const me = await resolveCurrentUser(pool, headers);
      if (!me) {
        sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
        return;
      }
      await handleTeamsList(req, res, pool, me);
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
