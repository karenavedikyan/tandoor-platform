/**
 * Запуск: npm run test:trade-point-showcase-matrix-required
 */
import assert from "node:assert/strict";
import type { TradePointShowcaseSelectedModel } from "../client-base-actualization-state.js";
import { effectivePlacementTypeForSelectedModel } from "../trade-point-showcase-matrix-required.js";

const baseModel: TradePointShowcaseSelectedModel = {
  productId: "p-1",
  productName: "Модель",
  productType: "door",
  selectedAt: "2026-06-01T10:00:00.000Z",
  selectedBy: "u-1",
  selectedByName: "Тест",
};

assert.equal(
  effectivePlacementTypeForSelectedModel({ ...baseModel, placementType: "portal" }, "vh"),
  "portal",
);

assert.equal(effectivePlacementTypeForSelectedModel(baseModel, "vh"), "unmounted");
assert.equal(effectivePlacementTypeForSelectedModel(baseModel, "mk"), "unmounted");
assert.equal(effectivePlacementTypeForSelectedModel(baseModel, "hardware"), "branded_stand");

console.log("trade-point-showcase-matrix-required: ok");
