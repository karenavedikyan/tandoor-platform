#!/usr/bin/env node
/**
 * Дедуп actualization-записей в client_base_actualization_state (2026-06-24).
 *
 * Стратегия: «выравнивание копий» — scope-строки НЕ удаляются. Для каждого id в map-полях
 * вычисляется каноническая (самая свежая) копия по тому же критерию, что mergeActualizationStates
 * (rec.updatedAt → state.updatedAt). Устаревшие копии в отдельных scope обновляются до канонической.
 *
 * По умолчанию dry-run (только отчёт). Запись: --apply
 *
 * Запуск:
 *   DATABASE_URL=... node apps/platform/scripts/dedup-actualization-records-2026-06-24.mjs
 *   DATABASE_URL=... node apps/platform/scripts/dedup-actualization-records-2026-06-24.mjs --apply
 */
import { neon } from "@neondatabase/serverless";

const MAP_FIELDS = [
  "clientCategoryOverridesById",
  "dealerOverridesById",
  "manuallyCreatedDealersById",
  "tradePointOverridesById",
  "manuallyCreatedTradePointsById",
  "archivedLegalEntitiesById",
  "legalEntityOverridesByDealerId",
  "dealerCardViewSettingsByUserId",
  "dealerActualizationContactsById",
  "archivedDealerContactsById",
  "tradePointShowcaseActualizationById",
  "dealerActualizationAuditByDealerId",
  "unloadingOrderByDealerId",
  "routeOrderByRouteId",
  "dealerPhotosByDealerId",
  "tradePointPhotosByTradePointId",
  "trashedDealersById",
  "trashedTradePointsById",
];

const apply = process.argv.includes("--apply");
const dryRun = !apply;

const databaseUrl = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  ""
).trim();

if (!databaseUrl) {
  console.error("[dedup-actualization] DATABASE_URL (или POSTGRES_URL / NEON_DATABASE_URL) обязателен.");
  process.exit(1);
}

const sql = neon(databaseUrl);

function isoMs(iso) {
  if (typeof iso !== "string" || !iso) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

function recordRecencyMs(rec, stateFallbackUpdatedAt) {
  if (rec != null && typeof rec === "object" && !Array.isArray(rec)) {
    const own = isoMs(rec.updatedAt);
    if (own !== Number.NEGATIVE_INFINITY) return own;
  }
  return isoMs(stateFallbackUpdatedAt);
}

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function coerceState(raw) {
  const base = { version: 1, updatedAt: null, updatedBy: null };
  for (const f of MAP_FIELDS) base[f] = {};
  if (!isPlainObject(raw)) return base;
  const merged = { ...base, ...raw };
  for (const f of MAP_FIELDS) {
    if (!isPlainObject(merged[f])) merged[f] = {};
  }
  return merged;
}

function buildCanonical(states) {
  const canonical = new Map();
  for (const { state } of states) {
    for (const field of MAP_FIELDS) {
      const value = state[field];
      if (!isPlainObject(value)) continue;
      let fieldMap = canonical.get(field);
      if (!fieldMap) {
        fieldMap = new Map();
        canonical.set(field, fieldMap);
      }
      const fallback = state.updatedAt;
      for (const id of Object.keys(value)) {
        const rec = value[id];
        const ms = recordRecencyMs(rec, fallback);
        const prev = fieldMap.get(id);
        if (!prev || ms > prev.effectiveMs) {
          fieldMap.set(id, { rec, effectiveMs: ms });
        }
      }
    }
  }
  return canonical;
}

function recordsDiffer(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

async function main() {
  console.log(`[dedup-actualization] mode: ${dryRun ? "dry-run (use --apply to write)" : "APPLY"}`);

  const rows = await sql`
    SELECT scope_key, state, updated_at
    FROM client_base_actualization_state
    ORDER BY scope_key
  `;

  console.log(`[dedup-actualization] scanned rows: ${rows.length}`);

  const states = rows.map((row) => ({
    scopeKey: String(row.scope_key),
    state: coerceState(row.state),
    rowUpdatedAt: row.updated_at,
  }));

  const canonical = buildCanonical(states.map((s) => ({ state: s.state })));

  const summaryByField = Object.fromEntries(MAP_FIELDS.map((f) => [f, 0]));
  let totalAlignments = 0;
  let rowsToUpdate = 0;
  const sampleMismatches = [];

  for (const row of states) {
    let rowChanged = false;
    const nextState = { ...row.state };

    for (const field of MAP_FIELDS) {
      const fieldCanon = canonical.get(field);
      if (!fieldCanon) continue;
      const value = row.state[field];
      if (!isPlainObject(value)) continue;
      const nextField = { ...value };
      const fallback = row.state.updatedAt;
      let fieldChanged = false;

      for (const id of Object.keys(value)) {
        const canon = fieldCanon.get(id);
        if (!canon) continue;
        const localMs = recordRecencyMs(value[id], fallback);
        if (localMs >= canon.effectiveMs) continue;
        if (recordsDiffer(value[id], canon.rec)) {
          summaryByField[field]++;
          totalAlignments++;
          nextField[id] = canon.rec;
          fieldChanged = true;
          rowChanged = true;
          if (sampleMismatches.length < 20) {
            sampleMismatches.push({
              scope_key: row.scopeKey,
              field,
              id,
              localMs,
              canonMs: canon.effectiveMs,
            });
          }
        }
      }

      if (fieldChanged) nextState[field] = nextField;
    }

    if (rowChanged) {
      rowsToUpdate++;
      if (apply) {
        await sql`
          UPDATE client_base_actualization_state
          SET state = ${JSON.stringify(nextState)}::jsonb,
              updated_at = now()
          WHERE scope_key = ${row.scopeKey}
        `;
      }
    }
  }

  console.log("[dedup-actualization] summary:");
  console.log(`  rows scanned: ${rows.length}`);
  console.log(`  rows ${dryRun ? "would update" : "updated"}: ${rowsToUpdate}`);
  console.log(`  record alignments: ${totalAlignments}`);
  console.log("  by field:", summaryByField);

  if (sampleMismatches.length > 0) {
    console.log("[dedup-actualization] sample mismatches (up to 20):");
    for (const m of sampleMismatches) {
      console.log(
        `  ${m.scope_key} ${m.field}[${m.id}] localMs=${m.localMs} canonMs=${m.canonMs}`,
      );
    }
  }

  if (dryRun && rowsToUpdate > 0) {
    console.log("[dedup-actualization] dry-run complete — re-run with --apply to write changes.");
  } else {
    console.log("[dedup-actualization] done.");
  }
}

main().catch((err) => {
  console.error("[dedup-actualization] failed:", err);
  process.exit(1);
});
