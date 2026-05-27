/**
 * Запуск: `npm run test:trash-protection` из каталога apps/platform.
 *
 * Проверяет защиту корзины от случайной потери (B1):
 *   - prev есть, next пуст, unTrash=null → запись восстанавливается;
 *   - prev есть, next пуст, unTrash содержит ключ → запись удаляется (явное «Восстановить»/«Удалить»);
 *   - то же для trashedTradePointsById.
 */
import assert from "node:assert/strict";
import { applyTrashProtection } from "../../../../shared/actualization-trash";

const futureIso = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
const sampleDealer = {
  dealerId: "D1",
  trashedAt: new Date(Date.now() - 1000).toISOString(),
  trashedBy: "u1",
  trashedByName: "Бойко Е.",
  expiresAt: futureIso,
  source: "client_bulk_delete",
  snapshot: { fullName: "Михеенко", city: "Луганск", inn: null, dealerCode: null, legalEntityName: null },
};
const sampleTp = {
  tradePointId: "T1",
  dealerId: "D1",
  trashedAt: new Date(Date.now() - 1000).toISOString(),
  trashedBy: "u1",
  trashedByName: "Бойко Е.",
  expiresAt: futureIso,
  source: "client_bulk_delete",
  snapshot: { name: "Магазин 1", address: null, city: "Луганск", tradePointCode: null, dealerFullName: "Михеенко" },
};

// G1.1: prev есть, next пуст, unTrash=null → восстановлен.
{
  const prev = { trashedDealersById: { D1: sampleDealer }, trashedTradePointsById: {} };
  const next = { trashedDealersById: {}, trashedTradePointsById: {} };
  const r = applyTrashProtection(prev, next, null);
  assert.equal(r.protectedDealers, 1, "G1.1: protectedDealers=1");
  assert.equal(r.protectedTradePoints, 0, "G1.1: protectedTradePoints=0");
  assert.deepEqual(next.trashedDealersById, { D1: sampleDealer }, "G1.1: dealer восстановлен");
}

// G1.2: prev есть, next пуст, unTrash.dealers=['D1'] → удалён (явное действие).
{
  const prev = { trashedDealersById: { D1: sampleDealer }, trashedTradePointsById: {} };
  const next = { trashedDealersById: {}, trashedTradePointsById: {} };
  const r = applyTrashProtection(prev, next, { dealers: ["D1"] });
  assert.equal(r.protectedDealers, 0, "G1.2: protectedDealers=0");
  assert.deepEqual(next.trashedDealersById, {}, "G1.2: dealer удалён по явному unTrash");
}

// G1.3a: prev tp есть, next tp пуст, unTrash=null → tp восстановлен.
{
  const prev = { trashedDealersById: {}, trashedTradePointsById: { T1: sampleTp } };
  const next = { trashedDealersById: {}, trashedTradePointsById: {} };
  const r = applyTrashProtection(prev, next, null);
  assert.equal(r.protectedTradePoints, 1, "G1.3a: protectedTradePoints=1");
  assert.deepEqual(next.trashedTradePointsById, { T1: sampleTp }, "G1.3a: tp восстановлен");
}

// G1.3b: prev tp есть, next tp пуст, unTrash.tradePoints=['T1'] → удалён.
{
  const prev = { trashedDealersById: {}, trashedTradePointsById: { T1: sampleTp } };
  const next = { trashedDealersById: {}, trashedTradePointsById: {} };
  const r = applyTrashProtection(prev, next, { tradePoints: ["T1"] });
  assert.equal(r.protectedTradePoints, 0, "G1.3b: protectedTradePoints=0");
  assert.deepEqual(next.trashedTradePointsById, {}, "G1.3b: tp удалён по явному unTrash");
}

// G1.4: prev null/пустой — никаких восстановлений, ошибок не бросает.
{
  const next = { trashedDealersById: {}, trashedTradePointsById: {} };
  const r = applyTrashProtection(null, next, null);
  assert.equal(r.protectedDealers, 0, "G1.4: protectedDealers=0 на пустом prev");
  assert.equal(r.protectedTradePoints, 0, "G1.4: protectedTradePoints=0 на пустом prev");
}

// G1.5: next с уже существующим ключом — не перезаписывается prev'ом.
{
  const prev = { trashedDealersById: { D1: { ...sampleDealer, trashedByName: "OLD" } } };
  const next = { trashedDealersById: { D1: { ...sampleDealer, trashedByName: "NEW" } } };
  const r = applyTrashProtection(prev, next, null);
  assert.equal(r.protectedDealers, 0, "G1.5: запись не восстанавливалась (уже есть)");
  assert.equal((next.trashedDealersById as Record<string, { trashedByName: string }>).D1.trashedByName, "NEW", "G1.5: next не затёрся prev'ом");
}

console.log("trash-protection: ok (5 cases)");
