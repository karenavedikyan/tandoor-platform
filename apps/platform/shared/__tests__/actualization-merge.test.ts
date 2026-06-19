/**
 * Запуск: `npm run test:actualization-merge` из каталога apps/platform.
 *
 * Промт 331: defensive merge manager-only id-словарей при stale POST.
 */
import assert from "node:assert/strict";
import {
  MANAGER_ID_DICT_FIELDS,
  applyStaleStateMerge,
  isStaleActualizationSnapshot,
} from "../actualization-merge";

// 1. Восстанавливает ключи archivedLegalEntitiesById, отсутствующие в next, но имеющиеся в prev.
{
  const prev = {
    updatedAt: "2026-06-12T10:00:00.000Z",
    archivedLegalEntitiesById: {
      "le-X": { legalEntityId: "le-X", archivedAt: "2026-06-10T00:00:00.000Z" },
      "le-Y": { legalEntityId: "le-Y", archivedAt: "2026-06-11T00:00:00.000Z" },
    },
  };
  const next: Record<string, unknown> = { archivedLegalEntitiesById: { "le-Z": { legalEntityId: "le-Z" } } };
  const r = applyStaleStateMerge(prev, next);
  assert.deepEqual(next.archivedLegalEntitiesById, {
    "le-Z": { legalEntityId: "le-Z" },
    "le-X": { legalEntityId: "le-X", archivedAt: "2026-06-10T00:00:00.000Z" },
    "le-Y": { legalEntityId: "le-Y", archivedAt: "2026-06-11T00:00:00.000Z" },
  });
  assert.equal(r.recoveredByField.archivedLegalEntitiesById, 2);
  assert.equal(r.totalRecovered, 2);
}

// 2. Не трогает ключи, явно присутствующие в next (даже если значение другое).
{
  const prev = {
    dealerOverridesById: {
      D1: { dealerId: "D1", fields: { city: "Старый" } },
    },
  };
  const next: Record<string, unknown> = {
    dealerOverridesById: {
      D1: { dealerId: "D1", fields: { city: "Новый" } },
    },
  };
  const r = applyStaleStateMerge(prev, next);
  assert.deepEqual(next.dealerOverridesById, {
    D1: { dealerId: "D1", fields: { city: "Новый" } },
  });
  assert.equal(r.totalRecovered, 0);
}

// 3. Корректно обрабатывает все поля из MANAGER_ID_DICT_FIELDS.
{
  assert.equal(MANAGER_ID_DICT_FIELDS.length, 13);
  const prev: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  for (const field of MANAGER_ID_DICT_FIELDS) {
    prev[field] = { [`key-${field}`]: { id: field } };
    next[field] = {};
  }
  const r = applyStaleStateMerge(prev, next);
  for (const field of MANAGER_ID_DICT_FIELDS) {
    const dict = next[field] as Record<string, unknown>;
    assert.ok(dict[`key-${field}`], `${field}: ключ восстановлен`);
    assert.equal(r.recoveredByField[field], 1, `${field}: recovered=1`);
  }
  assert.equal(r.totalRecovered, 13);
}

// 4. Возвращает корректные счётчики recoveredByField и totalRecovered.
{
  const prev = {
    archivedLegalEntitiesById: { A: 1, B: 2 },
    dealerOverridesById: { C: 3 },
    tradePointOverridesById: { T1: 4, T2: 5, T3: 6 },
  };
  const next: Record<string, unknown> = {
    archivedLegalEntitiesById: { A: 99 },
    dealerOverridesById: {},
    tradePointOverridesById: { T2: 55 },
  };
  const r = applyStaleStateMerge(prev, next);
  assert.equal(r.recoveredByField.archivedLegalEntitiesById, 1, "только B восстановлен");
  assert.equal(r.recoveredByField.dealerOverridesById, 1, "C восстановлен");
  assert.equal(r.recoveredByField.tradePointOverridesById, 2, "T1 и T3 восстановлены");
  assert.equal(r.totalRecovered, 4);
}

// 5. prevState == null — nextState без изменений, нулевые счётчики.
{
  const next: Record<string, unknown> = { archivedLegalEntitiesById: {} };
  const r = applyStaleStateMerge(null, next);
  assert.deepEqual(next, { archivedLegalEntitiesById: {} });
  assert.deepEqual(r.recoveredByField, {});
  assert.equal(r.totalRecovered, 0);
}

// isStaleActualizationSnapshot — вспомогательные проверки.
{
  assert.equal(
    isStaleActualizationSnapshot({ updatedAt: "2026-06-12T00:00:00.000Z" }, "2026-06-10T00:00:00.000Z"),
    true,
  );
  assert.equal(
    isStaleActualizationSnapshot({ updatedAt: "2026-06-10T00:00:00.000Z" }, "2026-06-12T00:00:00.000Z"),
    false,
  );
  assert.equal(isStaleActualizationSnapshot({ updatedAt: "2026-06-12T00:00:00.000Z" }, null), false);
  assert.equal(isStaleActualizationSnapshot(null, "2026-06-10T00:00:00.000Z"), false);
}

console.log("actualization-merge: ok (5 cases + stale detection)");
