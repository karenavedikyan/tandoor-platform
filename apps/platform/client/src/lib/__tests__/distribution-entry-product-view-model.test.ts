/**
 * Запуск: npm run test:distribution-entry-product
 */
import assert from "node:assert/strict";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import type { ShowcaseMatrixModelDefinition } from "@/lib/trade-point-showcase-matrix-models";
import {
  buildEntryProductModelRows,
  matrixModelToCatalogListProduct,
  isModelInstalledInEntries,
  isModelRecommendedForCategory,
  modelMatchesSegment,
  resolveEntryProductTpPresence,
} from "../distribution-entry-product-view-model";

const modelVh: ShowcaseMatrixModelDefinition = {
  id: "m-vh-1",
  name: "Входная Эра",
  type: "entrance",
  typeLabelRu: "ВХ",
  imageUrl: "",
  basePriority: "high",
  categoryRules: ["top350", "top500"],
  importanceReason: "",
  characteristics: "",
  advantages: "",
  benefitsDealer: "",
  benefitsBuyer: "",
  objections: "",
  objectionAnswers: "",
  copyMessage: "",
};

const modelMk: ShowcaseMatrixModelDefinition = {
  ...modelVh,
  id: "m-mk-1",
  name: "МК Grand",
  type: "interior",
  typeLabelRu: "МК",
  categoryRules: ["top150"],
};

assert.equal(modelMatchesSegment(modelVh, "vh"), true);
assert.equal(modelMatchesSegment(modelVh, "mk"), false);
assert.equal(modelMatchesSegment(modelVh, "furniture"), false);
assert.equal(modelMatchesSegment(modelMk, "mk"), true);

assert.equal(isModelRecommendedForCategory(modelVh, "top350"), true);
assert.equal(isModelRecommendedForCategory(modelVh, "top150"), false);

const installedEntry: ShowcaseMatrixEntryDto = {
  id: "e1",
  dealerId: "d1",
  tradePointId: "tp1",
  targetKind: "model",
  targetId: "m-vh-1",
  status: "installed",
  comment: null,
  updatedAt: "2026-06-01T10:00:00.000Z",
  updatedBy: null,
  updatedByName: null,
  placementType: null,
  placementSegment: null,
  placementCapacity: null,
  placementActual: null,
  placementRef: null,
};

assert.equal(isModelInstalledInEntries([installedEntry], "m-vh-1"), true);
assert.equal(isModelInstalledInEntries([installedEntry], "m-mk-1"), false);

assert.equal(buildEntryProductModelRows([], "furniture").length, 0);

const catalog = matrixModelToCatalogListProduct(modelVh);
assert.equal(catalog.id, "m-vh-1");
assert.equal(catalog.name, "Входная Эра");
assert.equal(catalog.display_name, "Входная Эра");
assert.equal(catalog.brand, "ВХ");
assert.equal(catalog.image_url, null);
assert.equal(catalog.is_new, false);
assert.equal(catalog.total_stock, null);

console.log("distribution-entry-product-view-model.test.ts: ok");
