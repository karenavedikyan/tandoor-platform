/**
 * Разовая миграция параметров витрины из client_base_actualization_state
 * в trade_point_showcase_state (last-write-wins по updatedAt записи).
 */
import { isoMs } from "../shared/actualization-state-merge.js";
import {
  showcaseRecordFromMapEntry,
  upsertTradePointShowcaseRecords,
  type SqlFn,
  type TradePointShowcaseSharedRecord,
} from "../shared/trade-point-showcase-shared-store.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export function collectShowcaseRecordsFromActualizationRows(
  rows: readonly { state: unknown }[],
): {
  scannedJsonbRows: number;
  seenRecords: number;
  recordsByTradePointId: Map<string, TradePointShowcaseSharedRecord>;
} {
  const recordsByTradePointId = new Map<string, TradePointShowcaseSharedRecord>();
  let seenRecords = 0;

  for (const row of rows) {
    const state = row.state;
    if (!isPlainObject(state)) continue;
    const map = state.tradePointShowcaseActualizationById;
    if (!isPlainObject(map)) continue;
    for (const [tradePointId, entry] of Object.entries(map)) {
      const rec = showcaseRecordFromMapEntry(tradePointId, entry);
      if (!rec) continue;
      seenRecords += 1;
      const prev = recordsByTradePointId.get(tradePointId);
      if (!prev || isoMs(rec.updatedAt) > isoMs(prev.updatedAt)) {
        recordsByTradePointId.set(tradePointId, rec);
      }
    }
  }

  return {
    scannedJsonbRows: rows.length,
    seenRecords,
    recordsByTradePointId,
  };
}

export async function migrateShowcaseToSharedStore(sql: SqlFn): Promise<{
  scannedJsonbRows: number;
  seenRecords: number;
  uniqueTradePoints: number;
  upserted: number;
  skippedAsStale: number;
}> {
  const rows = (await sql`
    SELECT state FROM client_base_actualization_state
  `) as Array<{ state: unknown }>;
  const collected = collectShowcaseRecordsFromActualizationRows(rows);
  const records = Array.from(collected.recordsByTradePointId.values());
  const { upserted, skipped } = await upsertTradePointShowcaseRecords(sql, records);
  return {
    scannedJsonbRows: collected.scannedJsonbRows,
    seenRecords: collected.seenRecords,
    uniqueTradePoints: records.length,
    upserted,
    skippedAsStale: skipped,
  };
}
