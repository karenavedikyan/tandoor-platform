/**
 * Запуск: `npm run test:showcase-matrix-list-scope` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  handleShowcaseMatrixHistory,
  handleShowcaseMatrixList,
  type ShowcaseVisibility,
} from "../showcase-matrix-handlers.js";

type PoolLike = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

const TP = "client-MA001-01";
const DEALER_A = "client-MA001";
const DEALER_B = "client-MA002";
const DEALER_RM = "client-MA-MA119856";

function entryRow(dealerId: string, targetId = "m1") {
  return {
    id: `e-${dealerId}-${targetId}`,
    dealer_id: dealerId,
    trade_point_id: TP,
    target_kind: "model",
    target_id: targetId,
    status: "planned",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function eventRow(dealerId: string | null, targetId = "m1") {
  return {
    id: `ev-${dealerId ?? "none"}-${targetId}`,
    dealer_id: dealerId,
    trade_point_id: TP,
    target_kind: "model",
    target_id: targetId,
    changed_at: "2026-01-01T00:00:00.000Z",
  };
}

function listPool(): PoolLike {
  return {
    query: async (sql: string) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM showcase_matrix_entries")) {
        return {
          rows: [entryRow(DEALER_A), entryRow(DEALER_B), entryRow(DEALER_RM)],
        };
      }
      throw new Error(`unexpected sql: ${s}`);
    },
  };
}

function historyPool(): PoolLike {
  return {
    query: async (sql: string) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM showcase_matrix_events")) {
        return {
          rows: [
            eventRow(DEALER_A),
            eventRow(DEALER_B),
            eventRow(DEALER_RM),
            eventRow(null),
          ],
        };
      }
      throw new Error(`unexpected sql: ${s}`);
    },
  };
}

const unrestricted: ShowcaseVisibility = { unrestricted: true };

function visCodes(...codes: string[]): ShowcaseVisibility {
  return { unrestricted: false, visibleCodes: new Set(codes) };
}

async function expectList(vis: ShowcaseVisibility, expectedDealers: string[]) {
  const pool = listPool();
  const { entries } = await handleShowcaseMatrixList(pool, { tradePointId: TP }, vis);
  assert.deepEqual(
    entries.map((e) => e.dealerId).sort(),
    expectedDealers.sort(),
  );
}

async function expectHistory(vis: ShowcaseVisibility, expectedDealers: string[]) {
  const pool = historyPool();
  const { events } = await handleShowcaseMatrixHistory(pool, { tradePointId: TP }, vis);
  assert.deepEqual(
    events.map((e) => e.dealerId).sort(),
    expectedDealers.sort(),
  );
}

// handleShowcaseMatrixList
{
  await expectList(unrestricted, [DEALER_A, DEALER_B, DEALER_RM]);
  console.log("list: unrestricted roles");
}

for (const role of ["admin", "director", "analyst", "marketer", "category_manager"] as const) {
  void role;
  await expectList(unrestricted, [DEALER_A, DEALER_B, DEALER_RM]);
}
console.log("list: admin/director/analyst/marketer/category_manager");

{
  await expectList(visCodes(), []);
  console.log("list: manager empty ownCodes");
}

{
  await expectList(visCodes("MA001"), [DEALER_A]);
  console.log("list: manager ownCodes MA001");
}

{
  await expectList(visCodes("MA001", "MA002"), [DEALER_A, DEALER_B]);
  console.log("list: rop teamCodes MA001,MA002");
}

{
  await expectList(visCodes("MA-MA119856"), [DEALER_RM]);
  console.log("list: regional_manager ownCodes MA-MA119856");
}

// handleShowcaseMatrixHistory
{
  await expectHistory(unrestricted, [DEALER_A, DEALER_B, DEALER_RM, "null"]);
  console.log("history: unrestricted");
}

{
  await expectHistory(visCodes(), []);
  console.log("history: manager empty ownCodes");
}

{
  await expectHistory(visCodes("MA001"), [DEALER_A]);
  console.log("history: manager ownCodes MA001");
}

{
  await expectHistory(visCodes("MA001", "MA002"), [DEALER_A, DEALER_B]);
  console.log("history: rop teamCodes");
}

{
  await expectHistory(visCodes("MA-MA119856"), [DEALER_RM]);
  console.log("history: regional_manager");
}

{
  const pool = historyPool();
  const { events } = await handleShowcaseMatrixHistory(pool, { tradePointId: TP }, visCodes("MA001"));
  assert.ok(!events.some((e) => e.dealerId === "null" || !e.dealerId?.trim()));
  console.log("history: event without dealer_id excluded for restricted role");
}

console.log("showcase-matrix-list-scope: ok");
