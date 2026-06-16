/**
 * Запуск: `npm run test:dealer-base-source` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { DEALER_BASE_ROWS } from "../dealer-base-mock-data";
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

const API_DEALER = {
  ...DEALER_BASE_ROWS[0]!,
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

// USE_DB_DEALERS=false → seed
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
    assert.equal(rows, DEALER_BASE_ROWS);
    assert.equal(rows.length, DEALER_BASE_ROWS.length);
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

// USE_DB_DEALERS=true + API failure → seed fallback
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
    assert.equal(rows, DEALER_BASE_ROWS);
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
  const sample = DEALER_BASE_ROWS.filter((r) => r.releaseCode).slice(0, 3);
  const codes = sample.map((r) => r.releaseCode!);
  const filtered = filterDealerRowsByVisibleCodes(DEALER_BASE_ROWS, codes);
  assert.ok(filtered.length >= sample.length);
  for (const row of filtered) {
    assert.ok(row.releaseCode && codes.includes(row.releaseCode));
  }
  const visible = getVisibleDealerRows(DEALER_BASE_ROWS, false, codes);
  assert.deepEqual(visible.map((r) => r.id).sort(), filtered.map((r) => r.id).sort());
  assert.equal(getVisibleDealerRows(DEALER_BASE_ROWS, true, codes).length, DEALER_BASE_ROWS.length);
}

console.log("dealer-base-source.test.ts: ok");
