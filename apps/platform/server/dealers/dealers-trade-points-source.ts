/**
 * Единая точка чтения каталога: seed (default) или БД + shadow diff.
 * Промт 374.
 */

import type { PoolLike } from "../../shared/admin/admin-auth.js";
import {
  handleDealersTradePointsGet as handleDbGet,
  handleDealersTradePointsList as handleDbList,
  handleDealersTradePointsSummary as handleDbSummary,
  type DealersTradePointsSearchFilters,
  type DealersTradePointsSummary,
} from "../../shared/dealers-trade-points-handlers.js";

// Re-export types so api/dealers-trade-points/[action].ts can import them
// from this module without reaching into shared/* directly.
export type { DealersTradePointsSearchFilters, DealersTradePointsSummary };
import type { DealerRow } from "../../client/src/lib/dealer-base-mock-data.js";
import { loadAllDealersFromDb } from "./db-dealers-loader.js";
import { dbBundlesToDealerRows } from "./db-to-dealer-row.js";
import { shadowDiffEnabled, useDbDealers } from "./dealers-source-config.js";
import {
  filterSeedDealerRows,
  loadSeedDealerRows,
  summarizeSeedDealerRows,
} from "./seed-dealers-source.js";
import { scheduleShadowDiff } from "./shadow-diff.js";

export type DealersSourceMeta = {
  source: "seed" | "db";
  shadowDiffEnabled: boolean;
};

async function loadDbDealerRows(): Promise<DealerRow[]> {
  const bundles = await loadAllDealersFromDb();
  return dbBundlesToDealerRows(bundles);
}

function maybeScheduleShadow(
  pool: PoolLike,
  primary: DealerRow[],
  shadow: DealerRow[],
): void {
  if (!shadowDiffEnabled()) return;
  scheduleShadowDiff(pool, primary, shadow);
}

export async function resolveDealersTradePointsList(
  pool: PoolLike,
  filters: DealersTradePointsSearchFilters,
): Promise<{ success: true; dealers: DealerRow[]; meta: DealersSourceMeta }> {
  const meta: DealersSourceMeta = {
    source: useDbDealers() ? "db" : "seed",
    shadowDiffEnabled: shadowDiffEnabled(),
  };

  if (useDbDealers()) {
    const payload = await handleDbList(pool, filters);
    if (shadowDiffEnabled()) {
      const seedAll = filterSeedDealerRows(loadSeedDealerRows(), filters);
      maybeScheduleShadow(pool, payload.dealers, seedAll);
    }
    return { success: true, dealers: payload.dealers, meta };
  }

  const dealers = filterSeedDealerRows(loadSeedDealerRows(), filters);
  if (shadowDiffEnabled()) {
    void loadDbDealerRows()
      .then((dbAll) => {
        const dbFiltered = filterSeedDealerRows(dbAll, filters);
        maybeScheduleShadow(pool, dealers, dbFiltered);
      })
      .catch((e) => {
        console.error("[dealers-source] shadow db load failed", e instanceof Error ? e.message : e);
      });
  }

  return { success: true, dealers, meta };
}

export async function resolveDealersTradePointsGet(
  pool: PoolLike,
  externalKey: string,
): Promise<
  | { success: true; dealer: DealerRow; meta: DealersSourceMeta }
  | { success: false; code: "NOT_FOUND"; message: string }
> {
  const meta: DealersSourceMeta = {
    source: useDbDealers() ? "db" : "seed",
    shadowDiffEnabled: shadowDiffEnabled(),
  };

  if (useDbDealers()) {
    const payload = await handleDbGet(pool, externalKey);
    if (!payload.success) return payload;
    if (shadowDiffEnabled()) {
      const seed = loadSeedDealerRows().find((r) => r.id === externalKey.trim());
      if (seed) {
        maybeScheduleShadow(pool, [payload.dealer], [seed]);
      }
    }
    return { success: true, dealer: payload.dealer, meta };
  }

  const dealer = loadSeedDealerRows().find((r) => r.id === externalKey.trim());
  if (!dealer) {
    return { success: false, code: "NOT_FOUND", message: "Дилер не найден." };
  }

  if (shadowDiffEnabled()) {
    void loadAllDealersFromDb()
      .then((bundles) => {
        const dbRows = dbBundlesToDealerRows(bundles.filter((b) => b.dealer.external_key === dealer.id));
        if (dbRows[0]) maybeScheduleShadow(pool, [dealer], [dbRows[0]]);
      })
      .catch((e) => {
        console.error("[dealers-source] shadow db get failed", e instanceof Error ? e.message : e);
      });
  }

  return { success: true, dealer, meta };
}

export async function resolveDealersTradePointsSummary(
  pool: PoolLike,
  filters: DealersTradePointsSearchFilters = {},
): Promise<{ success: true; summary: DealersTradePointsSummary; meta: DealersSourceMeta }> {
  const meta: DealersSourceMeta = {
    source: useDbDealers() ? "db" : "seed",
    shadowDiffEnabled: shadowDiffEnabled(),
  };

  if (useDbDealers()) {
    const payload = await handleDbSummary(pool, filters);
    return { success: true, summary: payload.summary, meta };
  }

  const filtered = filterSeedDealerRows(loadSeedDealerRows(), filters);
  return {
    success: true,
    summary: summarizeSeedDealerRows(filtered),
    meta,
  };
}
