/**
 * POST /api/dealers-shadow-audit — полная сверка seed ↔ БД (Промт 374).
 */

import type { PoolLike } from "../../shared/admin/admin-auth.js";
import { loadAllDealersFromDb } from "../dealers/db-dealers-loader.js";
import { dbBundlesToDealerRows } from "../dealers/db-to-dealer-row.js";
import { loadSeedDealerRows } from "../dealers/seed-dealers-source.js";
import {
  diffDealerCatalogs,
  persistDiffs,
  summarizeDiffEntries,
  type ShadowAuditSummary,
} from "../dealers/shadow-diff.js";

export async function runDealersShadowAudit(
  pool: PoolLike,
  scope = "audit",
): Promise<{ success: true; summary: ShadowAuditSummary }> {
  const seedRows = loadSeedDealerRows();
  const dbBundles = await loadAllDealersFromDb();
  const dbRows = dbBundlesToDealerRows(dbBundles);

  const entries = diffDealerCatalogs(seedRows, dbRows);
  const written = await persistDiffs(pool, entries, scope);
  const summary = summarizeDiffEntries(seedRows, dbRows, entries);
  summary.diffsWritten = written;

  return { success: true, summary };
}
