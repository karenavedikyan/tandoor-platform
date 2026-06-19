/**
 * Запуск: `npm run test:manager-only-state` из каталога apps/platform.
 *
 * Промт 50 / 421: проверяем, что у не-manager scope-keys manager-only полей
 * обнуляются и при записи (POST guard), и при чтении (GET sanitize).
 */
import assert from "node:assert/strict";
import {
  MANAGER_ONLY_STATE_FIELDS,
  sanitizeStateForNonManagerRole,
  shouldSanitizeStateForRole,
} from "../../../shared/admin/manager-only-state-fields";

function canonicalizeRole(role: string | null | undefined): string {
  const r = (role ?? "").trim().toLowerCase();
  if (!r) return "unknown";
  if (r === "admin") return "admin";
  if (r === "director" || r === "sales_director") return "director";
  if (r === "regional_manager") return "manager";
  if (r === "rop" || r === "team_lead") return "rop";
  if (r === "manager" || r === "sales_manager") return "manager";
  if (r === "analyst") return "analyst";
  if (r === "marketer") return "marketer";
  return "unknown";
}

// ==========================================================================
// 1. shouldSanitizeStateForRole: матрица канонических ролей.
// ==========================================================================
{
  assert.equal(shouldSanitizeStateForRole("manager"), false, "manager → false");
  assert.equal(shouldSanitizeStateForRole("admin"), true, "admin → true");
  assert.equal(shouldSanitizeStateForRole("director"), true, "director → true");
  assert.equal(shouldSanitizeStateForRole("rop"), true, "rop → true");
  assert.equal(shouldSanitizeStateForRole("analyst"), true, "analyst → true");
  assert.equal(shouldSanitizeStateForRole("marketer"), true, "marketer → true");
  assert.equal(shouldSanitizeStateForRole("unknown"), true, "unknown → true");
  assert.equal(shouldSanitizeStateForRole(""), true, "empty → true");
  assert.equal(shouldSanitizeStateForRole("  MANAGER  "), false, "MANAGER с пробелами → false");
}

// ==========================================================================
// 2. sanitizeStateForNonManagerRole — все manager-only поля обнуляются.
// ==========================================================================
{
  const seed = {
    version: 1,
    updatedAt: "2026-05-27T12:00:00.000Z",
    updatedBy: "u1",
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
    dealerCardViewSettingsByUserId: { u1: { theme: "light" } },
    unloadingOrderByDealerId: { D1: 7 },
    routeOrderByRouteId: { R1: { D1: 1 } },
  };

  const result = sanitizeStateForNonManagerRole(seed);

  for (const key of MANAGER_ONLY_STATE_FIELDS) {
    assert.deepEqual(result[key], {}, `${key} → {}`);
  }

  assert.deepEqual(result.dealerCardViewSettingsByUserId, { u1: { theme: "light" } }, "UI: dealerCardViewSettingsByUserId");
  assert.deepEqual(result.unloadingOrderByDealerId, { D1: 7 }, "UI: unloadingOrderByDealerId");
  assert.deepEqual(result.routeOrderByRouteId, { R1: { D1: 1 } }, "UI: routeOrderByRouteId");
  assert.equal(result.version, 1, "version сохранён");
  assert.equal(result.updatedAt, "2026-05-27T12:00:00.000Z", "updatedAt сохранён");
  assert.equal(result.updatedBy, "u1", "updatedBy сохранён");
  assert.deepEqual(seed.trashedDealersById, { D2: { dealerId: "D2" } }, "input не мутирован: trashedDealersById");
}

// ==========================================================================
// 3. sanitizeStateForNonManagerRole — non-object input.
// ==========================================================================
{
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
    trashedDealersById: { D2: { dealerId: "D2" } },
    manuallyCreatedDealersById: { D3: { id: "D3" } },
    dealerCardViewSettingsByUserId: { u1: { theme: "light" } },
  });

  function postGuard(role: string): Record<string, unknown> {
    const canonical = canonicalizeRole(role);
    const next = incoming(role);
    return shouldSanitizeStateForRole(canonical) ? sanitizeStateForNonManagerRole(next) : next;
  }

  {
    const r = postGuard("rop");
    assert.deepEqual(r.trashedDealersById, {}, "rop POST: trashedDealersById = {}");
    assert.deepEqual(r.manuallyCreatedDealersById, {}, "rop POST: manuallyCreatedDealersById = {}");
    assert.deepEqual(r.dealerCardViewSettingsByUserId, { u1: { theme: "light" } }, "rop POST: UI поле сохранено");
  }
  {
    const r = postGuard("director");
    assert.deepEqual(r.trashedDealersById, {}, "director POST: trashedDealersById = {}");
    assert.deepEqual(r.manuallyCreatedDealersById, {}, "director POST: manuallyCreatedDealersById = {}");
  }
  {
    const r = postGuard("admin");
    assert.deepEqual(r.trashedDealersById, {}, "admin POST: trashedDealersById = {}");
  }
  {
    const r = postGuard("manager");
    assert.deepEqual(r.trashedDealersById, { D2: { dealerId: "D2" } }, "manager POST: trashedDealersById не тронут");
  }
  {
    const r = postGuard("sales_manager");
    assert.deepEqual(r.trashedDealersById, { D2: { dealerId: "D2" } }, "sales_manager POST: не санитизируется");
  }
}

// ==========================================================================
// 5. GET merge: manager-row сохраняется, rop-row обнуляется перед merge.
// ==========================================================================
{
  type Row = { role: string; state: Record<string, unknown> };
  const rows: Row[] = [
    {
      role: "manager",
      state: {
        trashedDealersById: { "client-1": { dealerId: "client-1", source: "manager" } },
      },
    },
    {
      role: "rop",
      state: {
        trashedDealersById: { "client-2": { dealerId: "client-2", source: "rop-leak" } },
      },
    },
  ];

  const orderedStates: Record<string, unknown>[] = [];
  for (const row of rows) {
    const canonical = canonicalizeRole(row.role);
    const safe = shouldSanitizeStateForRole(canonical) ? sanitizeStateForNonManagerRole(row.state) : row.state;
    orderedStates.push(safe);
  }

  const mergedTrash: Record<string, unknown> = {};
  for (const s of orderedStates) {
    const trash = (s.trashedDealersById ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(trash)) mergedTrash[k] = trash[k];
  }

  assert.ok(mergedTrash["client-1"], "merge: запись менеджера (client-1) присутствует");
  assert.ok(!mergedTrash["client-2"], "merge: запись РОП-а (client-2) выкинута санитизацией");
}

// ==========================================================================
// 6. Полнота списка MANAGER_ONLY_STATE_FIELDS — 12 ключей (промт 421).
// ==========================================================================
{
  assert.equal(MANAGER_ONLY_STATE_FIELDS.length, 12, "ровно 12 manager-only полей");
  const set = new Set<string>(MANAGER_ONLY_STATE_FIELDS);
  assert.equal(set.size, 12, "нет дубликатов");
  for (const expected of [
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

// ==========================================================================
// 7. Batch sanitize: non-manager row обнуляет manager-only поля.
// ==========================================================================
{
  function batchSanitize(role: string, state: Record<string, unknown>): Record<string, unknown> {
    const canonical = canonicalizeRole(role);
    return shouldSanitizeStateForRole(canonical) ? sanitizeStateForNonManagerRole(state) : state;
  }

  const state = batchSanitize("rop", {
    version: 1,
    trashedDealersById: { D2: { dealerId: "D2" } },
    dealerCardViewSettingsByUserId: { u1: { theme: "light" } },
  });
  assert.deepEqual(state.trashedDealersById, {}, "batch sanitize rop: trashedDealersById");
  assert.deepEqual(state.dealerCardViewSettingsByUserId, { u1: { theme: "light" } }, "batch sanitize rop: UI поле");
  const mgr = batchSanitize("manager", { version: 1, trashedDealersById: { D1: { dealerId: "D1" } } });
  assert.deepEqual(mgr.trashedDealersById, { D1: { dealerId: "D1" } }, "batch sanitize manager: не трогаем");
}

console.log("manager-only-state: ok (7 cases)");
