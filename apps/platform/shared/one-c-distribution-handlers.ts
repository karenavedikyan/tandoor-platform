/**
 * CRUD дистрибуции 1С (shadow-таблицы showcase_*_1c).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { sendJson } from "./admin/admin-auth.js";
import {
  countFilledCategories,
  isOneCShowcaseCategoryId,
  ONE_C_SHOWCASE_CATEGORIES,
  type OneCShowcaseCategoryId,
} from "./one-c-distribution-categories.js";
import {
  canEditDistributionForStore1c,
  type OneCDistributionUser,
} from "./one-c-distribution-permissions.js";
import {
  PLACEMENT_SEGMENTS,
  PLACEMENT_TYPES,
  type ShowcasePlacementCompetitor,
  type ShowcasePlacementOurModel,
  type ShowcasePlacementSegment,
  type ShowcasePlacementType,
} from "./showcase-matrix-handlers.js";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OneCMatrixRowDto = {
  categoryId: OneCShowcaseCategoryId;
  actualCount: number;
  status: string | null;
  comment: string | null;
  updatedAt: string;
  updatedBy: string | null;
  updatedByName: string | null;
};

export type OneCOverrideDto = {
  id: string;
  storeId1c: string;
  targetKind: string;
  targetId: string | null;
  status: string | null;
  comment: string | null;
  clientOpId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  updatedByName: string | null;
  placementType: ShowcasePlacementType | null;
  placementSegment: ShowcasePlacementSegment | null;
  placementCapacity: number | null;
  placementActual: number | null;
  placementRef: string | null;
  placementOurModels: ShowcasePlacementOurModel[];
  placementCompetitors: ShowcasePlacementCompetitor[];
  placementLegacyOurs: number | null;
};

export type OneCHistoryRowDto = {
  id: string;
  storeId1c: string;
  action: string;
  payload: unknown;
  actorUserId: string | null;
  actorFullName: string | null;
  createdAt: string;
};

export type OneCStoreDistributionState = {
  matrix: OneCMatrixRowDto[];
  overrides: OneCOverrideDto[];
  distributionFill: { filled: number; total: number };
};

export class OneCDistributionValidationError extends Error {
  readonly code: string;
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message);
    this.code = code;
  }
}

export class OneCDistributionForbiddenError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

function parseJsonArray<T>(raw: unknown, fallback: T[]): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? (p as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function mapMatrixRow(row: {
  category_id: string;
  actual_count: number;
  status: string | null;
  comment: string | null;
  updated_at: string | Date;
  updated_by: string | null;
  updated_by_name: string | null;
}): OneCMatrixRowDto {
  return {
    categoryId: row.category_id as OneCShowcaseCategoryId,
    actualCount: row.actual_count,
    status: row.status,
    comment: row.comment,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
  };
}

function mapOverrideRow(row: {
  id: string;
  store_id_1c: string;
  target_kind: string;
  target_id: string | null;
  status: string | null;
  comment: string | null;
  client_op_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  updated_by: string | null;
  updated_by_name: string | null;
  placement_type: string | null;
  placement_segment: string | null;
  placement_capacity: number | null;
  placement_actual: number | null;
  placement_ref: string | null;
  placement_our_models: unknown;
  placement_competitors: unknown;
  placement_legacy_ours: unknown;
}): OneCOverrideDto {
  return {
    id: row.id,
    storeId1c: row.store_id_1c,
    targetKind: row.target_kind,
    targetId: row.target_id,
    status: row.status,
    comment: row.comment,
    clientOpId: row.client_op_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    placementType: row.placement_type as ShowcasePlacementType | null,
    placementSegment: row.placement_segment as ShowcasePlacementSegment | null,
    placementCapacity: row.placement_capacity,
    placementActual: row.placement_actual,
    placementRef: row.placement_ref,
    placementOurModels: parseJsonArray<ShowcasePlacementOurModel>(row.placement_our_models, []),
    placementCompetitors: parseJsonArray<ShowcasePlacementCompetitor>(row.placement_competitors, []),
    placementLegacyOurs:
      typeof row.placement_legacy_ours === "number"
        ? row.placement_legacy_ours
        : row.placement_legacy_ours != null
          ? Number(row.placement_legacy_ours)
          : null,
  };
}

export async function fetchMatrix1cForStore(pool: PoolLike, storeId1c: string): Promise<OneCMatrixRowDto[]> {
  const res = await pool.query<{
    category_id: string;
    actual_count: number;
    status: string | null;
    comment: string | null;
    updated_at: string;
    updated_by: string | null;
    updated_by_name: string | null;
  }>(
    `SELECT category_id, actual_count, status, comment, updated_at,
            updated_by::text, updated_by_name
     FROM showcase_matrix_1c
     WHERE store_id_1c = $1::uuid
     ORDER BY category_id ASC`,
    [storeId1c],
  );
  const byCat = new Map(res.rows.map((r) => [r.category_id, mapMatrixRow(r)]));
  return ONE_C_SHOWCASE_CATEGORIES.map(
    (cat) =>
      byCat.get(cat) ?? {
        categoryId: cat,
        actualCount: 0,
        status: null,
        comment: null,
        updatedAt: new Date(0).toISOString(),
        updatedBy: null,
        updatedByName: null,
      },
  );
}

export async function fetchOverrides1cForStore(pool: PoolLike, storeId1c: string): Promise<OneCOverrideDto[]> {
  const res = await pool.query(
    `SELECT id::text, store_id_1c::text, target_kind, target_id::text, status, comment, client_op_id,
            created_at, updated_at, updated_by::text, updated_by_name,
            placement_type, placement_segment, placement_capacity, placement_actual, placement_ref,
            placement_our_models, placement_competitors, placement_legacy_ours
     FROM showcase_distribution_overrides_1c
     WHERE store_id_1c = $1::uuid
     ORDER BY updated_at DESC`,
    [storeId1c],
  );
  return res.rows.map((r) => mapOverrideRow(r as Parameters<typeof mapOverrideRow>[0]));
}

export async function fetchHistory1cForStore(
  pool: PoolLike,
  storeId1c: string,
  limit: number,
  offset: number,
): Promise<{ items: OneCHistoryRowDto[]; total: number }> {
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM showcase_distribution_history_1c WHERE store_id_1c = $1::uuid`,
    [storeId1c],
  );
  const res = await pool.query<{
    id: string;
    store_id_1c: string;
    action: string;
    payload: unknown;
    actor_user_id: string | null;
    actor_full_name: string | null;
    created_at: string;
  }>(
    `SELECT id::text, store_id_1c::text, action, payload, actor_user_id::text, actor_full_name, created_at
     FROM showcase_distribution_history_1c
     WHERE store_id_1c = $1::uuid
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [storeId1c, limit, offset],
  );
  return {
    total: countRes.rows[0]?.n ?? 0,
    items: res.rows.map((r) => ({
      id: r.id,
      storeId1c: r.store_id_1c,
      action: r.action,
      payload: r.payload,
      actorUserId: r.actor_user_id,
      actorFullName: r.actor_full_name,
      createdAt: r.created_at,
    })),
  };
}

export async function fetchStoreDistributionState(
  pool: PoolLike,
  storeId1c: string,
): Promise<OneCStoreDistributionState> {
  const matrix = await fetchMatrix1cForStore(pool, storeId1c);
  const overrides = await fetchOverrides1cForStore(pool, storeId1c);
  const distributionFill = countFilledCategories(
    matrix.map((m) => ({ category_id: m.categoryId, actual_count: m.actualCount })),
  );
  return { matrix, overrides, distributionFill };
}

export async function fetchDistributionFillForStores(
  pool: PoolLike,
  storeIds: string[],
): Promise<Map<string, { filled: number; total: number }>> {
  const result = new Map<string, { filled: number; total: number }>();
  if (storeIds.length === 0) return result;
  const res = await pool.query<{ store_id_1c: string; category_id: string; actual_count: number }>(
    `SELECT store_id_1c::text, category_id, actual_count
     FROM showcase_matrix_1c
     WHERE store_id_1c = ANY($1::uuid[])`,
    [storeIds],
  );
  const byStore = new Map<string, { category_id: string; actual_count: number }[]>();
  for (const row of res.rows) {
    const list = byStore.get(row.store_id_1c) ?? [];
    list.push(row);
    byStore.set(row.store_id_1c, list);
  }
  for (const id of storeIds) {
    result.set(id, countFilledCategories(byStore.get(id) ?? []));
  }
  return result;
}

async function appendHistory(
  pool: PoolLike,
  storeId1c: string,
  action: string,
  payload: unknown,
  actor: OneCDistributionUser,
): Promise<void> {
  await pool.query(
    `INSERT INTO showcase_distribution_history_1c
       (store_id_1c, action, payload, actor_user_id, actor_full_name)
     VALUES ($1::uuid, $2, $3::jsonb, $4::uuid, $5)`,
    [storeId1c, action, JSON.stringify(payload), actor.id, actor.full_name],
  );
}

function assertStoreExists(pool: PoolLike, storeId1c: string): Promise<boolean> {
  return pool
    .query<{ n: number }>(`SELECT 1::int AS n FROM exchange_stores_raw WHERE id_1c = $1::uuid LIMIT 1`, [
      storeId1c,
    ])
    .then((r) => (r.rows[0]?.n ?? 0) > 0);
}

export async function upsertMatrix1c(
  pool: PoolLike,
  storeId1c: string,
  body: {
    category_id: string;
    actual_count: number;
    status?: string | null;
    comment?: string | null;
  },
  actor: OneCDistributionUser,
): Promise<OneCStoreDistributionState> {
  if (!UUID_RX.test(storeId1c)) {
    throw new OneCDistributionValidationError("Некорректный store_id_1c.");
  }
  if (!isOneCShowcaseCategoryId(body.category_id)) {
    throw new OneCDistributionValidationError("Некорректная category_id.");
  }
  if (!Number.isFinite(body.actual_count) || body.actual_count < 0) {
    throw new OneCDistributionValidationError("actual_count должен быть >= 0.");
  }
  const exists = await assertStoreExists(pool, storeId1c);
  if (!exists) throw new OneCDistributionValidationError("Торговая точка не найдена.", "NOT_FOUND");

  await pool.query(
    `INSERT INTO showcase_matrix_1c
       (store_id_1c, category_id, actual_count, status, comment, updated_at, updated_by, updated_by_name)
     VALUES ($1::uuid, $2, $3, $4, $5, NOW(), $6::uuid, $7)
     ON CONFLICT (store_id_1c, category_id) DO UPDATE SET
       actual_count = EXCLUDED.actual_count,
       status = EXCLUDED.status,
       comment = EXCLUDED.comment,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by,
       updated_by_name = EXCLUDED.updated_by_name`,
    [
      storeId1c,
      body.category_id,
      Math.floor(body.actual_count),
      body.status ?? null,
      body.comment ?? null,
      actor.id,
      actor.full_name,
    ],
  );

  await appendHistory(pool, storeId1c, "matrix_upsert", body, actor);
  return fetchStoreDistributionState(pool, storeId1c);
}

export type OneCOverrideUpsertBody = {
  id?: string | null;
  target_kind: string;
  target_id?: string | null;
  status?: string | null;
  comment?: string | null;
  client_op_id?: string | null;
  placement_type?: string | null;
  placement_segment?: string | null;
  placement_capacity?: number | null;
  placement_actual?: number | null;
  placement_ref?: string | null;
  placement_our_models?: ShowcasePlacementOurModel[] | null;
  placement_competitors?: ShowcasePlacementCompetitor[] | null;
  placement_legacy_ours?: number | null;
};

export async function upsertOverride1c(
  pool: PoolLike,
  storeId1c: string,
  body: OneCOverrideUpsertBody,
  actor: OneCDistributionUser,
): Promise<{ state: OneCStoreDistributionState; idempotent: boolean }> {
  if (!UUID_RX.test(storeId1c)) {
    throw new OneCDistributionValidationError("Некорректный store_id_1c.");
  }
  const exists = await assertStoreExists(pool, storeId1c);
  if (!exists) throw new OneCDistributionValidationError("Торговая точка не найдена.", "NOT_FOUND");

  if (body.client_op_id?.trim()) {
    const dup = await pool.query<{ id: string }>(
      `SELECT id::text FROM showcase_distribution_overrides_1c WHERE client_op_id = $1 LIMIT 1`,
      [body.client_op_id.trim()],
    );
    if (dup.rows[0]) {
      return { state: await fetchStoreDistributionState(pool, storeId1c), idempotent: true };
    }
  }

  const targetKind = body.target_kind?.trim();
  if (!targetKind || !["category", "model", "competitor", "placement"].includes(targetKind)) {
    throw new OneCDistributionValidationError("Некорректный target_kind.");
  }
  if (body.placement_type && !PLACEMENT_TYPES.has(body.placement_type as ShowcasePlacementType)) {
    throw new OneCDistributionValidationError("Некорректный placement_type.");
  }
  if (body.placement_segment && !PLACEMENT_SEGMENTS.has(body.placement_segment as ShowcasePlacementSegment)) {
    throw new OneCDistributionValidationError("Некорректный placement_segment.");
  }

  const overrideId = body.id?.trim() && UUID_RX.test(body.id) ? body.id : null;

  let rowId: string;
  if (overrideId) {
    const upd = await pool.query<{ id: string }>(
      `UPDATE showcase_distribution_overrides_1c SET
         target_kind = $3, target_id = $4::uuid, status = $5, comment = $6, client_op_id = $7,
         updated_at = NOW(), updated_by = $8::uuid, updated_by_name = $9,
         placement_type = $10, placement_segment = $11, placement_capacity = $12, placement_actual = $13,
         placement_ref = $14, placement_our_models = $15::jsonb, placement_competitors = $16::jsonb,
         placement_legacy_ours = $17::jsonb
       WHERE id = $1::uuid AND store_id_1c = $2::uuid
       RETURNING id::text`,
      [
        overrideId,
        storeId1c,
        targetKind,
        body.target_id ?? null,
        body.status ?? null,
        body.comment ?? null,
        body.client_op_id ?? null,
        actor.id,
        actor.full_name,
        body.placement_type ?? null,
        body.placement_segment ?? null,
        body.placement_capacity ?? null,
        body.placement_actual ?? null,
        body.placement_ref ?? null,
        JSON.stringify(body.placement_our_models ?? []),
        JSON.stringify(body.placement_competitors ?? []),
        body.placement_legacy_ours != null ? JSON.stringify(body.placement_legacy_ours) : null,
      ],
    );
    if (!upd.rows[0]) throw new OneCDistributionValidationError("Override не найден.", "NOT_FOUND");
    rowId = upd.rows[0].id;
    await appendHistory(pool, storeId1c, "update", { id: rowId, ...body }, actor);
  } else {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO showcase_distribution_overrides_1c (
         store_id_1c, target_kind, target_id, status, comment, client_op_id,
         updated_by, updated_by_name,
         placement_type, placement_segment, placement_capacity, placement_actual, placement_ref,
         placement_our_models, placement_competitors, placement_legacy_ours
       ) VALUES (
         $1::uuid, $2, $3::uuid, $4, $5, $6,
         $7::uuid, $8,
         $9, $10, $11, $12, $13,
         $14::jsonb, $15::jsonb, $16::jsonb
       ) RETURNING id::text`,
      [
        storeId1c,
        targetKind,
        body.target_id ?? null,
        body.status ?? null,
        body.comment ?? null,
        body.client_op_id ?? null,
        actor.id,
        actor.full_name,
        body.placement_type ?? null,
        body.placement_segment ?? null,
        body.placement_capacity ?? null,
        body.placement_actual ?? null,
        body.placement_ref ?? null,
        JSON.stringify(body.placement_our_models ?? []),
        JSON.stringify(body.placement_competitors ?? []),
        body.placement_legacy_ours != null ? JSON.stringify(body.placement_legacy_ours) : null,
      ],
    );
    rowId = ins.rows[0]!.id;
    await appendHistory(pool, storeId1c, "create", { id: rowId, ...body }, actor);
  }

  return { state: await fetchStoreDistributionState(pool, storeId1c), idempotent: false };
}

export async function deleteOverride1c(
  pool: PoolLike,
  storeId1c: string,
  overrideId: string,
  actor: OneCDistributionUser,
): Promise<OneCStoreDistributionState> {
  if (!UUID_RX.test(storeId1c) || !UUID_RX.test(overrideId)) {
    throw new OneCDistributionValidationError("Некорректный идентификатор.");
  }
  const del = await pool.query(
    `DELETE FROM showcase_distribution_overrides_1c WHERE id = $1::uuid AND store_id_1c = $2::uuid`,
    [overrideId, storeId1c],
  );
  if ((del.rowCount ?? 0) === 0) {
    throw new OneCDistributionValidationError("Override не найден.", "NOT_FOUND");
  }
  await appendHistory(pool, storeId1c, "delete", { id: overrideId }, actor);
  return fetchStoreDistributionState(pool, storeId1c);
}

function toActor(me: { id: string; full_name: string; role: string; status: string }): OneCDistributionUser {
  return { id: me.id, full_name: me.full_name, role: me.role, status: me.status };
}

export async function handleOneCStoreHistory(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const storeId1c = String(req.query.id_1c ?? "").trim();
  if (!storeId1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "id_1c обязателен." });
    return;
  }
  const limitParam = Number(req.query.limit ?? 50);
  const offsetParam = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 200) : 50;
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
  const data = await fetchHistory1cForStore(pool, storeId1c, limit, offset);
  sendJson(res, 200, { success: true, limit, offset, ...data });
}

export async function handleOneCStoreMatrixPost(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: { id: string; full_name: string; role: string; status: string },
) {
  const storeId1c = String(req.query.id_1c ?? "").trim();
  if (!storeId1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "id_1c обязателен." });
    return;
  }
  const allowed = await canEditDistributionForStore1c(pool, me.id, storeId1c);
  if (!allowed) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Нет прав на редактирование." });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  try {
    const state = await upsertMatrix1c(
      pool,
      storeId1c,
      {
        category_id: String(body.category_id ?? ""),
        actual_count: Number(body.actual_count ?? 0),
        status: body.status != null ? String(body.status) : null,
        comment: body.comment != null ? String(body.comment) : null,
      },
      toActor(me),
    );
    sendJson(res, 200, { success: true, ...state });
  } catch (e) {
    if (e instanceof OneCDistributionValidationError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      sendJson(res, status, { success: false, code: e.code, message: e.message });
      return;
    }
    throw e;
  }
}

export async function handleOneCStoreOverridePost(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: { id: string; full_name: string; role: string; status: string },
) {
  const storeId1c = String(req.query.id_1c ?? "").trim();
  if (!storeId1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "id_1c обязателен." });
    return;
  }
  const allowed = await canEditDistributionForStore1c(pool, me.id, storeId1c);
  if (!allowed) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Нет прав на редактирование." });
    return;
  }
  const body = (req.body ?? {}) as OneCOverrideUpsertBody;
  try {
    const result = await upsertOverride1c(pool, storeId1c, body, toActor(me));
    sendJson(res, 200, { success: true, idempotent: result.idempotent, ...result.state });
  } catch (e) {
    if (e instanceof OneCDistributionValidationError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      sendJson(res, status, { success: false, code: e.code, message: e.message });
      return;
    }
    throw e;
  }
}

export async function handleOneCStoreOverrideDelete(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: { id: string; full_name: string; role: string; status: string },
) {
  const storeId1c = String(req.query.id_1c ?? "").trim();
  const overrideId = String(req.query.override_id ?? "").trim();
  if (!storeId1c || !overrideId) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "id_1c и override_id обязательны." });
    return;
  }
  const allowed = await canEditDistributionForStore1c(pool, me.id, storeId1c);
  if (!allowed) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Нет прав на редактирование." });
    return;
  }
  try {
    const state = await deleteOverride1c(pool, storeId1c, overrideId, toActor(me));
    sendJson(res, 200, { success: true, ...state });
  } catch (e) {
    if (e instanceof OneCDistributionValidationError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      sendJson(res, status, { success: false, code: e.code, message: e.message });
      return;
    }
    throw e;
  }
}
