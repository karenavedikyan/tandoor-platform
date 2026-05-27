/**
 * Запуск: `npm run test:category-tier-edit` из каталога apps/platform.
 *
 * Промт 48: смена «Категория (ТОП)» в карточке клиента должна переключать
 * сегмент в /dealer-base. Бага была в том, что edit-flow писал только
 * passportCategoryTier, а merge читал только clientCategory. Тест проверяет:
 *
 *   1) `clientCategoryFromPassportTier` маппит top150/350/500 в одноимённую категорию;
 *   2) `other` / `none` / undefined → `uncategorized`;
 *   3) `mergeDealerRowWithActualization` с override, где есть только
 *      passportCategoryTier (без clientCategory) — выставляет корректный
 *      `row.clientCategory` (страховочный fallback из data-merge).
 */
import assert from "node:assert/strict";

import { clientCategoryFromPassportTier } from "../lib/client-category";
import { createEmptyActualizationState } from "../lib/client-base-actualization-state";
import { mergeDealerRowWithActualization } from "../lib/client-base-actualization-data-merge";
import { DEALER_BASE_ROWS } from "../lib/dealer-base-mock-data";

// 1. top150 → top150
{
  assert.equal(clientCategoryFromPassportTier("top150"), "top150");
  assert.equal(clientCategoryFromPassportTier("top350"), "top350");
  assert.equal(clientCategoryFromPassportTier("top500"), "top500");
}

// 2. other → uncategorized
{
  assert.equal(clientCategoryFromPassportTier("other"), "uncategorized");
}

// 3. none → uncategorized
{
  assert.equal(clientCategoryFromPassportTier("none"), "uncategorized");
}

// 4. undefined / null / "" → uncategorized
{
  assert.equal(clientCategoryFromPassportTier(undefined), "uncategorized");
  assert.equal(clientCategoryFromPassportTier(null), "uncategorized");
  assert.equal(clientCategoryFromPassportTier(""), "uncategorized");
  assert.equal(clientCategoryFromPassportTier("   "), "uncategorized");
}

// 5. Integration: override содержит только passportCategoryTier → row.clientCategory переключается.
{
  const baseRow = DEALER_BASE_ROWS[0];
  assert.ok(baseRow, "DEALER_BASE_ROWS not empty");
  const row = { ...baseRow, clientCategory: "top500" as const };
  const state = createEmptyActualizationState();
  state.dealerOverridesById = {
    [row.id]: {
      dealerId: row.id,
      fields: { passportCategoryTier: "top150" } as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
      updatedBy: "u1",
      updatedByName: "U",
      source: "manual_actualization",
    },
  };
  const merged = mergeDealerRowWithActualization(row, state);
  assert.equal(merged.clientCategory, "top150", "fallback from passportCategoryTier=top150 → clientCategory=top150");
}

// 6. Integration: passportCategoryTier=other → clientCategory=uncategorized.
{
  const baseRow = DEALER_BASE_ROWS[0];
  assert.ok(baseRow);
  const row = { ...baseRow, clientCategory: "top500" as const };
  const state = createEmptyActualizationState();
  state.dealerOverridesById = {
    [row.id]: {
      dealerId: row.id,
      fields: { passportCategoryTier: "other" } as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
      updatedBy: "u1",
      updatedByName: "U",
      source: "manual_actualization",
    },
  };
  const merged = mergeDealerRowWithActualization(row, state);
  assert.equal(merged.clientCategory, "uncategorized", "passportCategoryTier=other → clientCategory=uncategorized");
}

// 7. Integration: явный clientCategory в override побеждает над passportCategoryTier.
{
  const baseRow = DEALER_BASE_ROWS[0];
  assert.ok(baseRow);
  const row = { ...baseRow, clientCategory: "top500" as const };
  const state = createEmptyActualizationState();
  state.dealerOverridesById = {
    [row.id]: {
      dealerId: row.id,
      fields: {
        clientCategory: "top350",
        passportCategoryTier: "top150", // должно проигнорироваться, потому что явный clientCategory есть
      } as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
      updatedBy: "u1",
      updatedByName: "U",
      source: "manual_actualization",
    },
  };
  const merged = mergeDealerRowWithActualization(row, state);
  assert.equal(merged.clientCategory, "top350", "явный clientCategory в override побеждает");
}

console.log("client-category-tier-edit: ok (7 cases)");
