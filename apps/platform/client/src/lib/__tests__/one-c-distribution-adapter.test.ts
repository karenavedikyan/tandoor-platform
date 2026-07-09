/**
 * Запуск: npx vitest run one-c-distribution-adapter
 */
import assert from "node:assert/strict";
import type { OneCStoreListItem } from "../one-c-showroom-api";
import { buildDistributionEntryTradePointRowFromOneC } from "../one-c-distribution-adapter";

const item: OneCStoreListItem = {
  id_1c: "store-uuid-1",
  address: "ул. Пушкина, 10",
  manager_name: "Аветисян Рачик Сергеевич",
  legal_name: "ООО Клиент",
  legal_inn: "7701234567",
  legal_city: "Москва",
  legal_parent_1c: null,
  legal_parent_name: null,
  legal_client_type: "ТОП 350",
  legal_regional_manager_name: "Регионал Тест",
  legal_responsible_manager_name: "Ответственный Тест",
  legal_furniture_manager_name: "Мебельщик Тест",
  rop_user_id: "rop-uuid",
  rop_name: "РОП Тест",
  legal_payment_form: null,
  legal_phone: null,
  legal_email: null,
  status: "active",
  orders_count: 0,
  distribution_filled: 2,
  distribution_total: 4,
};

const row = buildDistributionEntryTradePointRowFromOneC(item);

assert.equal(row.managerName, "Аветисян Рачик Сергеевич");
assert.equal(row.regionalManagerName, "Регионал Тест");
assert.equal(row.responsibleManagerName, "Ответственный Тест");
assert.equal(row.furnitureManagerName, "Мебельщик Тест");
assert.equal(row.ropName, "РОП Тест");
assert.equal(row.legalInn, "7701234567");
assert.equal(row.address, "ул. Пушкина, 10");
assert.equal(row.tradePointId, "store-uuid-1");
assert.deepEqual(row.installedOursBySegment, { vh: 0, mk: 0, hardware: 0 });
assert.equal(row.installedOursRotation, 0);

console.log("one-c-distribution-adapter.test.ts: ok");
