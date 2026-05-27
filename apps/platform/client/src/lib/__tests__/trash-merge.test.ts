/**
 * Запуск: `npm run test:trash-merge` из каталога apps/platform.
 *
 * Проверяет, что mergeActualizationStatesForActivityDashboard корректно объединяет
 * `trashedDealersById` и `trashedTradePointsById` из двух scope'ов, выбирая запись
 * с более поздним `trashedAt`.
 */
import assert from "node:assert/strict";
import { createEmptyActualizationState } from "../client-base-actualization-state";
import { mergeActualizationStatesForActivityDashboard } from "../client-base-actualization-team-state-merge";

const baseDealer = {
  dealerId: "D1",
  trashedBy: "u1",
  trashedByName: "Менеджер",
  expiresAt: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
  source: "client_bulk_delete" as const,
  snapshot: { fullName: "Михеенко", city: "Луганск", inn: null, dealerCode: null, legalEntityName: null },
};

const stateA = (() => {
  const s = createEmptyActualizationState();
  s.trashedDealersById = {
    D1: { ...baseDealer, trashedAt: new Date(Date.now() - 5000).toISOString(), trashedByName: "OLD" },
  };
  return s;
})();

const stateB = (() => {
  const s = createEmptyActualizationState();
  s.trashedDealersById = {
    D1: { ...baseDealer, trashedAt: new Date(Date.now() - 1000).toISOString(), trashedByName: "NEW" },
    D2: { ...baseDealer, dealerId: "D2", trashedAt: new Date(Date.now() - 2000).toISOString(), trashedByName: "ONLY_IN_B" },
  };
  return s;
})();

// G3.1: pickNewer выбирает позднюю запись D1, и D2 из B пробрасывается.
{
  const merged = mergeActualizationStatesForActivityDashboard([
    { userId: "u1", state: stateA },
    { userId: "u2", state: stateB },
  ]);
  assert.equal(merged.trashedDealersById.D1?.trashedByName, "NEW", "G3.1: позднее обновление D1 выбрано");
  assert.equal(merged.trashedDealersById.D2?.trashedByName, "ONLY_IN_B", "G3.1: уникальная запись D2 пробрасывается");
}

// G3.2: порядок sources не важен — результат тот же.
{
  const merged = mergeActualizationStatesForActivityDashboard([
    { userId: "u2", state: stateB },
    { userId: "u1", state: stateA },
  ]);
  assert.equal(merged.trashedDealersById.D1?.trashedByName, "NEW", "G3.2: порядок не важен");
}

console.log("trash-merge: ok (2 cases)");
