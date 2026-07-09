/**
 * Запуск: npm run test:distribution-analytics-source
 */
import assert from "node:assert/strict";
import {
  readDistributionAnalyticsSourceFromHash,
  resolveDistributionAnalyticsSource,
  resolveDistributionEntrySource,
} from "../distribution-analytics/distribution-analytics-source.js";

assert.equal(resolveDistributionAnalyticsSource("manager"), "one-c");
assert.equal(resolveDistributionAnalyticsSource("director"), "one-c");
assert.equal(resolveDistributionAnalyticsSource("admin"), "one-c");
assert.equal(resolveDistributionEntrySource("manager"), "one-c");
assert.equal(
  resolveDistributionEntrySource("admin", new URLSearchParams("source=legacy")),
  "legacy",
);
assert.equal(
  resolveDistributionAnalyticsSource("admin", new URLSearchParams("source=legacy")),
  "legacy",
);
assert.equal(
  resolveDistributionAnalyticsSource("admin", new URLSearchParams("source=one-c")),
  "one-c",
);

const qs = readDistributionAnalyticsSourceFromHash("#/distribution?source=legacy&tab=trade-points");
assert.equal(qs.get("source"), "legacy");
assert.equal(qs.get("tab"), "trade-points");

console.log("✓ distribution-analytics-source tests passed");
