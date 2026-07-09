/**
 * Общее хранилище параметров витрины ТТ (trade_point_showcase_state).
 * Dual-write из POST /api/actualization/state + batch-read для аналитики.
 */
import { isoMs } from "./actualization-state-merge.js";

export type SqlFn = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<Record<string, unknown>[]>;

export type TradePointShowcaseSharedRecord = {
  tradePointId: string;
  dealerId: string;
  data: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string | null;
};

let ensureTablePromise: Promise<void> | null = null;

export async function ensureTradePointShowcaseStateTable(sql: SqlFn): Promise<void> {
  if (ensureTablePromise) return ensureTablePromise;
  ensureTablePromise = (async () => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS trade_point_showcase_state (
          trade_point_id text PRIMARY KEY,
          dealer_id text NOT NULL,
          data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          updated_by text NOT NULL,
          updated_by_name text
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_tp_showcase_state_dealer ON trade_point_showcase_state (dealer_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_tp_showcase_state_updated_at ON trade_point_showcase_state (updated_at)
      `;
    } catch (e) {
      ensureTablePromise = null;
      throw e;
    }
  })();
  return ensureTablePromise;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function showcaseRecordFromMapEntry(
  tradePointId: string,
  entry: unknown,
): TradePointShowcaseSharedRecord | null {
  if (!isPlainObject(entry)) return null;
  const dealerId = asString(entry.dealerId);
  const updatedAt = asString(entry.updatedAt);
  const updatedBy = asString(entry.updatedBy);
  if (!dealerId || !updatedAt || !updatedBy) return null;
  return {
    tradePointId,
    dealerId,
    data: entry,
    updatedAt,
    updatedBy,
    updatedByName: asString(entry.updatedByName),
  };
}

export function findChangedShowcaseRecords(
  prevMap: Record<string, unknown> | null | undefined,
  nextMap: Record<string, unknown> | null | undefined,
): TradePointShowcaseSharedRecord[] {
  const prev = isPlainObject(prevMap) ? prevMap : {};
  const next = isPlainObject(nextMap) ? nextMap : {};
  const out: TradePointShowcaseSharedRecord[] = [];

  for (const [tradePointId, rawNext] of Object.entries(next)) {
    const nextRec = showcaseRecordFromMapEntry(tradePointId, rawNext);
    if (!nextRec) continue;
    const rawPrev = prev[tradePointId];
    if (!isPlainObject(rawPrev)) {
      out.push(nextRec);
      continue;
    }
    const prevUpdatedAt = asString(rawPrev.updatedAt);
    if (isoMs(nextRec.updatedAt) > isoMs(prevUpdatedAt)) {
      out.push(nextRec);
    }
  }

  return out;
}

export async function upsertTradePointShowcaseRecords(
  sql: SqlFn,
  records: readonly TradePointShowcaseSharedRecord[],
): Promise<{ upserted: number; skipped: number }> {
  if (records.length === 0) return { upserted: 0, skipped: 0 };
  await ensureTradePointShowcaseStateTable(sql);

  let upserted = 0;
  let skipped = 0;
  for (const rec of records) {
    const rows = await sql`
      INSERT INTO trade_point_showcase_state (
        trade_point_id, dealer_id, data, updated_at, updated_by, updated_by_name
      )
      VALUES (
        ${rec.tradePointId},
        ${rec.dealerId},
        ${JSON.stringify(rec.data)}::jsonb,
        ${rec.updatedAt}::timestamptz,
        ${rec.updatedBy},
        ${rec.updatedByName}
      )
      ON CONFLICT (trade_point_id) DO UPDATE SET
        dealer_id = EXCLUDED.dealer_id,
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by,
        updated_by_name = EXCLUDED.updated_by_name
      WHERE EXCLUDED.updated_at > trade_point_showcase_state.updated_at
      RETURNING trade_point_id
    `;
    if (rows.length > 0) upserted += 1;
    else skipped += 1;
  }
  return { upserted, skipped };
}

export async function dualWriteShowcaseRecordsFromActualizationState(
  sql: SqlFn,
  prevState: Record<string, unknown> | null | undefined,
  nextState: Record<string, unknown> | null | undefined,
): Promise<void> {
  const prevMap = isPlainObject(prevState?.tradePointShowcaseActualizationById)
    ? (prevState.tradePointShowcaseActualizationById as Record<string, unknown>)
    : {};
  const nextMap = isPlainObject(nextState?.tradePointShowcaseActualizationById)
    ? (nextState.tradePointShowcaseActualizationById as Record<string, unknown>)
    : {};
  const changed = findChangedShowcaseRecords(prevMap, nextMap);
  if (changed.length === 0) return;
  const result = await upsertTradePointShowcaseRecords(sql, changed);
  if (result.skipped > 0) {
    console.warn(
      `[trade-point-showcase-shared-store] dual-write skipped stale records=${result.skipped} upserted=${result.upserted}`,
    );
  }
}

function rowToSharedRecord(row: Record<string, unknown>): TradePointShowcaseSharedRecord | null {
  const tradePointId = asString(row.trade_point_id);
  const dealerId = asString(row.dealer_id);
  const data = row.data;
  if (!tradePointId || !dealerId || !isPlainObject(data)) return null;
  const updatedAt =
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : asString(row.updated_at) ?? new Date(0).toISOString();
  const updatedBy = asString(row.updated_by);
  if (!updatedBy) return null;
  return {
    tradePointId,
    dealerId,
    data,
    updatedAt,
    updatedBy,
    updatedByName: asString(row.updated_by_name),
  };
}

export async function fetchTradePointShowcaseBatch(
  sql: SqlFn,
  tradePointIds: readonly string[],
): Promise<TradePointShowcaseSharedRecord[]> {
  const ids = Array.from(new Set(tradePointIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) return [];
  await ensureTradePointShowcaseStateTable(sql);
  const rows = await sql`
    SELECT trade_point_id, dealer_id, data, updated_at, updated_by, updated_by_name
    FROM trade_point_showcase_state
    WHERE trade_point_id = ANY(${ids}::text[])
  `;
  const out: TradePointShowcaseSharedRecord[] = [];
  for (const row of rows) {
    const rec = rowToSharedRecord(row);
    if (rec) out.push(rec);
  }
  return out;
}
