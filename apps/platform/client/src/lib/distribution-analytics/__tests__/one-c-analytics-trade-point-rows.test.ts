/**
 * Запуск: npx tsx --test client/src/lib/distribution-analytics/__tests__/one-c-analytics-trade-point-rows.test.ts
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildOneCAnalyticsTradePointRows } from "../one-c-analytics-trade-point-rows";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";

const STORE_ID = "80139592-a65e-11ef-8135-00155d0a0a4e";

function mockStore(overrides: Partial<OneCStoreListItem> = {}): OneCStoreListItem {
  return {
    id_1c: STORE_ID,
    address: "346504, Ростовская обл, Шахты г, Маяковского ул, дом № 94",
    manager_name: null,
    legal_name: "ООО Тест",
    legal_inn: null,
    legal_city: "Шахты",
    legal_parent_1c: null,
    legal_parent_name: null,
    legal_client_type: "ТОП 150",
    legal_regional_manager_name: null,
    legal_responsible_manager_name: null,
    legal_furniture_manager_name: null,
    rop_user_id: null,
    rop_name: null,
    legal_payment_form: null,
    legal_phone: null,
    legal_email: null,
    status: "new",
    orders_count: 0,
    distribution_total: 0,
    distribution_filled: 0,
    ...overrides,
  };
}

test("displayCode = address when address present", () => {
  const [row] = buildOneCAnalyticsTradePointRows([mockStore()]);
  assert.equal(
    row!.tradePointDisplayCode,
    "346504, Ростовская обл, Шахты г, Маяковского ул, дом № 94",
  );
});

test("displayCode = legal_name when address empty", () => {
  const [row] = buildOneCAnalyticsTradePointRows([mockStore({ address: null })]);
  assert.equal(row!.tradePointDisplayCode, "ООО Тест");
});

test("displayCode = short id suffix when nothing else", () => {
  const [row] = buildOneCAnalyticsTradePointRows([
    mockStore({ address: null, legal_name: null }),
  ]);
  assert.equal(row!.tradePointDisplayCode, "[5d0a0a4e]");
  assert.ok(row!.tradePointDisplayCode.length <= 12);
  assert.notEqual(row!.tradePointDisplayCode, STORE_ID);
});

test("searchHaystack still contains full id_1c", () => {
  const [row] = buildOneCAnalyticsTradePointRows([mockStore()]);
  assert.ok(row!.searchHaystack.includes(STORE_ID));
});
