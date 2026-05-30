/**
 * API оверрайдов торговых точек (Postgres, prompt 113).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import {
  mapTradePointOverrideRow,
  mapTradePointTrainingRow,
  serializeTpOverrideValue,
  TRADE_POINT_OVERRIDE_FIELDS,
  type TradePointOverrideField,
  type TradePointOverrideRow,
} from "./trade-point-overrides-types.js";

type SessionUser = { id: string; role: string; status: string };

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function parseIdList(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickFields(body: Record<string, unknown>): Partial<Record<TradePointOverrideField, unknown>> {
  const fields = (body.fields ?? {}) as Record<string, unknown>;
  const out: Partial<Record<TradePointOverrideField, unknown>> = {};
  for (const key of TRADE_POINT_OVERRIDE_FIELDS) {
    if (key in fields) out[key] = fields[key];
  }
  return out;
}

async function fetchOverride(pool: PoolLike, tpId: string): Promise<TradePointOverrideRow | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM trade_point_overrides WHERE tp_id = $1 LIMIT 1`,
    [tpId],
  );
  return r.rows[0] ? mapTradePointOverrideRow(r.rows[0]) : null;
}

async function logEvents(
  pool: PoolLike,
  tpId: string,
  prev: TradePointOverrideRow | null,
  patch: Partial<Record<TradePointOverrideField, unknown>>,
  userId: string,
): Promise<void> {
  for (const field of Object.keys(patch) as TradePointOverrideField[]) {
    const oldVal = prev ? (prev[field] as unknown) : null;
    const newVal = patch[field];
    const oldS = serializeTpOverrideValue(oldVal);
    const newS = serializeTpOverrideValue(newVal);
    if (oldS === newS) continue;
    await pool.query(
      `INSERT INTO trade_point_override_events (tp_id, field, old_value, new_value, changed_by)
       VALUES ($1, $2, $3, $4, $5::uuid)`,
      [tpId, field, oldS, newS, userId],
    );
  }
}

function assertCanWrite(me: SessionUser, res: VercelResponse): boolean {
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return false;
  }
  return true;
}

export async function handleTradePointOverridesList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  _me: SessionUser,
): Promise<void> {
  const tpIds = parseIdList(req.query.tp_ids);
  const dealerId = typeof req.query.dealer_id === "string" ? req.query.dealer_id.trim() : "";

  let where = "";
  const params: unknown[] = [];
  if (tpIds.length > 0) {
    params.push(tpIds);
    where = `WHERE tp_id = ANY($${params.length}::text[])`;
  } else if (dealerId) {
    params.push(dealerId);
    where = `WHERE dealer_id = $${params.length}`;
  }

  const overrides = await pool.query<Record<string, unknown>>(
    `SELECT * FROM trade_point_overrides ${where}`,
    params,
  );
  const tpIdList = overrides.rows.map((r) => String(r.tp_id));
  const training =
    tpIdList.length > 0
      ? await pool.query<Record<string, unknown>>(
          `SELECT * FROM trade_point_training_state WHERE tp_id = ANY($1::text[])`,
          [tpIdList],
        )
      : await pool.query<Record<string, unknown>>(`SELECT * FROM trade_point_training_state`);

  sendJson(res, 200, {
    success: true,
    data: {
      overrides: overrides.rows.map(mapTradePointOverrideRow),
      training: training.rows.map(mapTradePointTrainingRow),
    },
  });
}

export async function handleTradePointOverridesGet(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  _me: SessionUser,
): Promise<void> {
  const tpId = typeof req.query.tp_id === "string" ? req.query.tp_id.trim() : "";
  if (!tpId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите tp_id." });
    return;
  }
  const override = await fetchOverride(pool, tpId);
  const tr = await pool.query<Record<string, unknown>>(
    `SELECT * FROM trade_point_training_state WHERE tp_id = $1 LIMIT 1`,
    [tpId],
  );
  sendJson(res, 200, {
    success: true,
    data: {
      override,
      training: tr.rows[0] ? mapTradePointTrainingRow(tr.rows[0]) : null,
    },
  });
}

export async function handleTradePointOverridesUpsert(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanWrite(me, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const tpId = typeof body.tp_id === "string" ? body.tp_id.trim() : "";
  if (!tpId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите tp_id." });
    return;
  }
  const patch = pickFields(body);
  if (typeof body.dealer_id === "string" && body.dealer_id.trim()) {
    patch.dealer_id = body.dealer_id.trim();
  }
  if (Object.keys(patch).length === 0) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Нет полей для обновления." });
    return;
  }

  const prev = await fetchOverride(pool, tpId);
  await logEvents(pool, tpId, prev, patch, me.id);

  if (prev) {
    const sets: string[] = [];
    const params: unknown[] = [tpId];
    for (const [key, val] of Object.entries(patch) as [TradePointOverrideField, unknown][]) {
      params.push(val === undefined ? null : val);
      sets.push(`${key} = $${params.length}`);
    }
    params.push(me.id);
    sets.push(`updated_at = NOW()`, `updated_by = $${params.length}`);
    await pool.query(`UPDATE trade_point_overrides SET ${sets.join(", ")} WHERE tp_id = $1`, params);
  } else {
    const cols: string[] = ["tp_id", "updated_by"];
    const vals: unknown[] = [tpId, me.id];
    for (const [key, val] of Object.entries(patch) as [TradePointOverrideField, unknown][]) {
      cols.push(key);
      vals.push(val === undefined ? null : val);
    }
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
    await pool.query(
      `INSERT INTO trade_point_overrides (${cols.join(", ")}) VALUES (${placeholders})`,
      vals,
    );
  }

  const override = await fetchOverride(pool, tpId);
  sendJson(res, 200, { success: true, data: { override } });
}

export async function handleTradePointOverridesSetTraining(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanWrite(me, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const tpId = typeof body.tp_id === "string" ? body.tp_id.trim() : "";
  if (!tpId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите tp_id." });
    return;
  }
  await pool.query(
    `INSERT INTO trade_point_training_state (tp_id, product_training_done, updated_by)
     VALUES ($1, COALESCE($2::boolean, FALSE), $3::uuid)
     ON CONFLICT (tp_id) DO UPDATE SET
       product_training_done = COALESCE($2::boolean, trade_point_training_state.product_training_done),
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [tpId, body.product_training_done === undefined ? null : Boolean(body.product_training_done), me.id],
  );
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM trade_point_training_state WHERE tp_id = $1`,
    [tpId],
  );
  sendJson(res, 200, {
    success: true,
    data: { training: r.rows[0] ? mapTradePointTrainingRow(r.rows[0]) : null },
  });
}

async function setTrash(
  pool: PoolLike,
  me: SessionUser,
  tpId: string,
  trash: boolean,
  res: VercelResponse,
): Promise<void> {
  const patch: Partial<Record<TradePointOverrideField, unknown>> = trash
    ? { trashed_at: new Date().toISOString(), trashed_by: me.id }
    : { trashed_at: null, trashed_by: null };
  const prev = await fetchOverride(pool, tpId);
  await logEvents(pool, tpId, prev, patch, me.id);
  await pool.query(
    `INSERT INTO trade_point_overrides (tp_id, trashed_at, trashed_by, updated_by)
     VALUES ($1, $2, $3::uuid, $4::uuid)
     ON CONFLICT (tp_id) DO UPDATE SET
       trashed_at = EXCLUDED.trashed_at,
       trashed_by = EXCLUDED.trashed_by,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [tpId, trash ? new Date().toISOString() : null, trash ? me.id : null, me.id],
  );
  const override = await fetchOverride(pool, tpId);
  sendJson(res, 200, { success: true, data: { override } });
}

export async function handleTradePointOverridesTrash(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanWrite(me, res)) return;
  const tpId = typeof (req.body as Record<string, unknown>)?.tp_id === "string"
    ? String((req.body as Record<string, unknown>).tp_id).trim()
    : "";
  if (!tpId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите tp_id." });
    return;
  }
  await setTrash(pool, me, tpId, true, res);
}

export async function handleTradePointOverridesUntrash(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertCanWrite(me, res)) return;
  const tpId = typeof (req.body as Record<string, unknown>)?.tp_id === "string"
    ? String((req.body as Record<string, unknown>).tp_id).trim()
    : "";
  if (!tpId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите tp_id." });
    return;
  }
  await setTrash(pool, me, tpId, false, res);
}
