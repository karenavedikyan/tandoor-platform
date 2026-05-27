/**
 * Запуск: `npm run test:trash-purge` из каталога apps/platform.
 *
 * Проверяет cron-чистку просроченной корзины (E1):
 *   - запись с expiresAt < now удаляется;
 *   - запись с expiresAt в будущем остаётся;
 *   - то же для tradePoints.
 */
import assert from "node:assert/strict";
import { purgeExpiredTrash } from "../../../../shared/actualization-trash";

const now = Date.now();
const yesterdayIso = new Date(now - 24 * 3600 * 1000).toISOString();
const fiveDaysIso = new Date(now + 5 * 24 * 3600 * 1000).toISOString();

const sampleDealer = (dealerId: string, expIso: string) => ({
  dealerId,
  trashedAt: new Date(now - 7 * 24 * 3600 * 1000).toISOString(),
  trashedBy: "u1",
  trashedByName: "Менеджер",
  expiresAt: expIso,
  source: "client_bulk_delete",
  snapshot: { fullName: dealerId, city: null, inn: null, dealerCode: null, legalEntityName: null },
});
const sampleTp = (tradePointId: string, expIso: string) => ({
  tradePointId,
  dealerId: "D1",
  trashedAt: new Date(now - 7 * 24 * 3600 * 1000).toISOString(),
  trashedBy: "u1",
  trashedByName: "Менеджер",
  expiresAt: expIso,
  source: "client_bulk_delete",
  snapshot: { name: tradePointId, address: null, city: null, tradePointCode: null, dealerFullName: null },
});

// G2.1: D1 (expiresAt вчера) → удалён, D2 (через 5 дней) → остался.
{
  const state: Record<string, unknown> = {
    trashedDealersById: { D1: sampleDealer("D1", yesterdayIso), D2: sampleDealer("D2", fiveDaysIso) },
    trashedTradePointsById: {},
  };
  const r = purgeExpiredTrash(state, now);
  assert.equal(r.purgedDealers, 1, "G2.1: purgedDealers=1");
  assert.equal(r.purgedTradePoints, 0, "G2.1: purgedTradePoints=0");
  assert.equal(r.changed, true, "G2.1: changed=true");
  const dealers = state.trashedDealersById as Record<string, unknown>;
  assert.ok(dealers.D2, "G2.1: D2 остался");
  assert.ok(!dealers.D1, "G2.1: D1 удалён");
}

// G2.2: тестируем tradePoints
{
  const state: Record<string, unknown> = {
    trashedDealersById: {},
    trashedTradePointsById: { T1: sampleTp("T1", yesterdayIso), T2: sampleTp("T2", fiveDaysIso) },
  };
  const r = purgeExpiredTrash(state, now);
  assert.equal(r.purgedDealers, 0, "G2.2: purgedDealers=0");
  assert.equal(r.purgedTradePoints, 1, "G2.2: purgedTradePoints=1");
  const tps = state.trashedTradePointsById as Record<string, unknown>;
  assert.ok(tps.T2, "G2.2: T2 остался");
  assert.ok(!tps.T1, "G2.2: T1 удалён");
}

// G2.3: пустой state не падает, ничего не меняет.
{
  const state: Record<string, unknown> = {};
  const r = purgeExpiredTrash(state, now);
  assert.equal(r.changed, false, "G2.3: changed=false для пустого state");
  assert.equal(r.purgedDealers, 0, "G2.3");
  assert.equal(r.purgedTradePoints, 0, "G2.3");
  assert.deepEqual(state.trashedDealersById, {}, "G2.3: trashedDealersById создан как {}");
  assert.deepEqual(state.trashedTradePointsById, {}, "G2.3: trashedTradePointsById создан как {}");
}

// G2.4: запись без expiresAt не удаляется (защита от мусорных данных).
{
  const state: Record<string, unknown> = {
    trashedDealersById: { D1: { dealerId: "D1" } as unknown as Record<string, unknown> },
    trashedTradePointsById: {},
  };
  const r = purgeExpiredTrash(state, now);
  assert.equal(r.purgedDealers, 0, "G2.4: запись без expiresAt пропущена");
}

console.log("trash-purge: ok (4 cases)");
