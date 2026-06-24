/**
 * Запуск: npm run test:distribution-entry-collect-ids
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data.js";
import type { DealerTradePointsState } from "../dealer-trade-points-overrides.js";
import {
  collectScopedTradePointIds,
  scopedTradePointIdsStableKey,
} from "../distribution-entry-tradepoint-view-model";

const dealer: DealerRow = {
  id: "d1",
  name: "Клиент",
  city: "Москва",
  status: "активный",
  clientCategory: "top350",
  tradePoints: [
    { id: "tp-active", name: "Активная", city: "Москва", address: "", status: "активный" },
    { id: "tp-archive", name: "Архивная", city: "Москва", address: "", status: "Архив" },
    { id: "tp-dup", name: "Дубль", city: "Москва", address: "", status: "активный" },
  ],
} as DealerRow;

const dealer2: DealerRow = {
  id: "d2",
  name: "Клиент 2",
  city: "Казань",
  status: "активный",
  clientCategory: "top500",
  tradePoints: [{ id: "tp-dup", name: "Та же id", city: "Казань", address: "", status: "активный" }],
} as DealerRow;

const tradePointsState: DealerTradePointsState = {
  tradePointsByDealer: {
    d1: [
      {
        id: "tp-manual",
        name: "Ручная ТТ",
        city: "Москва",
        address: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        updatedBy: "u1",
        updatedByName: "User",
      },
    ],
  },
  editsByTradePoint: {},
  historyByDealer: {},
};

const ids = collectScopedTradePointIds([dealer, dealer2], tradePointsState);
assert.ok(ids.includes("tp-active"));
assert.ok(ids.includes("tp-manual"));
assert.ok(!ids.includes("tp-archive"));
assert.equal(ids.filter((id) => id === "tp-dup").length, 1, "дубликаты схлопываются");

assert.equal(scopedTradePointIdsStableKey(["b", "a", "c"]), "a,b,c");
assert.equal(scopedTradePointIdsStableKey([]), "");

console.log("✓ distribution-entry-tradepoint-collect-ids tests passed");
