/**
 * Запуск: `npm run test:distribution-tree-data` из каталога apps/platform (или vitest path).
 */
import assert from "node:assert/strict";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import {
  collectScopeTradePointIds,
  countStatuses,
  groupMatrixEntries,
  matchesSearch,
} from "../distribution-tree-data";

const dealer: DealerRow = {
  id: "d1",
  name: "Тестовый дилер",
  city: "Москва",
  status: "активный",
  clientCategory: "A",
  tradePoints: [
    { id: "tp1", name: "ТТ Центр", city: "Москва" },
    { id: "tp2", name: "ТТ Юг", city: "Москва" },
  ],
} as DealerRow;

const entry = (partial: Partial<ShowcaseMatrixEntryDto>): ShowcaseMatrixEntryDto => ({
  id: "e1",
  dealerId: "d1",
  tradePointId: "tp1",
  targetKind: "model",
  targetId: "m1",
  status: "need_install",
  comment: "",
  updatedAt: "2026-05-01T12:00:00.000Z",
  updatedBy: "u1",
  updatedByName: "Менеджер",
  placementType: null,
  placementSegment: null,
  placementCapacity: null,
  placementActual: null,
  placementRef: null,
  ...partial,
});

assert.deepEqual(
  collectScopeTradePointIds({ kind: "trade-point", dealer, point: dealer.tradePoints[0]! }),
  ["tp1"],
);

const grouped = groupMatrixEntries([
  entry({ id: "e1", status: "need_install" }),
  entry({ id: "e2", status: "installed", targetId: "m2" }),
  entry({ id: "e3", tradePointId: "tp2", status: "postponed" }),
]);

assert.equal(grouped.get("d1")?.get("tp1")?.length, 2);
assert.equal(grouped.get("d1")?.get("tp2")?.length, 1);

const counts = countStatuses([
  entry({ status: "need_install" }),
  entry({ id: "e2", status: "need_install" }),
  entry({ id: "e3", status: "installed" }),
]);
assert.equal(counts.need_install, 2);
assert.equal(counts.installed, 1);
assert.equal(counts.postponed, 0);

assert.equal(matchesSearch("москва тт центр", "центр"), true);
assert.equal(matchesSearch("москва", "спб"), false);

console.log("distribution-tree-data: ok");
