/**
 * API маркетинговых брифов (Postgres) — Промт 102.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { canManageMarketingBriefsServer } from "./marketing-briefs-access.js";
import {
  DEFAULT_ACCENT_COLOR,
  defaultBlockPayload,
  isMarketingBriefBlockType,
  isValidPeriodLabel,
  mapMarketingBriefBlockRow,
  mapMarketingBriefRevisionRow,
  mapMarketingBriefRow,
  parseMarketingBriefVisibility,
  type MarketingBriefBlockRow,
  type MarketingBriefRow,
  type MarketingBriefStatus,
} from "./marketing-briefs-types.js";

type SessionUser = { id: string; role: string; status: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function parseUuid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

function parseStatusFilter(raw: unknown): MarketingBriefStatus | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim() as MarketingBriefStatus;
  if (s === "draft" || s === "published" || s === "archived") return s;
  return null;
}

async function fetchBriefById(pool: PoolLike, id: string): Promise<MarketingBriefRow | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT b.*, u.full_name AS author_name
     FROM marketing_briefs b
     LEFT JOIN users u ON u.id = b.created_by
     WHERE b.id = $1::uuid
     LIMIT 1`,
    [id],
  );
  return r.rows[0] ? mapMarketingBriefRow(r.rows[0]) : null;
}

async function insertRevision(
  pool: PoolLike,
  briefId: string,
  action: string,
  actorUserId: string | null,
  payload?: Record<string, unknown> | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO marketing_brief_revisions (brief_id, action, actor_user_id, payload)
     VALUES ($1::uuid, $2, $3, $4::jsonb)`,
    [briefId, action, actorUserId, payload ? JSON.stringify(payload) : null],
  );
}

function assertCanManage(me: SessionUser, res: VercelResponse): boolean {
  if (!canManageMarketingBriefsServer(me.role)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return false;
  }
  return true;
}

function canReadBrief(me: SessionUser, brief: MarketingBriefRow): boolean {
  if (brief.status === "published") return true;
  return canManageMarketingBriefsServer(me.role);
}

export async function handleMarketingBriefsList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const canManage = canManageMarketingBriefsServer(me.role);
  const statusFilter = parseStatusFilter(req.query.status);
  const period =
    typeof req.query.period === "string" && req.query.period.trim() && req.query.period.trim() !== "all"
      ? req.query.period.trim()
      : null;

  if (period && !isValidPeriodLabel(period)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный period (YYYY-MM)." });
    return;
  }

  const params: unknown[] = [];
  const clauses: string[] = [];

  if (!canManage) {
    clauses.push(`b.status = 'published'`);
  } else if (statusFilter) {
    params.push(statusFilter);
    clauses.push(`b.status = $${params.length}`);
  }

  if (period) {
    params.push(period);
    clauses.push(`b.period_label = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const r = await pool.query<Record<string, unknown>>(
    `SELECT b.*, u.full_name AS author_name
     FROM marketing_briefs b
     LEFT JOIN users u ON u.id = b.created_by
     ${where}
     ORDER BY b.updated_at DESC`,
    params,
  );

  sendJson(res, 200, { success: true, data: r.rows.map(mapMarketingBriefRow) });
}

export async function handleMarketingBriefsGet(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const id = parseUuid(typeof req.query.id === "string" ? req.query.id : "");
  if (!id) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }

  const brief = await fetchBriefById(pool, id);
  if (!brief || !canReadBrief(me, brief)) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }

  const rev = await pool.query<Record<string, unknown>>(
    `SELECT r.id, r.action, r.actor_user_id, r.created_at, u.full_name AS actor_name
     FROM marketing_brief_revisions r
     LEFT JOIN users u ON u.id = r.actor_user_id
     WHERE r.brief_id = $1::uuid
     ORDER BY r.created_at DESC
     LIMIT 30`,
    [id],
  );

  sendJson(res, 200, {
    success: true,
    data: {
      brief,
      revisions: rev.rows.map(mapMarketingBriefRevisionRow),
    },
  });
}

export async function handleMarketingBriefsCreate(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const periodLabel = typeof body.period_label === "string" ? body.period_label.trim() : "";
  if (!isValidPeriodLabel(periodLabel)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите period_label (YYYY-MM)." });
    return;
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : `Маркетинговый бриф ${periodLabel}`;
  const accentColor =
    typeof body.accent_color === "string" && body.accent_color.trim() ? body.accent_color.trim() : DEFAULT_ACCENT_COLOR;
  const coverText = typeof body.cover_text === "string" ? body.cover_text : "";
  const visibility = parseMarketingBriefVisibility(body.visibility);

  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO marketing_briefs (period_label, title, status, visibility, accent_color, cover_text, created_by)
     VALUES ($1, $2, 'draft', $3, $4, $5, $6::uuid)
     RETURNING *`,
    [periodLabel, title, visibility, accentColor, coverText, me.id],
  );
  const row = r.rows[0];
  if (!row) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Не удалось создать бриф." });
    return;
  }

  const briefId = String(row.id);
  await insertRevision(pool, briefId, "create", me.id, { period_label: periodLabel, title });

  const brief = await fetchBriefById(pool, briefId);
  sendJson(res, 200, { success: true, data: brief });
}

export async function handleMarketingBriefsUpdate(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const id = parseUuid(body.id);
  const patch = (body.patch ?? {}) as Record<string, unknown>;
  if (!id) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }

  const existing = await fetchBriefById(pool, id);
  if (!existing) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }
  if (existing.status === "archived") {
    sendJson(res, 409, { success: false, code: "ARCHIVED", message: "Архивный бриф нельзя редактировать." });
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [id];
  const patchOut: Record<string, unknown> = {};

  if (patch.period_label !== undefined) {
    const pl = String(patch.period_label).trim();
    if (!isValidPeriodLabel(pl)) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный period_label." });
      return;
    }
    params.push(pl);
    updates.push(`period_label = $${params.length}`);
    patchOut.period_label = pl;
  }
  if (patch.title !== undefined) {
    const t = String(patch.title).trim();
    if (!t) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Заголовок не может быть пустым." });
      return;
    }
    params.push(t);
    updates.push(`title = $${params.length}`);
    patchOut.title = t;
  }
  if (patch.accent_color !== undefined) {
    const c = String(patch.accent_color).trim() || DEFAULT_ACCENT_COLOR;
    params.push(c);
    updates.push(`accent_color = $${params.length}`);
    patchOut.accent_color = c;
  }
  if (patch.cover_text !== undefined) {
    params.push(String(patch.cover_text));
    updates.push(`cover_text = $${params.length}`);
    patchOut.cover_text = patch.cover_text;
  }
  if (patch.visibility !== undefined) {
    const vis = parseMarketingBriefVisibility(patch.visibility);
    params.push(vis);
    updates.push(`visibility = $${params.length}`);
    patchOut.visibility = vis;
  }

  if (updates.length === 0) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Нет полей для обновления." });
    return;
  }

  updates.push("updated_at = NOW()");

  await pool.query(`UPDATE marketing_briefs SET ${updates.join(", ")} WHERE id = $1::uuid`, params);
  await insertRevision(pool, id, "update", me.id, patchOut);

  const brief = await fetchBriefById(pool, id);
  sendJson(res, 200, { success: true, data: brief });
}

export async function handleMarketingBriefsPublish(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;
  const id = parseUuid((req.body as Record<string, unknown>)?.id);
  if (!id) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }

  const existing = await fetchBriefById(pool, id);
  if (!existing) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }
  if (existing.status === "published") {
    sendJson(res, 200, { success: true, data: existing });
    return;
  }

  await pool.query(
    `UPDATE marketing_briefs SET status = 'published', published_at = NOW(), updated_at = NOW(), archived_at = NULL
     WHERE id = $1::uuid`,
    [id],
  );
  await insertRevision(pool, id, "publish", me.id, null);

  const brief = await fetchBriefById(pool, id);
  sendJson(res, 200, { success: true, data: brief });
}

export async function handleMarketingBriefsUnpublish(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;
  const id = parseUuid((req.body as Record<string, unknown>)?.id);
  if (!id) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }

  const existing = await fetchBriefById(pool, id);
  if (!existing) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }

  await pool.query(
    `UPDATE marketing_briefs SET status = 'draft', published_at = NULL, updated_at = NOW() WHERE id = $1::uuid`,
    [id],
  );
  await insertRevision(pool, id, "unpublish", me.id, null);

  const brief = await fetchBriefById(pool, id);
  sendJson(res, 200, { success: true, data: brief });
}

export async function handleMarketingBriefsArchive(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;
  const id = parseUuid((req.body as Record<string, unknown>)?.id);
  if (!id) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }

  const existing = await fetchBriefById(pool, id);
  if (!existing) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }

  await pool.query(
    `UPDATE marketing_briefs SET status = 'archived', archived_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`,
    [id],
  );
  await insertRevision(pool, id, "archive", me.id, null);

  const brief = await fetchBriefById(pool, id);
  sendJson(res, 200, { success: true, data: brief });
}

export async function handleMarketingBriefsRestore(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;
  const id = parseUuid((req.body as Record<string, unknown>)?.id);
  if (!id) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }

  const existing = await fetchBriefById(pool, id);
  if (!existing) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }

  await pool.query(
    `UPDATE marketing_briefs SET status = 'draft', archived_at = NULL, updated_at = NOW() WHERE id = $1::uuid`,
    [id],
  );
  await insertRevision(pool, id, "restore", me.id, null);

  const brief = await fetchBriefById(pool, id);
  sendJson(res, 200, { success: true, data: brief });
}

export async function handleMarketingBriefsDelete(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;
  const id = parseUuid((req.body as Record<string, unknown>)?.id);
  if (!id) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }

  const existing = await fetchBriefById(pool, id);
  if (!existing) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }

  await pool.query(`DELETE FROM marketing_briefs WHERE id = $1::uuid`, [id]);
  sendJson(res, 200, { success: true, data: { ok: true } });
}

export async function handleMarketingBriefsPublicGet(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<void> {
  const id = parseUuid(typeof req.query.id === "string" ? req.query.id : "");
  if (!id) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }

  const brief = await fetchBriefById(pool, id);
  if (!brief || brief.status !== "published" || brief.visibility !== "public") {
    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Бриф не найден, не опубликован или приватный.",
    });
    return;
  }

  const blocks = await fetchBlocksForBrief(pool, id);
  sendJson(res, 200, { success: true, data: { brief, blocks } });
}

async function touchBriefUpdatedAt(pool: PoolLike, briefId: string): Promise<void> {
  await pool.query(`UPDATE marketing_briefs SET updated_at = NOW() WHERE id = $1::uuid`, [briefId]);
}

async function fetchBlockById(pool: PoolLike, id: string): Promise<MarketingBriefBlockRow | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM marketing_brief_blocks WHERE id = $1::uuid LIMIT 1`,
    [id],
  );
  return r.rows[0] ? mapMarketingBriefBlockRow(r.rows[0]) : null;
}

async function fetchBlocksForBrief(pool: PoolLike, briefId: string): Promise<MarketingBriefBlockRow[]> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM marketing_brief_blocks WHERE brief_id = $1::uuid ORDER BY order_index ASC`,
    [briefId],
  );
  return r.rows.map(mapMarketingBriefBlockRow);
}

function canReadBlocks(me: SessionUser, brief: MarketingBriefRow): boolean {
  if (brief.status === "published") return true;
  return canManageMarketingBriefsServer(me.role);
}

function assertBriefNotArchived(brief: MarketingBriefRow, res: VercelResponse): boolean {
  if (brief.status === "archived") {
    sendJson(res, 409, { success: false, code: "ARCHIVED", message: "Архивный бриф нельзя редактировать." });
    return false;
  }
  return true;
}

async function reindexBriefBlocks(pool: PoolLike, briefId: string): Promise<void> {
  await pool.query(
    `UPDATE marketing_brief_blocks b
     SET order_index = sub.rn, updated_at = NOW()
     FROM (
       SELECT id, (ROW_NUMBER() OVER (ORDER BY order_index ASC, created_at ASC) - 1)::int AS rn
       FROM marketing_brief_blocks
       WHERE brief_id = $1::uuid
     ) sub
     WHERE b.id = sub.id`,
    [briefId],
  );
}

export async function handleBlocksList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const briefId = parseUuid(typeof req.query.brief_id === "string" ? req.query.brief_id : "");
  if (!briefId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите brief_id." });
    return;
  }

  const brief = await fetchBriefById(pool, briefId);
  if (!brief || !canReadBlocks(me, brief)) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }

  const blocks = await fetchBlocksForBrief(pool, briefId);
  sendJson(res, 200, { success: true, data: blocks });
}

export async function handleBlocksCreate(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const briefId = parseUuid(body.brief_id);
  const blockType = body.type;
  const insertAfterId = body.insert_after_id != null ? parseUuid(body.insert_after_id) : null;

  if (!briefId || !isMarketingBriefBlockType(blockType)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите brief_id и type." });
    return;
  }

  const brief = await fetchBriefById(pool, briefId);
  if (!brief) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }
  if (!assertBriefNotArchived(brief, res)) return;

  const payloadRaw = body.payload;
  const payload =
    payloadRaw && typeof payloadRaw === "object" && !Array.isArray(payloadRaw)
      ? { ...defaultBlockPayload(blockType), ...(payloadRaw as Record<string, unknown>) }
      : defaultBlockPayload(blockType);

  let orderIndex = 0;
  if (insertAfterId) {
    const after = await fetchBlockById(pool, insertAfterId);
    if (!after || after.brief_id !== briefId) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "insert_after_id не найден." });
      return;
    }
    orderIndex = after.order_index + 1;
    await pool.query(
      `UPDATE marketing_brief_blocks SET order_index = order_index + 1, updated_at = NOW()
       WHERE brief_id = $1::uuid AND order_index >= $2`,
      [briefId, orderIndex],
    );
  } else {
    const maxR = await pool.query<{ max: number | null }>(
      `SELECT MAX(order_index)::int AS max FROM marketing_brief_blocks WHERE brief_id = $1::uuid`,
      [briefId],
    );
    const maxVal = maxR.rows[0]?.max;
    orderIndex = maxVal != null && Number.isFinite(maxVal) ? maxVal + 1 : 0;
  }

  const ins = await pool.query<Record<string, unknown>>(
    `INSERT INTO marketing_brief_blocks (brief_id, order_index, type, payload)
     VALUES ($1::uuid, $2, $3, $4::jsonb)
     RETURNING *`,
    [briefId, orderIndex, blockType, JSON.stringify(payload)],
  );
  const row = ins.rows[0];
  if (!row) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Не удалось создать блок." });
    return;
  }

  await touchBriefUpdatedAt(pool, briefId);
  await insertRevision(pool, briefId, "block_create", me.id, { block_id: String(row.id), type: blockType });

  sendJson(res, 200, { success: true, data: mapMarketingBriefBlockRow(row) });
}

export async function handleBlocksUpdate(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const id = parseUuid(body.id);
  const patch = body.payload;
  if (!id || !patch || typeof patch !== "object" || Array.isArray(patch)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id и payload." });
    return;
  }

  const existing = await fetchBlockById(pool, id);
  if (!existing) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Блок не найден." });
    return;
  }

  const brief = await fetchBriefById(pool, existing.brief_id);
  if (!brief) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }
  if (!assertBriefNotArchived(brief, res)) return;

  const merged = { ...existing.payload, ...(patch as Record<string, unknown>) };
  const payloadKeys = Object.keys(patch as Record<string, unknown>);

  await pool.query(
    `UPDATE marketing_brief_blocks SET payload = $2::jsonb, updated_at = NOW() WHERE id = $1::uuid`,
    [id, JSON.stringify(merged)],
  );
  await touchBriefUpdatedAt(pool, existing.brief_id);
  await insertRevision(pool, existing.brief_id, "block_update", me.id, { block_id: id, payload_keys: payloadKeys });

  const updated = await fetchBlockById(pool, id);
  sendJson(res, 200, { success: true, data: updated });
}

export async function handleBlocksReorder(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const briefId = parseUuid(body.brief_id);
  const orderRaw = body.order;
  if (!briefId || !Array.isArray(orderRaw)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите brief_id и order." });
    return;
  }

  const order: string[] = [];
  for (const x of orderRaw) {
    const parsed = parseUuid(typeof x === "string" ? x : "");
    if (!parsed) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный order." });
      return;
    }
    order.push(parsed);
  }

  const brief = await fetchBriefById(pool, briefId);
  if (!brief) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }
  if (!assertBriefNotArchived(brief, res)) return;

  const existing = await fetchBlocksForBrief(pool, briefId);
  if (existing.length !== order.length) {
    sendJson(res, 400, {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Порядок должен содержать все блоки брифа.",
    });
    return;
  }

  const existingIds = new Set(existing.map((b) => b.id));
  for (const blockId of order) {
    if (!existingIds.has(blockId)) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Неизвестный id в order." });
      return;
    }
  }

  for (let i = 0; i < order.length; i++) {
    const blockId = order[i]!;
    await pool.query(
      `UPDATE marketing_brief_blocks SET order_index = $2, updated_at = NOW() WHERE id = $1::uuid AND brief_id = $3::uuid`,
      [blockId, i, briefId],
    );
  }

  await touchBriefUpdatedAt(pool, briefId);
  await insertRevision(pool, briefId, "block_reorder", me.id, { order });

  const blocks = await fetchBlocksForBrief(pool, briefId);
  sendJson(res, 200, { success: true, data: blocks });
}

export async function handleBlocksDelete(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanManage(me, res)) return;

  const id = parseUuid((req.body as Record<string, unknown>)?.id);
  if (!id) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }

  const existing = await fetchBlockById(pool, id);
  if (!existing) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Блок не найден." });
    return;
  }

  const brief = await fetchBriefById(pool, existing.brief_id);
  if (!brief) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }
  if (!assertBriefNotArchived(brief, res)) return;

  await pool.query(`DELETE FROM marketing_brief_blocks WHERE id = $1::uuid`, [id]);
  await reindexBriefBlocks(pool, existing.brief_id);
  await touchBriefUpdatedAt(pool, existing.brief_id);
  await insertRevision(pool, existing.brief_id, "block_delete", me.id, { block_id: id });

  sendJson(res, 200, { success: true, data: { ok: true } });
}
