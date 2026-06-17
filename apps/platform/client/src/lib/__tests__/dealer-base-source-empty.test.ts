import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchDealerBaseRows, resetDealerBaseSourceCache } from "../dealer-base-source";

// Mock fetch для USE_DB_DEALERS=true + пустой ответ /api/dealers-trade-points
test("пустая БД → пустой массив, без падения", async () => {
  resetDealerBaseSourceCache();
  global.fetch = (async (url: string) => {
    if (url.includes("feature-flags")) {
      return new Response(JSON.stringify({ flags: { USE_DB_DEALERS: true } }), { status: 200 });
    }
    if (url.includes("dealers-trade-points")) {
      return new Response(JSON.stringify({ success: true, dealers: [] }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const rows = await fetchDealerBaseRows();
  assert.equal(Array.isArray(rows), true);
  assert.equal(rows.length, 0);
});

test("ошибка БД → пустой массив, без падения и без фоллбэка на хардкод", async () => {
  resetDealerBaseSourceCache();
  global.fetch = (async (url: string) => {
    if (url.includes("feature-flags")) {
      return new Response(JSON.stringify({ flags: { USE_DB_DEALERS: true } }), { status: 200 });
    }
    if (url.includes("dealers-trade-points")) {
      return new Response("{}", { status: 500 });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const rows = await fetchDealerBaseRows();
  assert.equal(Array.isArray(rows), true);
  assert.equal(rows.length, 0);
});

console.log("dealer-base-source-empty: ok");
