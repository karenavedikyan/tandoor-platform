/**
 * Запуск: `npm run test:feature-flags-api` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { getFeatureFlags } from "../feature-flags-api.js";

const prevDb = process.env.USE_DB_DEALERS;
const prevShadow = process.env.SHADOW_DIFF_ENABLED;
const prevKpi = process.env.USE_SERVER_KPI_AGGREGATES;
const prevTpNoWriteback = process.env.TP_HYDRATION_NO_WRITEBACK;
const prevDistributionDbPrimary = process.env.DISTRIBUTION_DB_PRIMARY_CAPACITY;
const prevCatalogLazy = process.env.CATALOG_LAZY_LOAD;

try {
  process.env.USE_DB_DEALERS = "true";
  process.env.SHADOW_DIFF_ENABLED = "false";
  process.env.USE_SERVER_KPI_AGGREGATES = "true";
  process.env.TP_HYDRATION_NO_WRITEBACK = "true";
  process.env.DISTRIBUTION_DB_PRIMARY_CAPACITY = "true";
  process.env.CATALOG_LAZY_LOAD = "true";
  const on = getFeatureFlags();
  assert.equal(on.flags.USE_DB_DEALERS, true);
  assert.equal(on.flags.SHADOW_DIFF_ENABLED, false);
  assert.equal(on.flags.USE_SERVER_KPI_AGGREGATES, true);
  assert.equal(on.flags.TP_HYDRATION_NO_WRITEBACK, true);
  assert.equal(on.flags.DISTRIBUTION_DB_PRIMARY_CAPACITY, true);
  assert.equal(on.flags.CATALOG_LAZY_LOAD, true);

  process.env.USE_DB_DEALERS = "false";
  process.env.USE_SERVER_KPI_AGGREGATES = "false";
  process.env.TP_HYDRATION_NO_WRITEBACK = "false";
  process.env.DISTRIBUTION_DB_PRIMARY_CAPACITY = "false";
  process.env.CATALOG_LAZY_LOAD = "false";
  const off = getFeatureFlags();
  assert.equal(off.flags.USE_DB_DEALERS, false);
  assert.equal(off.flags.USE_SERVER_KPI_AGGREGATES, false);
  assert.equal(off.flags.TP_HYDRATION_NO_WRITEBACK, false);
  assert.equal(off.flags.DISTRIBUTION_DB_PRIMARY_CAPACITY, false);
  assert.equal(off.flags.CATALOG_LAZY_LOAD, false);
} finally {
  if (prevDb === undefined) delete process.env.USE_DB_DEALERS;
  else process.env.USE_DB_DEALERS = prevDb;
  if (prevShadow === undefined) delete process.env.SHADOW_DIFF_ENABLED;
  else process.env.SHADOW_DIFF_ENABLED = prevShadow;
  if (prevKpi === undefined) delete process.env.USE_SERVER_KPI_AGGREGATES;
  else process.env.USE_SERVER_KPI_AGGREGATES = prevKpi;
  if (prevTpNoWriteback === undefined) delete process.env.TP_HYDRATION_NO_WRITEBACK;
  else process.env.TP_HYDRATION_NO_WRITEBACK = prevTpNoWriteback;
  if (prevDistributionDbPrimary === undefined) delete process.env.DISTRIBUTION_DB_PRIMARY_CAPACITY;
  else process.env.DISTRIBUTION_DB_PRIMARY_CAPACITY = prevDistributionDbPrimary;
  if (prevCatalogLazy === undefined) delete process.env.CATALOG_LAZY_LOAD;
  else process.env.CATALOG_LAZY_LOAD = prevCatalogLazy;
}

console.log("feature-flags-api.test.ts: ok");
