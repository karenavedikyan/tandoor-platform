/**
 * API витринной матрицы (Postgres) — Промт 150.
 */

import type { PoolLike } from "./admin/admin-auth.js";

export type ShowcaseMatrixTargetKind = "model" | "variant";
export type ShowcaseMatrixStatus = "need_install" | "installed" | "postponed" | "not_relevant";

const TARGET_KINDS = new Set<ShowcaseMatrixTargetKind>(["model", "variant"]);
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
};

export type ShowcaseMatrixUpsertResult = {
  entry: ShowcaseMatrixEntryDto;
  idempotent: boolean;
};

export type ShowcaseMatrixBatchResultItem =
  | { clientOpId?: string; entry: ShowcaseMatrixEntryDto }
  | { clientOpId?: string; error: string };

export class ShowcaseMatrixValidationError extends Error {
  readonly code = "VALIDATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "ShowcaseMatrixValidationError";
  }
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

export function parseShowcaseMatrixUpsertInput(body: Record<string, unknown>): ShowcaseMatrixUpsertInput {
  return {
    dealerId: trimStr(body.dealerId, "dealerId"),
    tradePointId: trimStr(body.tradePointId, "tradePointId"),
    targetKind: parseTargetKind(body.targetKind),
    targetId: trimStr(body.targetId, "targetId"),
    status: parseStatus(body.status),
    comment: parseOptionalComment(body.comment),
    clientOpId: parseOptionalClientOpId(body.clientOpId),
  };
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
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO showcase_matrix_events (
       entry_id, dealer_id, trade_point_id, target_kind, target_id,
       old_status, new_status, comment, changed_by, changed_by_name
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10)`,
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
    ],
  );
}

export async function upsertShowcaseMatrixEntry(
  pool: PoolLike,
  sessionUser: ShowcaseMatrixSessionUser,
  input: ShowcaseMatrixUpsertInput,
): Promise<ShowcaseMatrixUpsertResult> {
  if (sessionUser.status !== "active") {
    throw new ShowcaseMatrixValidationError("Недостаточно прав.");
  }

  const clientOpId = input.clientOpId ?? null;
  if (clientOpId) {
    const existingByOp = await fetchByClientOpId(pool, clientOpId);
    if (existingByOp) {
      return { entry: existingByOp, idempotent: true };
    }
  }

  const prev = await fetchByTarget(pool, input.tradePointId, input.targetKind, input.targetId);
  const oldStatus = prev?.status ?? null;
  const statusChanged = oldStatus !== input.status;

  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO showcase_matrix_entries (
       dealer_id, trade_point_id, target_kind, target_id, status, comment,
       client_op_id, updated_at, updated_by, updated_by_name
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8::uuid, $9)
     ON CONFLICT (trade_point_id, target_kind, target_id)
     DO UPDATE SET
       dealer_id = EXCLUDED.dealer_id,
       status = EXCLUDED.status,
       comment = EXCLUDED.comment,
       client_op_id = COALESCE(EXCLUDED.client_op_id, showcase_matrix_entries.client_op_id),
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by,
       updated_by_name = EXCLUDED.updated_by_name
     RETURNING *`,
    [
      input.dealerId,
      input.tradePointId,
      input.targetKind,
      input.targetId,
      input.status,
      input.comment,
      clientOpId,
      sessionUser.id,
      sessionUser.fullName,
    ],
  );

  const entry = mapEntryRow(r.rows[0]!);
  if (!prev || statusChanged) {
    await insertEvent(pool, {
      entryId: entry.id,
      dealerId: input.dealerId,
      tradePointId: input.tradePointId,
      targetKind: input.targetKind,
      targetId: input.targetId,
      oldStatus,
      newStatus: input.status,
      comment: input.comment ?? null,
      changedBy: sessionUser.id,
      changedByName: sessionUser.fullName,
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

export async function handleShowcaseMatrixUpsert(
  pool: PoolLike,
  sessionUser: ShowcaseMatrixSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; entry: ShowcaseMatrixEntryDto }> {
  const input = parseShowcaseMatrixUpsertInput(body);
  const { entry } = await upsertShowcaseMatrixEntry(pool, sessionUser, input);
  return { success: true, entry };
}

export async function handleShowcaseMatrixBatchSync(
  pool: PoolLike,
  sessionUser: ShowcaseMatrixSessionUser,
  body: Record<string, unknown>,
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
  if (!tradePointId) {
    throw new ShowcaseMatrixValidationError("Укажите tradePointId.");
  }

  const dealerId = typeof params.dealerId === "string" ? params.dealerId.trim() : "";
  const limitRaw = params.limit;
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 500)
      : 200;

  const queryParams: unknown[] = [tradePointId];
  let sql = `SELECT * FROM showcase_matrix_events WHERE trade_point_id = $1`;
  if (dealerId) {
    queryParams.push(dealerId);
    sql += ` AND dealer_id = $${queryParams.length}`;
  }
  queryParams.push(limit);
  sql += ` ORDER BY changed_at DESC LIMIT $${queryParams.length}`;

  const r = await pool.query<Record<string, unknown>>(sql, queryParams);
  return { success: true, events: r.rows.map(mapEventRow) };
}
