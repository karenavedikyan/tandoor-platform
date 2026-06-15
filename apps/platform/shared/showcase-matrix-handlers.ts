/**
 * API витринной матрицы (Postgres) — Промт 150, блоки размещения — Промт 155.
 */

import type { PoolLike } from "./admin/admin-auth.js";
import { fetchMyClientCodes } from "./my-client-codes-handlers.js";

export type ShowcaseMatrixTargetKind = "model" | "variant" | "placement";
export type ShowcaseMatrixStatus = "need_install" | "installed" | "postponed" | "not_relevant";

export type ShowcasePlacementType =
  | "portal"
  | "cube"
  | "book"
  | "hoof"
  | "unmounted"
  | "branded_stand"
  | "stream_sku";

export type ShowcasePlacementSegment = "vh" | "mk" | "hardware";

export type ShowcasePlacementOurModel = { modelId: string; count: number };
export type ShowcasePlacementCompetitor = { brand: string; count: number };

const TARGET_KINDS = new Set<ShowcaseMatrixTargetKind>(["model", "variant", "placement"]);
export const PLACEMENT_TYPES = new Set<ShowcasePlacementType>([
  "portal",
  "cube",
  "book",
  "hoof",
  "unmounted",
  "branded_stand",
  "stream_sku",
]);
export const PLACEMENT_SEGMENTS = new Set<ShowcasePlacementSegment>(["vh", "mk", "hardware"]);

const DOOR_PLACEMENT_TYPES = new Set<ShowcasePlacementType>([
  "portal",
  "cube",
  "book",
  "hoof",
  "unmounted",
]);
const HARDWARE_PLACEMENT_TYPES = new Set<ShowcasePlacementType>(["branded_stand", "stream_sku"]);

export const MAX_SCOPE_TRADE_POINTS = 500;
const STATUSES = new Set<ShowcaseMatrixStatus>([
  "need_install",
  "installed",
  "postponed",
  "not_relevant",
]);

export type ShowcaseMatrixEntryDto = {
  id: string;
  dealerId: string;
  tradePointId: string;
  targetKind: ShowcaseMatrixTargetKind;
  targetId: string;
  status: ShowcaseMatrixStatus;
  comment: string | null;
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
};

export type ShowcaseMatrixEventDto = {
  id: string;
  entryId: string | null;
  dealerId: string;
  tradePointId: string;
  targetKind: ShowcaseMatrixTargetKind;
  targetId: string;
  oldStatus: string | null;
  newStatus: string | null;
  comment: string | null;
  changedBy: string | null;
  changedByName: string | null;
  changedAt: string;
  placementType: ShowcasePlacementType | null;
  placementSegment: ShowcasePlacementSegment | null;
  placementCapacity: number | null;
  placementActual: number | null;
  placementRef: string | null;
  placementOurModels: ShowcasePlacementOurModel[];
  placementCompetitors: ShowcasePlacementCompetitor[];
};

export type ShowcaseMatrixSessionUser = {
  id: string;
  role: string;
  status: string;
  fullName: string;
};

export type ShowcaseMatrixUpsertInput = {
  dealerId: string;
  tradePointId: string;
  targetKind: ShowcaseMatrixTargetKind;
  targetId: string;
  status: ShowcaseMatrixStatus;
  comment?: string | null;
  clientOpId?: string | null;
  placementType?: ShowcasePlacementType | null;
  placementSegment?: ShowcasePlacementSegment | null;
  placementCapacity?: number | null;
  placementActual?: number | null;
  placementRef?: string | null;
  placementOurModels?: ShowcasePlacementOurModel[] | null;
  placementCompetitors?: ShowcasePlacementCompetitor[] | null;
};

export type ShowcaseMatrixUpsertResult = {
  entry: ShowcaseMatrixEntryDto;
  idempotent: boolean;
};

export type ShowcaseMatrixBatchResultItem =
  | { clientOpId?: string; entry: ShowcaseMatrixEntryDto }
  | { clientOpId?: string; error: string };

export class ShowcaseMatrixValidationError extends Error {
  readonly code: string;

  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message);
    this.name = "ShowcaseMatrixValidationError";
    this.code = code;
  }
}

/** client-ma-ma119856 → MA-MA119856 (как upper(regexp_replace(dealer_id,'^client-',''))) */
export function clientCodeFromDealerId(dealerId: string): string {
  return dealerId.replace(/^client-/i, "").toUpperCase();
}

export type ShowcaseVisibility =
  | { unrestricted: true }
  | { unrestricted: false; visibleCodes: Set<string> };

export async function resolveShowcaseVisibility(
  pool: PoolLike,
  user: { id: string; role: string },
): Promise<ShowcaseVisibility> {
  const role = user.role;
  if (
    role === "admin" ||
    role === "director" ||
    role === "analyst" ||
    role === "marketer" ||
    role === "category_manager"
  ) {
    return { unrestricted: true };
  }
  const codes = await fetchMyClientCodes(pool, { id: user.id, role });
  const visibleCodes = new Set<string>([
    ...codes.ownCodes,
    ...codes.teamCodes,
    ...codes.grantedCodes,
  ]);
  return { unrestricted: false, visibleCodes };
}

export function isDealerVisible(vis: ShowcaseVisibility, dealerId: string): boolean {
  if (vis.unrestricted) return true;
  if (vis.visibleCodes.size === 0) return false;
  return vis.visibleCodes.has(clientCodeFromDealerId(dealerId));
}

function trimStr(raw: unknown, field: string): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new ShowcaseMatrixValidationError(`Укажите ${field}.`);
  }
  return raw.trim();
}

function parseTargetKind(raw: unknown): ShowcaseMatrixTargetKind {
  const v = trimStr(raw, "targetKind");
  if (!TARGET_KINDS.has(v as ShowcaseMatrixTargetKind)) {
    throw new ShowcaseMatrixValidationError("Некорректный targetKind.");
  }
  return v as ShowcaseMatrixTargetKind;
}

function parseStatus(raw: unknown): ShowcaseMatrixStatus {
  const v = trimStr(raw, "status");
  if (!STATUSES.has(v as ShowcaseMatrixStatus)) {
    throw new ShowcaseMatrixValidationError("Некорректный status.");
  }
  return v as ShowcaseMatrixStatus;
}

function parseOptionalComment(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new ShowcaseMatrixValidationError("Некорректный comment.");
  }
  const t = raw.trim();
  return t || null;
}

function parseOptionalClientOpId(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new ShowcaseMatrixValidationError("Некорректный clientOpId.");
  }
  const t = raw.trim();
  return t || null;
}

function parsePlacementType(raw: unknown): ShowcasePlacementType | null {
  if (raw == null || raw === "") return null;
  const v = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!v) return null;
  if (!PLACEMENT_TYPES.has(v as ShowcasePlacementType)) {
    throw new ShowcaseMatrixValidationError("Некорректный placementType.");
  }
  return v as ShowcasePlacementType;
}

function parsePlacementSegment(raw: unknown): ShowcasePlacementSegment | null {
  if (raw == null || raw === "") return null;
  const v = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!v) return null;
  if (!PLACEMENT_SEGMENTS.has(v as ShowcasePlacementSegment)) {
    throw new ShowcaseMatrixValidationError("Некорректный placementSegment.");
  }
  return v as ShowcasePlacementSegment;
}

function parseOptionalCount(raw: unknown, field: string): number | null {
  if (raw == null || raw === "") return null;
  let n: number;
  if (typeof raw === "number") {
    n = raw;
  } else if (typeof raw === "string" && raw.trim() !== "") {
    n = Number(raw.trim());
  } else {
    throw new ShowcaseMatrixValidationError(`Некорректный ${field}.`);
  }
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new ShowcaseMatrixValidationError(`Некорректный ${field}.`);
  }
  return n;
}

function parseOptionalRef(raw: unknown): string | null {
  return parseOptionalClientOpId(raw);
}


function parseOurModels(raw: unknown): ShowcasePlacementOurModel[] {
  if (!Array.isArray(raw)) return [];
  const out: ShowcasePlacementOurModel[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const modelId = String((r as { modelId?: unknown }).modelId ?? "").trim();
    const count = Number.parseInt(String((r as { count?: unknown }).count ?? ""), 10);
    if (!modelId || !Number.isFinite(count) || count < 1) continue;
    out.push({ modelId, count });
  }
  return out;
}

function parseCompetitors(raw: unknown): ShowcasePlacementCompetitor[] {
  if (!Array.isArray(raw)) return [];
  const out: ShowcasePlacementCompetitor[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const brand = String((r as { brand?: unknown }).brand ?? "").trim();
    const count = Number.parseInt(String((r as { count?: unknown }).count ?? ""), 10);
    if (!brand || !Number.isFinite(count) || count < 1) continue;
    out.push({ brand: brand.slice(0, 120), count });
  }
  return out;
}

function assertPlacementTypeMatchesSegment(
  placementType: ShowcasePlacementType,
  placementSegment: ShowcasePlacementSegment,
): void {
  if (placementSegment === "hardware") {
    if (!HARDWARE_PLACEMENT_TYPES.has(placementType)) {
      throw new ShowcaseMatrixValidationError(
        "Для сегмента hardware допустимы только типы branded_stand и stream_sku.",
      );
    }
    return;
  }
  if (!DOOR_PLACEMENT_TYPES.has(placementType)) {
    throw new ShowcaseMatrixValidationError(
      "Для сегментов vh и mk допустимы только типы portal, cube, book, hoof, unmounted.",
    );
  }
}

function normalizePlacementFields(input: ShowcaseMatrixUpsertInput): ShowcaseMatrixUpsertInput {
  if (input.targetKind === "placement") {
    if (!input.placementType || !input.placementSegment) {
      throw new ShowcaseMatrixValidationError("Для блока размещения укажите placementType и placementSegment.");
    }
    assertPlacementTypeMatchesSegment(input.placementType, input.placementSegment);
    return {
      ...input,
      status: "installed",
      placementRef: null,
      comment: input.comment ?? null,
    };
  }

  return {
    ...input,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: input.placementRef ?? null,
    placementOurModels: [],
    placementCompetitors: [],
  };
}

export function parseShowcaseMatrixUpsertInput(body: Record<string, unknown>): ShowcaseMatrixUpsertInput {
  const targetKind = parseTargetKind(body.targetKind);
  const parsed: ShowcaseMatrixUpsertInput = {
    dealerId: trimStr(body.dealerId, "dealerId"),
    tradePointId: trimStr(body.tradePointId, "tradePointId"),
    targetKind,
    targetId: trimStr(body.targetId, "targetId"),
    status: parseStatus(body.status),
    comment: parseOptionalComment(body.comment),
    clientOpId: parseOptionalClientOpId(body.clientOpId),
    placementType: parsePlacementType(body.placementType),
    placementSegment: parsePlacementSegment(body.placementSegment),
    placementCapacity: parseOptionalCount(body.placementCapacity, "placementCapacity"),
    placementActual: parseOptionalCount(body.placementActual, "placementActual"),
    placementRef: parseOptionalRef(body.placementRef),
    placementOurModels: parseOurModels(body.placementOurModels),
    placementCompetitors: parseCompetitors(body.placementCompetitors),
  };
  return normalizePlacementFields(parsed);
}

function mapOptionalPlacementType(raw: unknown): ShowcasePlacementType | null {
  if (raw == null) return null;
  const v = String(raw);
  return PLACEMENT_TYPES.has(v as ShowcasePlacementType) ? (v as ShowcasePlacementType) : null;
}

function mapOptionalPlacementSegment(raw: unknown): ShowcasePlacementSegment | null {
  if (raw == null) return null;
  const v = String(raw);
  return PLACEMENT_SEGMENTS.has(v as ShowcasePlacementSegment) ? (v as ShowcasePlacementSegment) : null;
}

function mapOptionalInt(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function mapEntryRow(row: Record<string, unknown>): ShowcaseMatrixEntryDto {
  return {
    id: String(row.id),
    dealerId: String(row.dealer_id),
    tradePointId: String(row.trade_point_id),
    targetKind: String(row.target_kind) as ShowcaseMatrixTargetKind,
    targetId: String(row.target_id),
    status: String(row.status) as ShowcaseMatrixStatus,
    comment: row.comment != null ? String(row.comment) : null,
    updatedAt: String(row.updated_at),
    updatedBy: row.updated_by != null ? String(row.updated_by) : null,
    updatedByName: row.updated_by_name != null ? String(row.updated_by_name) : null,
    placementType: mapOptionalPlacementType(row.placement_type),
    placementSegment: mapOptionalPlacementSegment(row.placement_segment),
    placementCapacity: mapOptionalInt(row.placement_capacity),
    placementActual: mapOptionalInt(row.placement_actual),
    placementRef: row.placement_ref != null ? String(row.placement_ref) : null,
    placementOurModels: parseOurModels(row.placement_our_models),
    placementCompetitors: parseCompetitors(row.placement_competitors),
  };
}

function mapEventRow(row: Record<string, unknown>): ShowcaseMatrixEventDto {
  return {
    id: String(row.id),
    entryId: row.entry_id != null ? String(row.entry_id) : null,
    dealerId: String(row.dealer_id),
    tradePointId: String(row.trade_point_id),
    targetKind: String(row.target_kind) as ShowcaseMatrixTargetKind,
    targetId: String(row.target_id),
    oldStatus: row.old_status != null ? String(row.old_status) : null,
    newStatus: row.new_status != null ? String(row.new_status) : null,
    comment: row.comment != null ? String(row.comment) : null,
    changedBy: row.changed_by != null ? String(row.changed_by) : null,
    changedByName: row.changed_by_name != null ? String(row.changed_by_name) : null,
    changedAt: String(row.changed_at),
    placementType: mapOptionalPlacementType(row.placement_type),
    placementSegment: mapOptionalPlacementSegment(row.placement_segment),
    placementCapacity: mapOptionalInt(row.placement_capacity),
    placementActual: mapOptionalInt(row.placement_actual),
    placementRef: row.placement_ref != null ? String(row.placement_ref) : null,
    placementOurModels: parseOurModels(row.placement_our_models),
    placementCompetitors: parseCompetitors(row.placement_competitors),
  };
}

async function fetchByClientOpId(
  pool: PoolLike,
  clientOpId: string,
): Promise<ShowcaseMatrixEntryDto | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_matrix_entries WHERE client_op_id = $1 LIMIT 1`,
    [clientOpId],
  );
  return r.rows[0] ? mapEntryRow(r.rows[0]) : null;
}

async function fetchByTarget(
  pool: PoolLike,
  tradePointId: string,
  targetKind: ShowcaseMatrixTargetKind,
  targetId: string,
): Promise<ShowcaseMatrixEntryDto | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_matrix_entries
     WHERE trade_point_id = $1 AND target_kind = $2 AND target_id = $3
     LIMIT 1`,
    [tradePointId, targetKind, targetId],
  );
  return r.rows[0] ? mapEntryRow(r.rows[0]) : null;
}

type PlacementSnapshot = {
  placementType: ShowcasePlacementType | null;
  placementSegment: ShowcasePlacementSegment | null;
  placementCapacity: number | null;
  placementActual: number | null;
  placementRef: string | null;
  placementOurModels: ShowcasePlacementOurModel[];
  placementCompetitors: ShowcasePlacementCompetitor[];
};

async function insertEvent(
  pool: PoolLike,
  params: {
    entryId: string;
    dealerId: string;
    tradePointId: string;
    targetKind: ShowcaseMatrixTargetKind;
    targetId: string;
    oldStatus: string | null;
    newStatus: ShowcaseMatrixStatus;
    comment: string | null;
    changedBy: string;
    changedByName: string;
    placement: PlacementSnapshot;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO showcase_matrix_events (
       entry_id, dealer_id, trade_point_id, target_kind, target_id,
       old_status, new_status, comment, changed_by, changed_by_name,
       placement_type, placement_segment, placement_capacity, placement_actual, placement_ref,
       placement_our_models, placement_competitors
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb)`,
    [
      params.entryId,
      params.dealerId,
      params.tradePointId,
      params.targetKind,
      params.targetId,
      params.oldStatus,
      params.newStatus,
      params.comment,
      params.changedBy,
      params.changedByName,
      params.placement.placementType,
      params.placement.placementSegment,
      params.placement.placementCapacity,
      params.placement.placementActual,
      params.placement.placementRef,
      JSON.stringify(params.placement.placementOurModels ?? []),
      JSON.stringify(params.placement.placementCompetitors ?? []),
    ],
  );
}

function placementSnapshotFromInput(input: ShowcaseMatrixUpsertInput): PlacementSnapshot {
  return {
    placementType: input.placementType ?? null,
    placementSegment: input.placementSegment ?? null,
    placementCapacity: input.placementCapacity ?? null,
    placementActual: input.placementActual ?? null,
    placementRef: input.placementRef ?? null,
    placementOurModels: input.placementOurModels ?? [],
    placementCompetitors: input.placementCompetitors ?? [],
  };
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
  if (
    JSON.stringify(prev.placementCompetitors ?? []) !== JSON.stringify(input.placementCompetitors ?? [])
  ) {
    return true;
  }
  return false;
}

export async function upsertShowcaseMatrixEntry(
  pool: PoolLike,
  sessionUser: ShowcaseMatrixSessionUser,
  input: ShowcaseMatrixUpsertInput,
): Promise<ShowcaseMatrixUpsertResult> {
  if (sessionUser.status !== "active") {
    throw new ShowcaseMatrixValidationError("Недостаточно прав.");
  }

  const normalized = normalizePlacementFields(input);

  const clientOpId = normalized.clientOpId ?? null;
  if (clientOpId) {
    const existingByOp = await fetchByClientOpId(pool, clientOpId);
    if (existingByOp) {
      return { entry: existingByOp, idempotent: true };
    }
  }

  const prev = await fetchByTarget(
    pool,
    normalized.tradePointId,
    normalized.targetKind,
    normalized.targetId,
  );
  const oldStatus = prev?.status ?? null;
  const shouldWriteEvent = entryChanged(prev, normalized);

  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO showcase_matrix_entries (
       dealer_id, trade_point_id, target_kind, target_id, status, comment,
       client_op_id, updated_at, updated_by, updated_by_name,
       placement_type, placement_segment, placement_capacity, placement_actual, placement_ref,
       placement_our_models, placement_competitors
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8::uuid, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb)
     ON CONFLICT (trade_point_id, target_kind, target_id)
     DO UPDATE SET
       dealer_id = EXCLUDED.dealer_id,
       status = EXCLUDED.status,
       comment = EXCLUDED.comment,
       client_op_id = COALESCE(EXCLUDED.client_op_id, showcase_matrix_entries.client_op_id),
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by,
       updated_by_name = EXCLUDED.updated_by_name,
       placement_type = EXCLUDED.placement_type,
       placement_segment = EXCLUDED.placement_segment,
       placement_capacity = EXCLUDED.placement_capacity,
       placement_actual = EXCLUDED.placement_actual,
       placement_ref = EXCLUDED.placement_ref,
       placement_our_models = EXCLUDED.placement_our_models,
       placement_competitors = EXCLUDED.placement_competitors
     RETURNING *`,
    [
      normalized.dealerId,
      normalized.tradePointId,
      normalized.targetKind,
      normalized.targetId,
      normalized.status,
      normalized.comment ?? null,
      clientOpId,
      sessionUser.id,
      sessionUser.fullName,
      normalized.placementType,
      normalized.placementSegment,
      normalized.placementCapacity,
      normalized.placementActual,
      normalized.placementRef,
      JSON.stringify(normalized.placementOurModels ?? []),
      JSON.stringify(normalized.placementCompetitors ?? []),
    ],
  );

  const entry = mapEntryRow(r.rows[0]!);
  if (shouldWriteEvent) {
    await insertEvent(pool, {
      entryId: entry.id,
      dealerId: normalized.dealerId,
      tradePointId: normalized.tradePointId,
      targetKind: normalized.targetKind,
      targetId: normalized.targetId,
      oldStatus,
      newStatus: normalized.status,
      comment: normalized.comment ?? null,
      changedBy: sessionUser.id,
      changedByName: sessionUser.fullName,
      placement: placementSnapshotFromInput(normalized),
    });
  }

  return { entry, idempotent: false };
}

export async function handleShowcaseMatrixList(
  pool: PoolLike,
  params: { dealerId?: string; tradePointId?: string },
): Promise<{ success: true; entries: ShowcaseMatrixEntryDto[] }> {
  const tradePointId = typeof params.tradePointId === "string" ? params.tradePointId.trim() : "";
  const dealerId = typeof params.dealerId === "string" ? params.dealerId.trim() : "";

  if (!tradePointId) {
    throw new ShowcaseMatrixValidationError("Укажите tradePointId.");
  }

  const queryParams: unknown[] = [tradePointId];
  let sql = `SELECT * FROM showcase_matrix_entries WHERE trade_point_id = $1`;
  if (dealerId) {
    queryParams.push(dealerId);
    sql += ` AND dealer_id = $${queryParams.length}`;
  }
  sql += ` ORDER BY updated_at DESC`;

  const r = await pool.query<Record<string, unknown>>(sql, queryParams);
  return { success: true, entries: r.rows.map(mapEntryRow) };
}

function parseScopeTradePointIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new ShowcaseMatrixValidationError("Укажите tradePointIds.");
  }
  const ids = [
    ...new Set(
      raw
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
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
  return [...new Set(out)];
}

export async function handleShowcaseMatrixScopeAll(
  pool: PoolLike,
  vis: ShowcaseVisibility,
  params: { statuses?: unknown },
): Promise<{ success: true; entries: ShowcaseMatrixEntryDto[]; tradePointIds: string[] }> {
  const statuses = parseScopeStatuses(params.statuses);

  if (!vis.unrestricted && vis.visibleCodes.size === 0) {
    return { success: true, entries: [], tradePointIds: [] };
  }

  const queryParams: unknown[] = [];
  const conditions: string[] = [];

  if (!vis.unrestricted) {
    queryParams.push(Array.from(vis.visibleCodes));
    conditions.push(`upper(regexp_replace(dealer_id, '^client-', '')) = ANY($${queryParams.length}::text[])`);
  }
  if (statuses && statuses.length > 0) {
    queryParams.push(statuses);
    conditions.push(`status = ANY($${queryParams.length}::text[])`);
  }

  let sql = `SELECT * FROM showcase_matrix_entries`;
  if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
  sql += ` ORDER BY updated_at DESC`;

  const r = await pool.query<Record<string, unknown>>(sql, queryParams);
  const entries = r.rows.map(mapEntryRow);
  const tradePointIds = Array.from(new Set(entries.map((e) => e.tradePointId).filter(Boolean)));
  return { success: true, entries, tradePointIds };
}

export async function handleShowcaseMatrixScope(
  pool: PoolLike,
  params: { tradePointIds?: unknown; statuses?: unknown },
  vis?: ShowcaseVisibility,
): Promise<{ success: true; entries: ShowcaseMatrixEntryDto[] }> {
  const tradePointIds = parseScopeTradePointIds(params.tradePointIds);
  const statuses = parseScopeStatuses(params.statuses);

  const queryParams: unknown[] = [tradePointIds];
  let sql = `SELECT * FROM showcase_matrix_entries WHERE trade_point_id = ANY($1::text[])`;
  if (statuses && statuses.length > 0) {
    queryParams.push(statuses);
    sql += ` AND status = ANY($${queryParams.length}::text[])`;
  }
  sql += ` ORDER BY updated_at DESC`;

  const r = await pool.query<Record<string, unknown>>(sql, queryParams);
  let entries = r.rows.map(mapEntryRow);
  if (vis && !vis.unrestricted) {
    entries = entries.filter((e) => isDealerVisible(vis, e.dealerId));
  }
  return { success: true, entries };
}

export async function handleShowcaseMatrixUpsert(
  pool: PoolLike,
  sessionUser: ShowcaseMatrixSessionUser,
  body: Record<string, unknown>,
  vis?: ShowcaseVisibility,
): Promise<{ success: true; entry: ShowcaseMatrixEntryDto }> {
  const input = parseShowcaseMatrixUpsertInput(body);
  if (vis && !isDealerVisible(vis, input.dealerId)) {
    throw new ShowcaseMatrixValidationError("Точка вне вашей зоны видимости.", "FORBIDDEN_SCOPE");
  }
  const { entry } = await upsertShowcaseMatrixEntry(pool, sessionUser, input);
  return { success: true, entry };
}

export async function handleShowcaseMatrixBatchSync(
  pool: PoolLike,
  sessionUser: ShowcaseMatrixSessionUser,
  body: Record<string, unknown>,
  vis?: ShowcaseVisibility,
): Promise<{
  success: true;
  results: ShowcaseMatrixBatchResultItem[];
  applied: number;
  skipped: number;
}> {
  const rawOps = body.operations;
  if (!Array.isArray(rawOps)) {
    throw new ShowcaseMatrixValidationError("Укажите operations.");
  }

  const results: ShowcaseMatrixBatchResultItem[] = [];
  let applied = 0;
  let skipped = 0;

  for (const raw of rawOps) {
    const op = (raw ?? {}) as Record<string, unknown>;
    const clientOpId =
      typeof op.clientOpId === "string" && op.clientOpId.trim() ? op.clientOpId.trim() : undefined;
    try {
      const input = parseShowcaseMatrixUpsertInput(op);
      if (vis && !isDealerVisible(vis, input.dealerId)) {
        results.push({ clientOpId, error: "Точка вне вашей зоны видимости." });
        continue;
      }
      const { entry, idempotent } = await upsertShowcaseMatrixEntry(pool, sessionUser, input);
      results.push({ clientOpId: clientOpId ?? input.clientOpId ?? undefined, entry });
      if (idempotent) skipped += 1;
      else applied += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ clientOpId, error: message });
    }
  }

  return { success: true, results, applied, skipped };
}

export async function handleShowcaseMatrixHistory(
  pool: PoolLike,
  params: { tradePointId?: string; dealerId?: string; limit?: number },
): Promise<{ success: true; events: ShowcaseMatrixEventDto[] }> {
  const tradePointId = typeof params.tradePointId === "string" ? params.tradePointId.trim() : "";
  const dealerId = typeof params.dealerId === "string" ? params.dealerId.trim() : "";
  // Допускаем выборку либо по ТТ (детальная история точки),
  // либо по дилеру (batch для тренда дистрибуции по скоупу). Хотя бы один обязателен.
  if (!tradePointId && !dealerId) {
    throw new ShowcaseMatrixValidationError("Укажите tradePointId или dealerId.");
  }

  const limitRaw = params.limit;
  // Для batch-выборки по дилеру событий заметно больше, поэтому потолок выше (2000),
  // для точечной истории ТТ поведение прежнее.
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
    conditions.push(`trade_point_id = $${queryParams.length}`);
  }
  if (dealerId) {
    queryParams.push(dealerId);
    conditions.push(`dealer_id = $${queryParams.length}`);
  }
  queryParams.push(limit);
  const sql =
    `SELECT * FROM showcase_matrix_events WHERE ${conditions.join(" AND ")}` +
    ` ORDER BY changed_at DESC LIMIT $${queryParams.length}`;

  const r = await pool.query<Record<string, unknown>>(sql, queryParams);
  return { success: true, events: r.rows.map(mapEventRow) };
}
