/**
 * /api/one-c/showcase-matrix/* — зеркало prod API, shadow-таблицы 1С.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { sendJson } from "./admin/admin-auth.js";
import {
  ONE_C_SHOWCASE_CATEGORIES,
  type OneCShowcaseCategoryId,
} from "./one-c-distribution-categories.js";
import { canEditDistributionForStore1c } from "./one-c-distribution-permissions.js";
import {
  MAX_SCOPE_TRADE_POINTS,
  parseShowcaseMatrixUpsertInput,
  ShowcaseMatrixValidationError,
  type ShowcaseMatrixEntryDto,
  type ShowcaseMatrixEventDto,
  type ShowcaseMatrixSessionUser,
  type ShowcaseMatrixStatus,
  type ShowcaseMatrixTargetKind,
  type ShowcaseMatrixUpsertInput,
  type ShowcaseMatrixUpsertResult,
  type ShowcasePlacementCompetitor,
  type ShowcasePlacementOurModel,
  type ShowcasePlacementSegment,
  type ShowcasePlacementType,
} from "./showcase-matrix-handlers.js";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MATRIX_TARGET_KINDS = new Set<ShowcaseMatrixTargetKind>(["model", "variant", "placement"]);
const STATUSES = new Set<ShowcaseMatrixStatus>([
  "need_install",
  "installed",
  "postponed",
  "not_relevant",
]);

const SEGMENT_TO_CATEGORY: Record<ShowcasePlacementSegment, OneCShowcaseCategoryId> = {
  vh: "entrance_doors",
  mk: "interior_doors",
  hardware: "hardware",
};

function assertUuid(id: string, field: string): void {
  if (!UUID_RX.test(id)) {
    throw new ShowcaseMatrixValidationError(`Некорректный ${field}.`);
  }
}

function parseJsonArray<T>(raw: unknown, fallback: T[]): T[] {
  if (Array.isArray(raw)) return raw as T[];
  return fallback;
}

function mapOverrideRow(row: Record<string, unknown>, dealerId: string): ShowcaseMatrixEntryDto {
  return {
    id: String(row.id),
    dealerId,
    tradePointId: String(row.store_id_1c),
    targetKind: String(row.target_kind) as ShowcaseMatrixTargetKind,
    targetId: String(row.target_id),
    status: String(row.status ?? "need_install") as ShowcaseMatrixStatus,
    comment: row.comment != null ? String(row.comment) : null,
    updatedAt: String(row.updated_at),
    updatedBy: row.updated_by != null ? String(row.updated_by) : null,
    updatedByName: row.updated_by_name != null ? String(row.updated_by_name) : null,
    placementType: row.placement_type != null ? (String(row.placement_type) as ShowcasePlacementType) : null,
    placementSegment:
      row.placement_segment != null ? (String(row.placement_segment) as ShowcasePlacementSegment) : null,
    placementCapacity: typeof row.placement_capacity === "number" ? row.placement_capacity : null,
    placementActual: typeof row.placement_actual === "number" ? row.placement_actual : null,
    placementRef: row.placement_ref != null ? String(row.placement_ref) : null,
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

function mapEventRow(row: Record<string, unknown>): ShowcaseMatrixEventDto {
  return {
    id: String(row.id),
    entryId: row.entry_id != null ? String(row.entry_id) : null,
    dealerId: String(row.dealer_id),
    tradePointId: String(row.store_id_1c),
    targetKind: String(row.target_kind) as ShowcaseMatrixTargetKind,
    targetId: String(row.target_id),
    oldStatus: row.old_status != null ? String(row.old_status) : null,
    newStatus: row.new_status != null ? String(row.new_status) : null,
    comment: row.comment != null ? String(row.comment) : null,
    changedBy: row.changed_by != null ? String(row.changed_by) : null,
    changedByName: row.changed_by_name != null ? String(row.changed_by_name) : null,
    changedAt: String(row.changed_at),
    placementType: row.placement_type != null ? (String(row.placement_type) as ShowcasePlacementType) : null,
    placementSegment:
      row.placement_segment != null ? (String(row.placement_segment) as ShowcasePlacementSegment) : null,
    placementCapacity: typeof row.placement_capacity === "number" ? row.placement_capacity : null,
    placementActual: typeof row.placement_actual === "number" ? row.placement_actual : null,
    placementRef: row.placement_ref != null ? String(row.placement_ref) : null,
    placementOurModels: parseJsonArray<ShowcasePlacementOurModel>(row.placement_our_models, []),
    placementCompetitors: parseJsonArray<ShowcasePlacementCompetitor>(row.placement_competitors, []),
    placementLegacyOurs:
      typeof row.placement_legacy_ours === "number" ? row.placement_legacy_ours : null,
  };
}

async function fetchByClientOpId(
  pool: PoolLike,
  clientOpId: string,
  dealerId: string,
): Promise<ShowcaseMatrixEntryDto | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_distribution_overrides_1c WHERE client_op_id = $1 LIMIT 1`,
    [clientOpId],
  );
  return r.rows[0] ? mapOverrideRow(r.rows[0], dealerId) : null;
}

async function fetchByTarget(
  pool: PoolLike,
  storeId1c: string,
  targetKind: ShowcaseMatrixTargetKind,
  targetId: string,
  dealerId: string,
): Promise<ShowcaseMatrixEntryDto | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_distribution_overrides_1c
     WHERE store_id_1c = $1::uuid AND target_kind = $2 AND target_id = $3
     LIMIT 1`,
    [storeId1c, targetKind, targetId],
  );
  return r.rows[0] ? mapOverrideRow(r.rows[0], dealerId) : null;
}

export async function syncOneCCategoryMatrixFromOverrides(
  pool: PoolLike,
  storeId1c: string,
  actor?: { id: string; full_name: string },
): Promise<void> {
  const counts: Record<OneCShowcaseCategoryId, number> = {
    entrance_doors: 0,
    interior_doors: 0,
    hardware: 0,
    molding: 0,
  };

  const res = await pool.query<{
    target_kind: string;
    status: string | null;
    placement_segment: string | null;
  }>(
    `SELECT target_kind, status, placement_segment
     FROM showcase_distribution_overrides_1c
     WHERE store_id_1c = $1::uuid
       AND target_kind IN ('model', 'variant')
       AND status = 'installed'`,
    [storeId1c],
  );

  for (const row of res.rows) {
    const seg = row.placement_segment as ShowcasePlacementSegment | null;
    if (seg && SEGMENT_TO_CATEGORY[seg]) {
      counts[SEGMENT_TO_CATEGORY[seg]] += 1;
    }
  }

  for (const categoryId of ONE_C_SHOWCASE_CATEGORIES) {
    await pool.query(
      `INSERT INTO showcase_matrix_1c
         (store_id_1c, category_id, actual_count, updated_at, updated_by, updated_by_name)
       VALUES ($1::uuid, $2, $3, NOW(), $4::uuid, $5)
       ON CONFLICT (store_id_1c, category_id) DO UPDATE SET
         actual_count = EXCLUDED.actual_count,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by,
         updated_by_name = EXCLUDED.updated_by_name`,
      [storeId1c, categoryId, counts[categoryId], actor?.id ?? null, actor?.full_name ?? null],
    );
  }
}

async function insertMatrixEvent1c(
  pool: PoolLike,
  params: {
    entryId: string;
    dealerId: string;
    storeId1c: string;
    targetKind: ShowcaseMatrixTargetKind;
    targetId: string;
    oldStatus: string | null;
    newStatus: string;
    comment: string | null;
    changedBy: string;
    changedByName: string;
    placementType: ShowcasePlacementType | null;
    placementSegment: ShowcasePlacementSegment | null;
    placementCapacity: number | null;
    placementActual: number | null;
    placementRef: string | null;
    placementOurModels: ShowcasePlacementOurModel[];
    placementCompetitors: ShowcasePlacementCompetitor[];
    placementLegacyOurs: number | null;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO showcase_matrix_events_1c (
       entry_id, dealer_id, store_id_1c, target_kind, target_id,
       old_status, new_status, comment, changed_by, changed_by_name,
       placement_type, placement_segment, placement_capacity, placement_actual, placement_ref,
       placement_our_models, placement_competitors, placement_legacy_ours
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9::uuid, $10,
               $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18)`,
    [
      params.entryId,
      params.dealerId,
      params.storeId1c,
      params.targetKind,
      params.targetId,
      params.oldStatus,
      params.newStatus,
      params.comment,
      params.changedBy,
      params.changedByName,
      params.placementType,
      params.placementSegment,
      params.placementCapacity,
      params.placementActual,
      params.placementRef,
      JSON.stringify(params.placementOurModels),
      JSON.stringify(params.placementCompetitors),
      params.placementLegacyOurs,
    ],
  );

  await pool.query(
    `INSERT INTO showcase_distribution_history_1c
       (store_id_1c, action, payload, actor_user_id, actor_full_name)
     VALUES ($1::uuid, 'update', $2::jsonb, $3::uuid, $4)`,
    [
      params.storeId1c,
      JSON.stringify({
        targetKind: params.targetKind,
        targetId: params.targetId,
        oldStatus: params.oldStatus,
        newStatus: params.newStatus,
      }),
      params.changedBy,
      params.changedByName,
    ],
  );
}

function entryChanged(prev: ShowcaseMatrixEntryDto | null, input: ShowcaseMatrixUpsertInput): boolean {
  if (!prev) return true;
  if (prev.status !== input.status) return true;
  if ((prev.comment ?? null) !== (input.comment ?? null)) return true;
  if (prev.placementType !== (input.placementType ?? null)) return true;
  if (prev.placementSegment !== (input.placementSegment ?? null)) return true;
  if (prev.placementCapacity !== (input.placementCapacity ?? null)) return true;
  if (prev.placementActual !== (input.placementActual ?? null)) return true;
  if (prev.placementRef !== (input.placementRef ?? null)) return true;
  if (JSON.stringify(prev.placementOurModels ?? []) !== JSON.stringify(input.placementOurModels ?? [])) {
    return true;
  }
  if (JSON.stringify(prev.placementCompetitors ?? []) !== JSON.stringify(input.placementCompetitors ?? [])) {
    return true;
  }
  if (prev.placementLegacyOurs !== (input.placementLegacyOurs ?? null)) return true;
  return false;
}

export async function upsertOneCShowcaseMatrixEntry(
  pool: PoolLike,
  sessionUser: ShowcaseMatrixSessionUser,
  input: ShowcaseMatrixUpsertInput,
): Promise<ShowcaseMatrixUpsertResult> {
  if (sessionUser.status !== "active") {
    throw new ShowcaseMatrixValidationError("Недостаточно прав.");
  }

  assertUuid(input.tradePointId, "tradePointId");
  assertUuid(input.dealerId, "dealerId");
  if (!MATRIX_TARGET_KINDS.has(input.targetKind)) {
    throw new ShowcaseMatrixValidationError("Некорректный targetKind для 1С.");
  }

  const allowed = await canEditDistributionForStore1c(pool, sessionUser.id, input.tradePointId);
  if (!allowed) {
    throw new ShowcaseMatrixValidationError("Недостаточно прав.", "FORBIDDEN");
  }

  const clientOpId = input.clientOpId ?? null;
  if (clientOpId) {
    const existingByOp = await fetchByClientOpId(pool, clientOpId, input.dealerId);
    if (existingByOp) {
      return { entry: existingByOp, idempotent: true };
    }
  }

  const prev = await fetchByTarget(
    pool,
    input.tradePointId,
    input.targetKind,
    input.targetId,
    input.dealerId,
  );
  const oldStatus = prev?.status ?? null;
  const shouldWriteEvent = entryChanged(prev, input);

  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO showcase_distribution_overrides_1c (
       store_id_1c, target_kind, target_id, status, comment, client_op_id,
       updated_at, updated_by, updated_by_name,
       placement_type, placement_segment, placement_capacity, placement_actual, placement_ref,
       placement_our_models, placement_competitors, placement_legacy_ours
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, NOW(), $7::uuid, $8,
               $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16)
     ON CONFLICT (store_id_1c, target_kind, target_id) WHERE target_id IS NOT NULL
     DO UPDATE SET
       status = EXCLUDED.status,
       comment = EXCLUDED.comment,
       client_op_id = COALESCE(EXCLUDED.client_op_id, showcase_distribution_overrides_1c.client_op_id),
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by,
       updated_by_name = EXCLUDED.updated_by_name,
       placement_type = EXCLUDED.placement_type,
       placement_segment = EXCLUDED.placement_segment,
       placement_capacity = EXCLUDED.placement_capacity,
       placement_actual = EXCLUDED.placement_actual,
       placement_ref = EXCLUDED.placement_ref,
       placement_our_models = EXCLUDED.placement_our_models,
       placement_competitors = EXCLUDED.placement_competitors,
       placement_legacy_ours = EXCLUDED.placement_legacy_ours
     RETURNING *`,
    [
      input.tradePointId,
      input.targetKind,
      input.targetId,
      input.status,
      input.comment ?? null,
      clientOpId,
      sessionUser.id,
      sessionUser.fullName,
      input.placementType,
      input.placementSegment,
      input.placementCapacity,
      input.placementActual,
      input.placementRef,
      JSON.stringify(input.placementOurModels ?? []),
      JSON.stringify(input.placementCompetitors ?? []),
      input.placementLegacyOurs ?? null,
    ],
  );

  const entry = mapOverrideRow(r.rows[0]!, input.dealerId);

  if (shouldWriteEvent) {
    await insertMatrixEvent1c(pool, {
      entryId: entry.id,
      dealerId: input.dealerId,
      storeId1c: input.tradePointId,
      targetKind: input.targetKind,
      targetId: input.targetId,
      oldStatus,
      newStatus: input.status,
      comment: input.comment ?? null,
      changedBy: sessionUser.id,
      changedByName: sessionUser.fullName,
      placementType: input.placementType ?? null,
      placementSegment: input.placementSegment ?? null,
      placementCapacity: input.placementCapacity ?? null,
      placementActual: input.placementActual ?? null,
      placementRef: input.placementRef ?? null,
      placementOurModels: input.placementOurModels ?? [],
      placementCompetitors: input.placementCompetitors ?? [],
      placementLegacyOurs: input.placementLegacyOurs ?? null,
    });
  }

  await syncOneCCategoryMatrixFromOverrides(pool, input.tradePointId, {
    id: sessionUser.id,
    full_name: sessionUser.fullName,
  });

  return { entry, idempotent: false };
}

export async function handleOneCShowcaseMatrixList(
  pool: PoolLike,
  params: { dealerId?: string; tradePointId?: string },
): Promise<{ success: true; entries: ShowcaseMatrixEntryDto[] }> {
  const tradePointId = typeof params.tradePointId === "string" ? params.tradePointId.trim() : "";
  const dealerId = typeof params.dealerId === "string" ? params.dealerId.trim() : "";
  if (!tradePointId) {
    throw new ShowcaseMatrixValidationError("Укажите tradePointId.");
  }
  assertUuid(tradePointId, "tradePointId");

  const queryParams: unknown[] = [tradePointId];
  let sql = `SELECT o.*, s.legal_entity_1c::text AS dealer_id_resolved
             FROM showcase_distribution_overrides_1c o
             INNER JOIN exchange_stores_raw s ON s.id_1c = o.store_id_1c
             WHERE o.store_id_1c = $1::uuid
               AND o.target_kind IN ('model','variant','placement')`;
  if (dealerId) {
    queryParams.push(dealerId);
    sql += ` AND s.legal_entity_1c = $${queryParams.length}::uuid`;
  }
  sql += ` ORDER BY o.updated_at DESC`;

  const r = await pool.query<Record<string, unknown>>(sql, queryParams);
  return {
    success: true,
    entries: r.rows.map((row) =>
      mapOverrideRow(row, String(row.dealer_id_resolved ?? dealerId ?? "")),
    ),
  };
}

function parseScopeTradePointIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new ShowcaseMatrixValidationError("Укажите tradePointIds.");
  }
  const ids = Array.from(
    new Set(
      raw
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  );
  if (ids.length === 0) {
    throw new ShowcaseMatrixValidationError("Укажите tradePointIds.");
  }
  return ids.slice(0, MAX_SCOPE_TRADE_POINTS);
}

function parseScopeStatuses(raw: unknown): ShowcaseMatrixStatus[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ShowcaseMatrixStatus[] = [];
  for (const s of raw) {
    if (typeof s === "string" && STATUSES.has(s as ShowcaseMatrixStatus)) {
      out.push(s as ShowcaseMatrixStatus);
    }
  }
  if (out.length === 0) return undefined;
  return Array.from(new Set(out));
}

export async function handleOneCShowcaseMatrixScope(
  pool: PoolLike,
  params: { tradePointIds?: unknown; statuses?: unknown },
): Promise<{ success: true; entries: ShowcaseMatrixEntryDto[] }> {
  const tradePointIds = parseScopeTradePointIds(params.tradePointIds);
  const statuses = parseScopeStatuses(params.statuses);

  const queryParams: unknown[] = [tradePointIds];
  let sql = `SELECT o.*, s.legal_entity_1c::text AS dealer_id
             FROM showcase_distribution_overrides_1c o
             INNER JOIN exchange_stores_raw s ON s.id_1c = o.store_id_1c
             WHERE o.store_id_1c = ANY($1::uuid[])
               AND o.target_kind IN ('model','variant','placement')`;
  if (statuses && statuses.length > 0) {
    queryParams.push(statuses);
    sql += ` AND o.status = ANY($${queryParams.length}::text[])`;
  }
  sql += ` ORDER BY o.updated_at DESC`;

  const r = await pool.query<Record<string, unknown>>(sql, queryParams);
  return {
    success: true,
    entries: r.rows.map((row) => mapOverrideRow(row, String(row.dealer_id ?? ""))),
  };
}

export async function handleOneCShowcaseMatrixScopeAll(
  pool: PoolLike,
  params: { statuses?: unknown },
): Promise<{ success: true; entries: ShowcaseMatrixEntryDto[]; tradePointIds: string[] }> {
  const statuses = parseScopeStatuses(params.statuses);
  const queryParams: unknown[] = [];
  let sql = `SELECT o.*, s.legal_entity_1c::text AS dealer_id
             FROM showcase_distribution_overrides_1c o
             INNER JOIN exchange_stores_raw s ON s.id_1c = o.store_id_1c
             WHERE o.target_kind IN ('model','variant','placement')`;
  if (statuses && statuses.length > 0) {
    queryParams.push(statuses);
    sql += ` AND o.status = ANY($${queryParams.length}::text[])`;
  }
  sql += ` ORDER BY o.updated_at DESC`;

  const r = await pool.query<Record<string, unknown>>(sql, queryParams);
  const entries = r.rows.map((row) => mapOverrideRow(row, String(row.dealer_id ?? "")));
  const tradePointIds = Array.from(new Set(entries.map((e) => e.tradePointId).filter(Boolean)));
  return { success: true, entries, tradePointIds };
}

export async function handleOneCShowcaseMatrixUpsert(
  pool: PoolLike,
  sessionUser: ShowcaseMatrixSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; entry: ShowcaseMatrixEntryDto; idempotent: boolean }> {
  const input = parseShowcaseMatrixUpsertInput(body);
  const result = await upsertOneCShowcaseMatrixEntry(pool, sessionUser, input);
  return { success: true, ...result };
}

export async function handleOneCShowcaseMatrixBatchSync(
  pool: PoolLike,
  sessionUser: ShowcaseMatrixSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; results: unknown[]; applied: number; skipped: number }> {
  const ops = body.operations;
  if (!Array.isArray(ops)) {
    throw new ShowcaseMatrixValidationError("Укажите operations.");
  }
  const results: unknown[] = [];
  let applied = 0;
  let skipped = 0;
  for (const op of ops) {
    if (!op || typeof op !== "object") continue;
    const clientOpId =
      typeof (op as { clientOpId?: unknown }).clientOpId === "string"
        ? (op as { clientOpId: string }).clientOpId
        : undefined;
    try {
      const input = parseShowcaseMatrixUpsertInput(op as Record<string, unknown>);
      const result = await upsertOneCShowcaseMatrixEntry(pool, sessionUser, input);
      applied += 1;
      results.push({ clientOpId, entry: result.entry });
    } catch (e) {
      skipped += 1;
      const message = e instanceof Error ? e.message : String(e);
      results.push({ clientOpId, error: message });
    }
  }
  return { success: true, results, applied, skipped };
}

export async function handleOneCShowcaseMatrixHistory(
  pool: PoolLike,
  params: { tradePointId?: string; dealerId?: string; limit?: number },
): Promise<{ success: true; events: ShowcaseMatrixEventDto[] }> {
  const tradePointId = typeof params.tradePointId === "string" ? params.tradePointId.trim() : "";
  const dealerId = typeof params.dealerId === "string" ? params.dealerId.trim() : "";
  if (!tradePointId && !dealerId) {
    throw new ShowcaseMatrixValidationError("Укажите tradePointId или dealerId.");
  }

  const limitRaw = params.limit;
  const maxLimit = tradePointId ? 500 : 2000;
  const defaultLimit = tradePointId ? 200 : 2000;
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), maxLimit)
      : defaultLimit;

  const queryParams: unknown[] = [];
  const conditions: string[] = [];
  if (tradePointId) {
    queryParams.push(tradePointId);
    conditions.push(`store_id_1c = $${queryParams.length}::uuid`);
  }
  if (dealerId) {
    queryParams.push(dealerId);
    conditions.push(`dealer_id = $${queryParams.length}::uuid`);
  }
  queryParams.push(limit);
  const sql =
    `SELECT * FROM showcase_matrix_events_1c WHERE ${conditions.join(" AND ")}` +
    ` ORDER BY changed_at DESC LIMIT $${queryParams.length}`;

  const r = await pool.query<Record<string, unknown>>(sql, queryParams);
  return { success: true, events: r.rows.map(mapEventRow) };
}

export async function handleOneCShowcaseMatrixSnapshotUpsert(
  _pool: PoolLike,
  _body: Record<string, unknown>,
): Promise<{ success: true; noop: true }> {
  return { success: true, noop: true };
}

export async function handleOneCShowcaseMatrixSnapshotRange(
  _pool: PoolLike,
  _body: Record<string, unknown>,
): Promise<{
  success: true;
  baselineByTradePointId: Record<string, never>;
  currentByTradePointId: Record<string, never>;
}> {
  return { success: true, baselineByTradePointId: {}, currentByTradePointId: {} };
}

export function sendOneCShowcaseMatrixError(res: VercelResponse, e: unknown): void {
  if (e instanceof ShowcaseMatrixValidationError) {
    const status = e.code === "FORBIDDEN" ? 403 : 400;
    sendJson(res, status, { success: false, code: e.code, message: e.message });
    return;
  }
  const m = e instanceof Error ? e.message : String(e);
  sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
}
