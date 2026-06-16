/**
 * Shadow-сверка seed ↔ БД для каталога дилеров (Промт 374).
 */

import type { DealerRow, DealerTradePoint } from "../../client/src/lib/dealer-base-mock-data.js";
import type { PoolLike } from "../../shared/admin/admin-auth.js";

export type DiffKind = "missing_in_db" | "missing_in_seed" | "value_mismatch" | "tp_count_mismatch";

export type DiffEntry = {
  externalKey: string;
  field: string;
  seedValue: string | null;
  dbValue: string | null;
  diffKind: DiffKind;
};

/** Поля DealerRow, значимые для сверки (без runtime-заглушек). */
export const COMPARABLE_DEALER_FIELDS = [
  "id",
  "releaseCode",
  "releaseAddress",
  "clientTypeLabel",
  "name",
  "city",
  "region",
  "ropName",
  "clientCategory",
  "importanceTier",
  "status",
  "format",
  "outlets",
  "manager",
  "releaseTeamId",
  "releaseManagerId",
  "hasProblem",
  "comment",
  "hasRecentActivity",
  "legalEntity",
  "holding",
] as const;

export const COMPARABLE_TP_FIELDS = ["id", "name", "city", "address", "format", "status"] as const;

const IGNORED_FIELDS = new Set(["searchText"]);

function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function pickComparableDealerFields(row: DealerRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of COMPARABLE_DEALER_FIELDS) {
    out[key] = row[key as keyof DealerRow];
  }
  return out;
}

function pickComparableTpFields(tp: DealerTradePoint): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of COMPARABLE_TP_FIELDS) {
    out[key] = tp[key as keyof DealerTradePoint];
  }
  return out;
}

export function diffDealerRow(seed: DealerRow, db: DealerRow): DiffEntry[] {
  const externalKey = seed.id;
  const entries: DiffEntry[] = [];

  const seedFields = pickComparableDealerFields(seed);
  const dbFields = pickComparableDealerFields(db);

  for (const [field, seedVal] of Object.entries(seedFields)) {
    if (IGNORED_FIELDS.has(field)) continue;
    const dbVal = dbFields[field];
    const seedS = serialize(seedVal);
    const dbS = serialize(dbVal);
    if (seedS !== dbS) {
      entries.push({
        externalKey,
        field,
        seedValue: seedS,
        dbValue: dbS,
        diffKind: "value_mismatch",
      });
    }
  }

  if (seed.tradePoints.length !== db.tradePoints.length) {
    entries.push({
      externalKey,
      field: "tradePoints.length",
      seedValue: String(seed.tradePoints.length),
      dbValue: String(db.tradePoints.length),
      diffKind: "tp_count_mismatch",
    });
  }

  const tpCount = Math.min(seed.tradePoints.length, db.tradePoints.length);
  for (let i = 0; i < tpCount; i += 1) {
    const seedTp = seed.tradePoints[i]!;
    const dbTp = db.tradePoints[i]!;
    const seedTpFields = pickComparableTpFields(seedTp);
    const dbTpFields = pickComparableTpFields(dbTp);
    for (const [field, seedVal] of Object.entries(seedTpFields)) {
      const seedS = serialize(seedVal);
      const dbS = serialize(dbTpFields[field]);
      if (seedS !== dbS) {
        entries.push({
          externalKey,
          field: `tradePoints[${i}].${field}`,
          seedValue: seedS,
          dbValue: dbS,
          diffKind: "value_mismatch",
        });
      }
    }
  }

  return entries;
}

export function diffDealerCatalogs(
  seedRows: DealerRow[],
  dbRows: DealerRow[],
): DiffEntry[] {
  const seedMap = new Map(seedRows.map((r) => [r.id, r]));
  const dbMap = new Map(dbRows.map((r) => [r.id, r]));
  const allKeys = new Set([...seedMap.keys(), ...dbMap.keys()]);
  const entries: DiffEntry[] = [];

  for (const key of allKeys) {
    const seed = seedMap.get(key);
    const db = dbMap.get(key);
    if (seed && !db) {
      entries.push({
        externalKey: key,
        field: "*",
        seedValue: "present",
        dbValue: null,
        diffKind: "missing_in_db",
      });
      continue;
    }
    if (!seed && db) {
      entries.push({
        externalKey: key,
        field: "*",
        seedValue: null,
        dbValue: "present",
        diffKind: "missing_in_seed",
      });
      continue;
    }
    if (seed && db) {
      entries.push(...diffDealerRow(seed, db));
    }
  }

  return entries;
}

export async function persistDiffs(
  pool: PoolLike,
  entries: DiffEntry[],
  scope = "shadow",
): Promise<number> {
  if (entries.length === 0) return 0;

  const BATCH = 200;
  let written = 0;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((e, idx) => {
      const base = idx * 6;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`,
      );
      values.push(e.externalKey, e.field, e.seedValue, e.dbValue, e.diffKind, scope);
    });

    await pool.query(
      `INSERT INTO dealer_db_diff_log (external_key, field, seed_value, db_value, diff_kind, scope)
       VALUES ${placeholders.join(", ")}`,
      values,
    );
    written += batch.length;
  }

  return written;
}

export type ShadowAuditSummary = {
  totalSeed: number;
  totalDb: number;
  matched: number;
  missingInDb: number;
  missingInSeed: number;
  valueMismatches: number;
  tpCountMismatches: number;
  diffsWritten: number;
};

export function summarizeDiffEntries(
  seedRows: DealerRow[],
  dbRows: DealerRow[],
  entries: DiffEntry[],
): ShadowAuditSummary {
  const seedIds = new Set(seedRows.map((r) => r.id));
  const dbIds = new Set(dbRows.map((r) => r.id));
  let matched = 0;
  for (const id of seedIds) {
    if (dbIds.has(id)) matched += 1;
  }

  return {
    totalSeed: seedRows.length,
    totalDb: dbRows.length,
    matched,
    missingInDb: entries.filter((e) => e.diffKind === "missing_in_db").length,
    missingInSeed: entries.filter((e) => e.diffKind === "missing_in_seed").length,
    valueMismatches: entries.filter((e) => e.diffKind === "value_mismatch").length,
    tpCountMismatches: entries.filter((e) => e.diffKind === "tp_count_mismatch").length,
    diffsWritten: entries.length,
  };
}

/** Fire-and-forget shadow diff (не блокирует ответ API). */
export function scheduleShadowDiff(
  pool: PoolLike,
  seedRows: DealerRow[],
  dbRows: DealerRow[],
  scope = "shadow",
): void {
  setImmediate(() => {
    void (async () => {
      try {
        const entries = diffDealerCatalogs(seedRows, dbRows);
        if (entries.length > 0) {
          await persistDiffs(pool, entries, scope);
          console.warn(
            `[dealers-shadow] ${entries.length} diff(s): missing_in_db=${entries.filter((e) => e.diffKind === "missing_in_db").length}, missing_in_seed=${entries.filter((e) => e.diffKind === "missing_in_seed").length}, value_mismatch=${entries.filter((e) => e.diffKind === "value_mismatch").length}`,
          );
        }
      } catch (e) {
        console.error("[dealers-shadow]", e instanceof Error ? e.message : e);
      }
    })();
  });
}
