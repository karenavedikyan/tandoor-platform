/**
 * Рабочий план клиентов (Postgres) — Промт 68.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { parseAuthRefreshToken, sha256Hex, timingSafeEqualHex } from "./admin/admin-auth.js";

type SessionUser = { id: string; role: string; status: string };
type SessionContext = { me: SessionUser; impersonatorUserId: string | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEALER_ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function sanitizeUserId(raw: string): string | null {
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

function sanitizeDealerIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x && DEALER_ID_RE.test(x));
}

function sanitizeIsoDay(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

async function resolveRopTeamId(pool: PoolLike, ropUserId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(`SELECT id FROM teams WHERE rop_user_id = $1::uuid LIMIT 1`, [ropUserId]);
  return r.rows[0]?.id ?? null;
}

export async function resolveSessionContext(
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<SessionContext | null> {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) return null;
  const hashHex = sha256Hex(token);
  const res = await pool.query<{
    id: string;
    role: string;
    status: string;
    refresh_token_hash: string;
    impersonator_user_id: string | null;
  }>(
    `SELECT u.id, u.role, u.status, s.refresh_token_hash, s.impersonator_user_id
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [hashHex],
  );
  const row = res.rows[0];
  if (!row || !timingSafeEqualHex(row.refresh_token_hash, token)) return null;
  return {
    me: { id: row.id, role: row.role, status: row.status },
    impersonatorUserId: row.impersonator_user_id,
  };
}

export async function assertWorkPlanReadAccess(
  pool: PoolLike,
  me: SessionUser,
  targetUserId: string,
): Promise<boolean> {
  if (me.status !== "active") return false;
  if (targetUserId === me.id) return true;
  if (me.role === "admin" || me.role === "director") return true;
  if (me.role === "rop") {
    const teamId = await resolveRopTeamId(pool, me.id);
    if (!teamId) return false;
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM user_team_memberships WHERE user_id = $1::uuid AND team_id = $2::uuid`,
      [targetUserId, teamId],
    );
    return Number(r.rows[0]?.n ?? 0) > 0;
  }
  return false;
}

function assertWorkPlanWriteAccess(ctx: SessionContext): boolean {
  const { me, impersonatorUserId } = ctx;
  if (me.status !== "active") return false;
  if (impersonatorUserId) {
    return me.role !== "marketer" && me.role !== "analyst" && me.role !== "category_manager";
  }
  return true;
}

async function countWorkPlanRows(pool: PoolLike, userId: string): Promise<number> {
  const r = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM dealer_work_plan WHERE user_id = $1::uuid`, [
    userId,
  ]);
  return Number(r.rows[0]?.n ?? 0);
}

async function maybeDeleteRow(pool: PoolLike, userId: string, dealerId: string): Promise<void> {
  const r = await pool.query<{ is_hidden: boolean; scheduled_date: string | null }>(
    `SELECT is_hidden, scheduled_date FROM dealer_work_plan WHERE user_id = $1::uuid AND dealer_id = $2`,
    [userId, dealerId],
  );
  const row = r.rows[0];
  if (!row) return;
  if (!row.is_hidden && row.scheduled_date == null) {
    await pool.query(`DELETE FROM dealer_work_plan WHERE user_id = $1::uuid AND dealer_id = $2`, [userId, dealerId]);
  }
}

type WorkPlanItem = {
  dealerId: string;
  isHidden: boolean;
  scheduledDate: string | null;
  scheduledNote: string | null;
  scheduledUpdatedAt: string | null;
};

function mapRow(r: Record<string, unknown>): WorkPlanItem {
  return {
    dealerId: String(r.dealer_id),
    isHidden: Boolean(r.is_hidden),
    scheduledDate: r.scheduled_date != null ? String(r.scheduled_date).slice(0, 10) : null,
    scheduledNote: r.scheduled_note != null ? String(r.scheduled_note) : null,
    scheduledUpdatedAt: r.scheduled_updated_at != null ? String(r.scheduled_updated_at) : null,
  };
}

export async function handleDealerWorkPlanList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  ctx: SessionContext,
): Promise<void> {
  const rawUserId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
  const targetUserId = rawUserId ? sanitizeUserId(rawUserId) : ctx.me.id;
  if (!targetUserId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный userId." });
    return;
  }
  if (!(await assertWorkPlanReadAccess(pool, ctx.me, targetUserId))) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dealer_work_plan WHERE user_id = $1::uuid ORDER BY updated_at DESC`,
    [targetUserId],
  );
  sendJson(res, 200, { success: true, userId: targetUserId, items: r.rows.map(mapRow) });
}

async function upsertHidden(pool: PoolLike, userId: string, dealerIds: string[], hidden: boolean): Promise<void> {
  for (const dealerId of dealerIds) {
    await pool.query(
      `INSERT INTO dealer_work_plan (user_id, dealer_id, is_hidden, updated_at)
       VALUES ($1::uuid, $2, $3, NOW())
       ON CONFLICT (user_id, dealer_id) DO UPDATE SET is_hidden = $3, updated_at = NOW()`,
      [userId, dealerId, hidden],
    );
    if (!hidden) await maybeDeleteRow(pool, userId, dealerId);
  }
}

export async function handleDealerWorkPlanHide(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  ctx: SessionContext,
): Promise<void> {
  if (!assertWorkPlanWriteAccess(ctx)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const dealerIds = sanitizeDealerIds((req.body as { dealerIds?: unknown })?.dealerIds);
  if (!dealerIds.length) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealerIds." });
    return;
  }
  await upsertHidden(pool, ctx.me.id, dealerIds, true);
  sendJson(res, 200, { success: true });
}

export async function handleDealerWorkPlanRestore(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  ctx: SessionContext,
): Promise<void> {
  if (!assertWorkPlanWriteAccess(ctx)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const dealerIds = sanitizeDealerIds((req.body as { dealerIds?: unknown })?.dealerIds);
  if (!dealerIds.length) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealerIds." });
    return;
  }
  await upsertHidden(pool, ctx.me.id, dealerIds, false);
  sendJson(res, 200, { success: true });
}

export async function handleDealerWorkPlanSchedule(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  ctx: SessionContext,
): Promise<void> {
  if (!assertWorkPlanWriteAccess(ctx)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = (req.body ?? {}) as { dealerIds?: unknown; date?: unknown; note?: unknown };
  const dealerIds = sanitizeDealerIds(body.dealerIds);
  const date = sanitizeIsoDay(body.date);
  if (!dealerIds.length || !date) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealerIds и date." });
    return;
  }
  const note = typeof body.note === "string" ? body.note.trim() || null : null;
  for (const dealerId of dealerIds) {
    await pool.query(
      `INSERT INTO dealer_work_plan (user_id, dealer_id, scheduled_date, scheduled_note, scheduled_updated_at, updated_at)
       VALUES ($1::uuid, $2, $3::date, $4, NOW(), NOW())
       ON CONFLICT (user_id, dealer_id) DO UPDATE SET
         scheduled_date = $3::date,
         scheduled_note = $4,
         scheduled_updated_at = NOW(),
         updated_at = NOW()`,
      [ctx.me.id, dealerId, date, note],
    );
  }
  sendJson(res, 200, { success: true });
}

export async function handleDealerWorkPlanClearSchedule(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  ctx: SessionContext,
): Promise<void> {
  if (!assertWorkPlanWriteAccess(ctx)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const dealerIds = sanitizeDealerIds((req.body as { dealerIds?: unknown })?.dealerIds);
  if (!dealerIds.length) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealerIds." });
    return;
  }
  for (const dealerId of dealerIds) {
    await pool.query(
      `INSERT INTO dealer_work_plan (user_id, dealer_id, scheduled_date, scheduled_note, scheduled_updated_at, updated_at)
       VALUES ($1::uuid, $2, NULL, NULL, NULL, NOW())
       ON CONFLICT (user_id, dealer_id) DO UPDATE SET
         scheduled_date = NULL,
         scheduled_note = NULL,
         scheduled_updated_at = NULL,
         updated_at = NOW()`,
      [ctx.me.id, dealerId],
    );
    await maybeDeleteRow(pool, ctx.me.id, dealerId);
  }
  sendJson(res, 200, { success: true });
}

type LsSchedule = { date: string; note?: string; updatedAt?: string };

export async function handleDealerWorkPlanBulkImport(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  ctx: SessionContext,
): Promise<void> {
  if (!assertWorkPlanWriteAccess(ctx)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  const body = (req.body ?? {}) as {
    userId?: unknown;
    hiddenByUser?: Record<string, Record<string, true>>;
    scheduledByUser?: Record<string, Record<string, LsSchedule>>;
  };

  let targetUserId = ctx.me.id;
  if (typeof body.userId === "string" && body.userId.trim()) {
    const parsed = sanitizeUserId(body.userId);
    if (!parsed) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный userId." });
      return;
    }
    if (parsed !== ctx.me.id && ctx.me.role !== "admin") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }
    targetUserId = parsed;
  }

  const existing = await countWorkPlanRows(pool, targetUserId);
  if (existing > 0) {
    sendJson(res, 409, { success: false, code: "ALREADY_EXISTS", message: "План уже есть в БД." });
    return;
  }

  const hiddenMap: Record<string, true> = {};
  const schedMap: Record<string, LsSchedule> = {};
  if (body.hiddenByUser && typeof body.hiddenByUser === "object") {
    for (const m of Object.values(body.hiddenByUser)) {
      if (m && typeof m === "object") Object.assign(hiddenMap, m);
    }
  }
  if (body.scheduledByUser && typeof body.scheduledByUser === "object") {
    for (const m of Object.values(body.scheduledByUser)) {
      if (m && typeof m === "object") Object.assign(schedMap, m);
    }
  }

  const dealerIds = Array.from(
    new Set<string>([...Object.keys(hiddenMap), ...Object.keys(schedMap)]),
  );

  for (const dealerId of dealerIds) {
    if (!DEALER_ID_RE.test(dealerId)) continue;
    const isHidden = Boolean(hiddenMap[dealerId]);
    const sched = schedMap[dealerId];
    const date = sched?.date ? sanitizeIsoDay(sched.date) : null;
    if (!isHidden && !date) continue;
    const note = sched?.note?.trim() || null;
    const schedAt = sched?.updatedAt ?? null;
    await pool.query(
      `INSERT INTO dealer_work_plan (
         user_id, dealer_id, is_hidden, scheduled_date, scheduled_note, scheduled_updated_at, updated_at
       ) VALUES ($1::uuid, $2, $3, $4::date, $5, COALESCE($6::timestamptz, NOW()), NOW())`,
      [targetUserId, dealerId, isHidden, date, note, schedAt],
    );
  }

  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dealer_work_plan WHERE user_id = $1::uuid`,
    [targetUserId],
  );
  sendJson(res, 201, { success: true, userId: targetUserId, items: r.rows.map(mapRow) });
}
