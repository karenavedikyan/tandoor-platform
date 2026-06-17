/**
 * Запуск: `npm run test:dealer-base-source` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data";
import {
  fetchDealerBaseRows,
  filterDealerRowsByVisibleCodes,
  getCatalogDealerById,
  getCatalogDealerRows,
  getVisibleDealerRows,
  resetDealerBaseSourceCache,
  setDealerBaseRowsCache,
  shouldUseDbDealers,
} from "../dealer-base-source";

const FIXTURES: DealerRow[] = [
  {
    id: "fix-001",
    name: "Alpha Dealer",
    releaseCode: "RC001",
    releaseTeamId: "team-a",
    city: "Москва",
    clientCategory: "top150",
    status: "active",
    tradePoints: [],
  } as DealerRow,
  {
    id: "fix-002",
    name: "Beta Dealer",
    releaseCode: "RC002",
    releaseTeamId: "team-b",
    city: "СПб",
    clientCategory: "top350",
    status: "active",
    tradePoints: [],
  } as DealerRow,
  {
    id: "fix-003",
    name: "Gamma Dealer",
    releaseCode: "RC003",
    releaseTeamId: "team-a",
    city: "Казань",
    clientCategory: "new_client",
    status: "active",
    tradePoints: [],
  } as DealerRow,
  {
    id: "fix-004",
    name: "No Code Dealer",
    releaseTeamId: "team-a",
    city: "Тула",
    clientCategory: "new_client",
    status: "active",
    tradePoints: [],
  } as DealerRow,
];

const API_DEALER: DealerRow = {
  ...FIXTURES[0]!,
  id: "api-001",
  name: "API Dealer",
};

function withMockFetch(impl: (url: string) => unknown | null, fn: () => void | Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = impl(url);
    if (body === null) {
      return new Response("error", { status: 500 });
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return Promise.resolve(fn()).finally(() => {
    globalThis.fetch = original;
    resetDealerBaseSourceCache();
  });
}

// USE_DB_DEALERS=false → пустой массив (без хардкода)
await withMockFetch(
  (url) => {
    if (url.includes("/api/config/feature-flags")) {
      return { success: true, flags: { USE_DB_DEALERS: false } };
    }
    return null;
  },
  async () => {
    assert.equal(await shouldUseDbDealers(), false);
    const rows = await fetchDealerBaseRows();
    assert.deepEqual(rows, []);
  },
);

// USE_DB_DEALERS=true + API success → API rows
await withMockFetch(
  (url) => {
    if (url.includes("/api/config/feature-flags")) {
      return { success: true, flags: { USE_DB_DEALERS: true } };
    }
    if (url.includes("/api/dealers-trade-points/list")) {
      return { success: true, dealers: [API_DEALER], meta: { source: "db" } };
    }
    return null;
  },
  async () => {
    const rows = await fetchDealerBaseRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "api-001");
    assert.equal(rows[0]?.name, "API Dealer");
  },
);

// USE_DB_DEALERS=true + API failure → пустой массив (без хардкода)
await withMockFetch(
  (url) => {
    if (url.includes("/api/config/feature-flags")) {
      return { success: true, flags: { USE_DB_DEALERS: true } };
    }
    if (url.includes("/api/dealers-trade-points/list")) {
      return null;
    }
    return null;
  },
  async () => {
    const rows = await fetchDealerBaseRows();
    assert.deepEqual(rows, []);
  },
);

// sync cache + lookup
{
  resetDealerBaseSourceCache();
  setDealerBaseRowsCache([API_DEALER]);
  assert.equal(getCatalogDealerRows()[0]?.id, "api-001");
  assert.equal(getCatalogDealerById("api-001")?.name, "API Dealer");
  resetDealerBaseSourceCache();
}

// visible codes filter
{
  const codes = ["RC001", "RC002"];
  const filtered = filterDealerRowsByVisibleCodes(FIXTURES, codes);
  assert.equal(filtered.length, 2);
  for (const row of filtered) {
    assert.ok(row.releaseCode && codes.includes(row.releaseCode));
  }
  const visible = getVisibleDealerRows(FIXTURES, false, codes);
  assert.deepEqual(visible.map((r) => r.id).sort(), filtered.map((r) => r.id).sort());
  assert.equal(getVisibleDealerRows(FIXTURES, true, codes).length, FIXTURES.length);
}

console.log("dealer-base-source.test.ts: ok");
