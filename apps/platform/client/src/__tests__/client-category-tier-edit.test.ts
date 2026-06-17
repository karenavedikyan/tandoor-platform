/**
 * Запуск: `npm run test:category-tier-edit` из каталога apps/platform.
 *
 * Промт 48: смена «Категория (ТОП)» в карточке клиента должна переключать
 * сегмент в /dealer-base. Бага была в том, что edit-flow писал только
 * passportCategoryTier, а merge читал только clientCategory. Тест проверяет:
 *
 *   1) `clientCategoryFromPassportTier` маппит top150/350/500 в одноимённую категорию;
 *   2) `other` / `none` / undefined → `new_client`;
 *   3) `mergeDealerRowWithActualization` с override, где есть только
 *      passportCategoryTier (без clientCategory) — выставляет корректный
 *      `row.clientCategory` (страховочный fallback из data-merge).
 */
import assert from "node:assert/strict";

import { clientCategoryFromPassportTier, normalizePassportCategoryTier } from "../lib/client-category";
import { createEmptyActualizationState } from "../lib/client-base-actualization-state";
import { mergeDealerRowWithActualization } from "../lib/client-base-actualization-data-merge";
import type { DealerRow } from "../lib/dealer-base-mock-data";

const FIXTURE_ROW: DealerRow = {
  id: "test-001",
  name: "Тест",
  city: "Москва",
  clientCategory: "top500",
  status: "активный",
  tradePoints: [],
  contacts: { lpr: "Иван", buyer: "", phone: "", email: "", channel: "" },
  terms: { tandoorClub: "", special: "", payment: "", edo: "", limit: "", bonuses: "" },
} as DealerRow;

// 1. top150 → top150
{
  assert.equal(clientCategoryFromPassportTier("top150"), "top150");
  assert.equal(clientCategoryFromPassportTier("top350"), "top350");
  assert.equal(clientCategoryFromPassportTier("top500"), "top500");
}

// 2. other → new_client
{
  assert.equal(clientCategoryFromPassportTier("other"), "new_client");
}

// 3. none → new_client
{
  assert.equal(clientCategoryFromPassportTier("none"), "new_client");
}

// 4. undefined / null / "" → new_client
{
  assert.equal(clientCategoryFromPassportTier(undefined), "new_client");
  assert.equal(clientCategoryFromPassportTier(null), "new_client");
  assert.equal(clientCategoryFromPassportTier(""), "new_client");
  assert.equal(clientCategoryFromPassportTier("   "), "new_client");
}

// 5. Integration: override содержит только passportCategoryTier → row.clientCategory переключается.
{
  const row = { ...FIXTURE_ROW, clientCategory: "top500" as const };
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

// 6. Integration: passportCategoryTier=other → clientCategory=new_client.
{
  const row = { ...FIXTURE_ROW, clientCategory: "top500" as const };
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
  assert.equal(merged.clientCategory, "new_client", "passportCategoryTier=other → clientCategory=new_client");
}

// 7. Integration: явный clientCategory в override побеждает над passportCategoryTier.
{
  const row = { ...FIXTURE_ROW, clientCategory: "top500" as const };
  const state = createEmptyActualizationState();
  state.dealerOverridesById = {
    [row.id]: {
      dealerId: row.id,
      fields: {
        clientCategory: "top350",
        passportCategoryTier: "top150",
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
