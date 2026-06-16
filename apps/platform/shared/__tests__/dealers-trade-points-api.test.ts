/**
 * Запуск: `npm run test:dealers-trade-points-api` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { getReleaseClients } from "../../client/src/lib/release-client-data.js";
import {
  buildAllDealerSeedBundles,
  countExpectedTradePointsFromRelease,
  dealerExternalKey,
} from "../dealers-seed-logic.js";
import type { PoolLike } from "../admin/admin-auth.js";
import {
  handleDealersTradePointsList,
  handleDealersTradePointsSummary,
  countDealersAndTradePoints,
} from "../dealers-trade-points-handlers.js";

// --- seed logic ---

{
  const bundles = buildAllDealerSeedBundles();
  assert.ok(bundles.length >= getReleaseClients().length, "bundles >= release clients");
  assert.ok(countExpectedTradePointsFromRelease() > 0, "expected trade points > 0");
}

{
  const sample = getReleaseClients()[0];
  assert.ok(sample, "sample client exists");
  const key = dealerExternalKey(sample);
  assert.equal(key, sample.id, "dealer external key = ReleaseClient.id");
  const bundle = buildAllDealerSeedBundles().find((b) => b.dealer.externalKey === key);
  assert.ok(bundle, "bundle for sample client");
  for (const tp of bundle!.tradePoints) {
    assert.ok(tp.externalKey.startsWith(`${key}-`), "tp key prefix matches dealer id");
  }
}

// --- handler mocks ---

type MockRule = {
  match: (sql: string, params?: unknown[]) => boolean;
  rows: Record<string, unknown>[];
};

function mockPool(rules: MockRule[]): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      for (const rule of rules) {
        if (rule.match(s, params)) return { rows: rule.rows };
      }
      return { rows: [] };
    },
  };
}

const SAMPLE_DEALER_ROW = {
  external_key: "client-ma-ma129050",
  name: "Богачёв Денис",
  release_code: "MA-MA129050",
  city: "Воронеж",
  region: "Купянский Родион",
  client_type: "top150",
  client_category: "top150",
  status: "активный",
  format: "одиночный",
  is_active: true,
  is_priority: true,
  is_closed: false,
  legal_entity: "Богачёв Денис",
  holding: "—",
  comment: "",
  manager_name: "Бойко Екатерина",
  release_address: "addr",
  client_type_label: "ТОП 150",
  release_team_id: "team-kupiansky",
  release_manager_id: "mgr-boyko-em",
};

const SAMPLE_TP_ROW = {
  external_key: "client-ma-ma129050-01",
  dealer_external_key: "client-ma-ma129050",
  name: "Торговая точка · Воронеж",
  city: "Воронеж",
  address: "addr",
  format: "Розница / салон",
  is_active: true,
  importance_tier: "vip",
};

{
  const pool = mockPool([
    {
      match: (s) => s.includes("FROM dealers d") && s.includes("ORDER BY d.name"),
      rows: [SAMPLE_DEALER_ROW],
    },
    {
      match: (s) => s.includes("FROM trade_points tp"),
      rows: [SAMPLE_TP_ROW],
    },
  ]);
  const list = await handleDealersTradePointsList(pool, {});
  assert.equal(list.success, true);
  assert.ok(list.dealers.length > 0, "GET list returns non-empty");
  assert.equal(list.dealers[0]?.id, "client-ma-ma129050");
  assert.equal(list.dealers[0]?.tradePoints[0]?.id, "client-ma-ma129050-01");
}

{
  const pool = mockPool([
    {
      match: (s, params) =>
        s.includes("FROM dealers d") && s.includes("release_team_id") && params?.[0] === "team-kupiansky",
      rows: [SAMPLE_DEALER_ROW],
    },
    {
      match: (s) => s.includes("FROM trade_points tp"),
      rows: [SAMPLE_TP_ROW],
    },
  ]);
  const list = await handleDealersTradePointsList(pool, { teamId: "team-kupiansky" });
  assert.equal(list.dealers.length, 1);
  assert.equal(list.dealers[0]?.releaseTeamId, "team-kupiansky");
}

{
  const pool = mockPool([
    {
      match: (s, params) =>
        s.includes("COUNT(*)") && s.includes("FROM dealers") && params?.[0] === "team-kupiansky",
      rows: [{ total: "1", active: "1", priority: "1", closed: "0", unknown_type: "0" }],
    },
  ]);
  const summary = await handleDealersTradePointsSummary(pool, { teamId: "team-kupiansky" });
  assert.equal(summary.summary.total, 1);
}

{
  const pool = mockPool([
    {
      match: (s) => s.includes("COUNT(*)::text AS c FROM dealers"),
      rows: [{ c: String(getReleaseClients().length) }],
    },
    {
      match: (s) => s.includes("COUNT(*)::text AS c FROM trade_points"),
      rows: [{ c: String(countExpectedTradePointsFromRelease()) }],
    },
  ]);
  const counts = await countDealersAndTradePoints(pool);
  assert.ok(counts.dealers >= getReleaseClients().length);
  assert.ok(counts.tradePoints > 0);
}

console.log("dealers-trade-points-api.test.ts: ok");
