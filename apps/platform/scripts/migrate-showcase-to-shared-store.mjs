#!/usr/bin/env node
/**
 * Разовая миграция параметров витрины из jsonb actualization state
 * в trade_point_showcase_state.
 *
 * Запуск:
 *   DATABASE_URL=... node apps/platform/scripts/migrate-showcase-to-shared-store.mjs
 */
import { neon } from "@neondatabase/serverless";

const databaseUrl = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  ""
).trim();

if (!databaseUrl) {
  console.error("[migrate-showcase-to-shared-store] DATABASE_URL обязателен.");
  process.exit(1);
}

const sql = neon(databaseUrl);

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function asString(v) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function isoMs(iso) {
  if (typeof iso !== "string" || !iso) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

function showcaseRecordFromMapEntry(tradePointId, entry) {
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

function collectShowcaseRecords(rows) {
  const recordsByTradePointId = new Map();
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

  return { scannedJsonbRows: rows.length, seenRecords, recordsByTradePointId };
}

async function ensureTable() {
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
}

async function upsertRecord(rec) {
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
  return rows.length > 0 ? "upserted" : "skipped";
}

async function main() {
  console.log("[migrate-showcase-to-shared-store] start");
  await ensureTable();

  const rows = await sql`SELECT state FROM client_base_actualization_state`;
  const collected = collectShowcaseRecords(rows);
  const records = [...collected.recordsByTradePointId.values()];

  let upserted = 0;
  let skippedAsStale = 0;
  for (const rec of records) {
    const result = await upsertRecord(rec);
    if (result === "upserted") upserted += 1;
    else skippedAsStale += 1;
  }

  console.log(
    `[migrate-showcase-to-shared-store] scanned_jsonb_rows=${collected.scannedJsonbRows} seen_records=${collected.seenRecords} unique_trade_points=${records.length} upserted=${upserted} skipped_stale=${skippedAsStale}`,
  );
  console.log("[migrate-showcase-to-shared-store] done");
}

main().catch((e) => {
  const m = e instanceof Error ? e.message : String(e);
  console.error("[migrate-showcase-to-shared-store] failed", m);
  process.exit(1);
});
