/**
 * Запуск: npx tsx shared/__tests__/primary-trade-point-materialization.test.ts
 */
import assert from "node:assert/strict";
import {
  buildPrimaryTradePointMaterializationFields,
  primaryTradePointMaterializationId,
  PRIMARY_TRADE_POINT_NAME,
} from "../primary-trade-point-materialization.js";

const dealerId = "client-ma-ma038904";
const id1 = primaryTradePointMaterializationId(dealerId);
const id2 = primaryTradePointMaterializationId(dealerId);
assert.equal(id1, id2);
assert.equal(id1, "manual-tp-primary-client-ma-ma038904");

const fieldsA = buildPrimaryTradePointMaterializationFields({
  city: "Краснодар",
  releaseAddress: "ул. Ленина 1",
  contacts: { lpr: "Иванов", phone: "+7 900 000-00-00", email: "a@b.ru" },
});
const fieldsB = buildPrimaryTradePointMaterializationFields({
  city: "Краснодар",
  releaseAddress: "ул. Ленина 1",
  contacts: { lpr: "Иванов", phone: "+7 900 000-00-00", email: "a@b.ru" },
});
assert.deepEqual(fieldsA, fieldsB);
assert.equal(fieldsA.name, PRIMARY_TRADE_POINT_NAME);
assert.equal(fieldsA.city, "Краснодар");
assert.equal(fieldsA.address, "ул. Ленина 1");
assert.equal(fieldsA.contactName, "Иванов");

const sparse = buildPrimaryTradePointMaterializationFields({ city: "", releaseAddress: null });
assert.equal(sparse.city, "—");
assert.equal(sparse.address, "Адрес не указан");

console.log("primary-trade-point-materialization: ok");
