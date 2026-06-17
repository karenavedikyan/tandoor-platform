/**
 * Запуск: `npm run test:perf-summary` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../admin/admin-auth.js";
import { buildPerfSummary, canAccessPerfSummary, parsePerfRangeDays } from "../web-vitals-handlers.js";
import { getCached, resetApiLruCache, setCached } from "../api-lru-cache.js";

resetApiLruCache();

assert.equal(parsePerfRangeDays("7d"), 7);
assert.equal(parsePerfRangeDays("1d"), 1);
assert.equal(parsePerfRangeDays(undefined), 7);

assert.equal(canAccessPerfSummary("admin"), true);
assert.equal(canAccessPerfSummary("director"), true);
assert.equal(canAccessPerfSummary("rop"), false);
assert.equal(canAccessPerfSummary("manager"), false);

const now = Date.now();
const pool: PoolLike = {
  query: async (sql: string) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.includes("PERCENTILE_DISC") && s.includes("GROUP BY pathname")) {
      return {
        rows: [
          { pathname: "/catalog", events: 178, p75_lcp: 2150, p75_inp: 180 },
          { pathname: "/dealer-base", events: 245, p75_lcp: 1850, p75_inp: 120 },
        ],
      };
    }
    if (s.includes("GROUP BY 1") && s.includes("to_char")) {
      return {
        rows: [
          { day: "2026-06-11", p75_lcp: 2200, p75_lcp_mobile: 2600, p75_lcp_desktop: 1900 },
          { day: "2026-06-12", p75_lcp: 2100, p75_lcp_mobile: 2400, p75_lcp_desktop: 1850 },
        ],
      };
    }
    if (s.includes("COALESCE(NULLIF(role")) {
      return {
        rows: [
          { role: "admin", events: 120, p75_lcp: 1700 },
          { role: "manager", events: 300, p75_lcp: 2300 },
        ],
      };
    }
    if (s.includes("COUNT(*)::int AS events") && s.includes("FROM web_vitals_events")) {
      return {
        rows: [
          {
            p50_lcp: 1500,
            p75_lcp: 2100,
            p95_lcp: 3500,
            p75_inp: 150,
            p75_cls: 0.05,
            events: 1284,
          },
        ],
      };
    }
    return { rows: [] };
  },
};

const summary = await buildPerfSummary(pool, 7);
assert.equal(summary.overall.p75_lcp, 2100);
assert.equal(summary.overall.events, 1284);
assert.equal(summary.by_pathname.length, 2);
assert.equal(summary.by_pathname[0]?.pathname, "/catalog");
assert.equal(summary.by_role.length, 2);
assert.equal(summary.trend.length, 2);
assert.ok(summary.budget_violations.length >= 0);

const cacheKey = "perf-summary:test";
setCached(cacheKey, summary, 60_000);
assert.ok(getCached(cacheKey));

console.log("perf-summary: ok");
