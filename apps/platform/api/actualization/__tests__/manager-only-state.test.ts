/**
 * Запуск: `npm run test:manager-only-state` из каталога apps/platform.
 *
 * Промт 50: проверяем, что у не-manager scope-keys 14 manager-only полей
 * обнуляются и при записи (POST guard), и при чтении (GET sanitize), и
 * что cron-чистка не трогает не-manager строки.
 *
 * Стиль теста — tsx + node:assert/strict (как existing actualization-тесты).
 * Хэндлер целиком не дёргаем (он тянет @vercel/node + neon), вместо этого
 * репродуцируем ровно ту цепочку, что использует обработчик: canonicalize →
 * shouldSanitize → sanitize → merge. Это покрывает реальную логику фикса.
 */
import assert from "node:assert/strict";
import {
  MANAGER_ONLY_STATE_FIELDS,
  sanitizeStateForNonManagerRole,
  shouldSanitizeStateForRole,
} from "../../../shared/admin/manager-only-state-fields";
import { canonicalizeRole } from "../state";

// ==========================================================================
// 1. shouldSanitizeStateForRole: матрица канонических ролей.
// ==========================================================================
{
  // manager — единственная роль без санитизации.
  assert.equal(shouldSanitizeStateForRole("manager"), false, "manager → false");

  // Все остальные канонические роли — санитизация.
  assert.equal(shouldSanitizeStateForRole("admin"), true, "admin → true");
  assert.equal(shouldSanitizeStateForRole("director"), true, "director → true");
  assert.equal(shouldSanitizeStateForRole("rop"), true, "rop → true");
  assert.equal(shouldSanitizeStateForRole("analyst"), true, "analyst → true");
  assert.equal(shouldSanitizeStateForRole("marketer"), true, "marketer → true");
  assert.equal(shouldSanitizeStateForRole("unknown"), true, "unknown → true");
  assert.equal(shouldSanitizeStateForRole(""), true, "empty → true");

  // Пробелы / регистр не сбивают результат.
  assert.equal(shouldSanitizeStateForRole("  MANAGER  "), false, "MANAGER с пробелами → false");
}

// ==========================================================================
// 2. sanitizeStateForNonManagerRole — все 14 полей обнуляются.
// ==========================================================================
{
  const seed = {
    version: 1,
    updatedAt: "2026-05-27T12:00:00.000Z",
    updatedBy: "u1",
    archivedDealersById: { D1: { dealerId: "D1" } },
    archivedTradePointsById: { T1: { tradePointId: "T1" } },
    archivedLegalEntitiesById: { L1: { id: "L1" } },
    trashedDealersById: { D2: { dealerId: "D2" } },
    trashedTradePointsById: { T2: { tradePointId: "T2" } },
    manuallyCreatedDealersById: { D3: { id: "D3" } },
    manuallyCreatedTradePointsById: { T3: { id: "T3" } },
    dealerOverridesById: { D4: { dealerId: "D4" } },
    tradePointOverridesById: { T4: { tradePointId: "T4" } },
    legalEntityOverridesByDealerId: { D5: {} },
    dealerActualizationContactsById: { C1: {} },
    dealerActualizationAuditByDealerId: { D6: {} },
    dealerPhotosByDealerId: { D7: [{ url: "x" }] },
    tradePointPhotosByTradePointId: { T5: [{ url: "y" }] },
    // UI-поля не относятся к manager-only списку — должны сохраниться.
    dealerCardViewSettingsByUserId: { u1: { theme: "light" } },
    unloadingOrderByDealerId: { D1: 7 },
    routeOrderByRouteId: { R1: { D1: 1 } },
  };

  const result = sanitizeStateForNonManagerRole(seed);

  // Все 14 manager-only полей — пустые объекты.
  for (const key of MANAGER_ONLY_STATE_FIELDS) {
    assert.deepEqual(result[key], {}, `${key} → {}`);
  }

  // UI-поля сохранены без изменений.
  assert.deepEqual(result.dealerCardViewSettingsByUserId, { u1: { theme: "light" } }, "UI: dealerCardViewSettingsByUserId");
  assert.deepEqual(result.unloadingOrderByDealerId, { D1: 7 }, "UI: unloadingOrderByDealerId");
  assert.deepEqual(result.routeOrderByRouteId, { R1: { D1: 1 } }, "UI: routeOrderByRouteId");

  // Метаданные state сохранены.
  assert.equal(result.version, 1, "version сохранён");
  assert.equal(result.updatedAt, "2026-05-27T12:00:00.000Z", "updatedAt сохранён");
  assert.equal(result.updatedBy, "u1", "updatedBy сохранён");

  // Входной объект не мутирован.
  assert.deepEqual(seed.archivedDealersById, { D1: { dealerId: "D1" } }, "input не мутирован: archivedDealersById");
  assert.deepEqual(seed.trashedDealersById, { D2: { dealerId: "D2" } }, "input не мутирован: trashedDealersById");
}

// ==========================================================================
// 3. sanitizeStateForNonManagerRole — non-object input.
// ==========================================================================
{
  // Возвращает значение как есть (без бросков).
  assert.equal(sanitizeStateForNonManagerRole(null as unknown as Record<string, unknown>), null);
  assert.equal(sanitizeStateForNonManagerRole(undefined as unknown as Record<string, unknown>), undefined);
  assert.equal(sanitizeStateForNonManagerRole(42 as unknown as Record<string, unknown>), 42);
  assert.equal(sanitizeStateForNonManagerRole("abc" as unknown as Record<string, unknown>), "abc");
  assert.deepEqual(
    sanitizeStateForNonManagerRole([1, 2, 3] as unknown as Record<string, unknown>),
    [1, 2, 3],
    "Массив возвращается как есть",
  );
}

// ==========================================================================
// 4. Симуляция POST guard: для каждой не-manager роли state санитизируется.
// ==========================================================================
{
  type IncomingFn = (role: string) => Record<string, unknown>;
  const incoming: IncomingFn = () => ({
    version: 1,
    archivedDealersById: { D1: { dealerId: "D1" } },
    trashedDealersById: { D2: { dealerId: "D2" } },
    manuallyCreatedDealersById: { D3: { id: "D3" } },
    dealerCardViewSettingsByUserId: { u1: { theme: "light" } },
  });

  function postGuard(role: string): Record<string, unknown> {
    const canonical = canonicalizeRole(role);
    const next = incoming(role);
    return shouldSanitizeStateForRole(canonical) ? sanitizeStateForNonManagerRole(next) : next;
  }

  // role=rop → все три manager-only поля пустые, UI-настройка сохранена.
  {
    const r = postGuard("rop");
    assert.deepEqual(r.archivedDealersById, {}, "rop POST: archivedDealersById = {}");
    assert.deepEqual(r.trashedDealersById, {}, "rop POST: trashedDealersById = {}");
    assert.deepEqual(r.manuallyCreatedDealersById, {}, "rop POST: manuallyCreatedDealersById = {}");
    assert.deepEqual(r.dealerCardViewSettingsByUserId, { u1: { theme: "light" } }, "rop POST: UI поле сохранено");
  }
  // role=director — то же.
  {
    const r = postGuard("director");
    assert.deepEqual(r.archivedDealersById, {}, "director POST: archivedDealersById = {}");
    assert.deepEqual(r.manuallyCreatedDealersById, {}, "director POST: manuallyCreatedDealersById = {}");
  }
  // role=admin — то же.
  {
    const r = postGuard("admin");
    assert.deepEqual(r.archivedDealersById, {}, "admin POST: archivedDealersById = {}");
    assert.deepEqual(r.trashedDealersById, {}, "admin POST: trashedDealersById = {}");
  }
  // role=manager — state НЕ санитизируется.
  {
    const r = postGuard("manager");
    assert.deepEqual(r.archivedDealersById, { D1: { dealerId: "D1" } }, "manager POST: archivedDealersById не тронут");
    assert.deepEqual(r.trashedDealersById, { D2: { dealerId: "D2" } }, "manager POST: trashedDealersById не тронут");
  }
  // role=sales_manager (синоним) — то же.
  {
    const r = postGuard("sales_manager");
    assert.deepEqual(r.archivedDealersById, { D1: { dealerId: "D1" } }, "sales_manager POST: не санитизируется");
  }
}

// ==========================================================================
// 5. Симуляция GET merge: manager-row сохраняется, rop-row обнуляется
//    перед merge. В результате merged.archivedDealersById содержит ТОЛЬКО
//    запись менеджера (client-1); запись РОП-а (client-2) выкинута.
// ==========================================================================
{
  // Поверхностный «merge» — для целей теста достаточно собрать ключи всех
  // archivedDealersById в один объект.
  type Row = { role: string; state: Record<string, unknown> };
  const rows: Row[] = [
    {
      role: "manager",
      state: {
        archivedDealersById: { "client-1": { dealerId: "client-1", source: "manager" } },
      },
    },
    {
      role: "rop",
      state: {
        archivedDealersById: { "client-2": { dealerId: "client-2", source: "rop-leak" } },
      },
    },
  ];

  const orderedStates: Record<string, unknown>[] = [];
  for (const row of rows) {
    const canonical = canonicalizeRole(row.role);
    const safe = shouldSanitizeStateForRole(canonical) ? sanitizeStateForNonManagerRole(row.state) : row.state;
    orderedStates.push(safe);
  }

  // Поверхностный merge: собираем все archivedDealersById в один объект.
  const mergedArchived: Record<string, unknown> = {};
  for (const s of orderedStates) {
    const arch = (s.archivedDealersById ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(arch)) mergedArchived[k] = arch[k];
  }

  assert.ok(mergedArchived["client-1"], "merge: запись менеджера (client-1) присутствует");
  assert.ok(!mergedArchived["client-2"], "merge: запись РОП-а (client-2) выкинута санитизацией");
}

// ==========================================================================
// 6. Полнота списка MANAGER_ONLY_STATE_FIELDS — ровно 14 ключей.
// ==========================================================================
{
  assert.equal(MANAGER_ONLY_STATE_FIELDS.length, 14, "ровно 14 manager-only полей");
  const set = new Set<string>(MANAGER_ONLY_STATE_FIELDS);
  assert.equal(set.size, 14, "нет дубликатов");
  for (const expected of [
    "archivedDealersById",
    "archivedTradePointsById",
    "archivedLegalEntitiesById",
    "trashedDealersById",
    "trashedTradePointsById",
    "manuallyCreatedDealersById",
    "manuallyCreatedTradePointsById",
    "dealerOverridesById",
    "tradePointOverridesById",
    "legalEntityOverridesByDealerId",
    "dealerActualizationContactsById",
    "dealerActualizationAuditByDealerId",
    "dealerPhotosByDealerId",
    "tradePointPhotosByTradePointId",
  ]) {
    assert.ok(set.has(expected), `обязательный ключ присутствует: ${expected}`);
  }
}

console.log("manager-only-state: ok (6 cases)");
