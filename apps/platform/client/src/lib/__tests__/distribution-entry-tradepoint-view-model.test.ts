/**
 * Запуск: npm run test:distribution-entry-tradepoint
 */
import assert from "node:assert/strict";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import {
  buildDistributionEntryTradePointRows,
  type DistributionEntryTradePointRow,
} from "../distribution-entry-tradepoint-view-model";

const dealerA: DealerRow = {
  id: "d-a",
  name: "Клиент Альфа",
  city: "Москва",
  status: "активный",
  clientCategory: "top350",
  tradePoints: [
    { id: "tp-a1", name: "ТТ Альфа Центр", city: "Москва", address: "", status: "активный" },
    { id: "tp-a2", name: "ТТ Альфа Юг", city: "Москва", address: "", status: "активный" },
  ],
} as DealerRow;

const dealerB: DealerRow = {
  id: "d-b",
  name: "Клиент Бета",
  city: "Казань",
  status: "активный",
  clientCategory: "top500",
  tradePoints: [{ id: "tp-b1", name: "ТТ Бета", city: "Казань", address: "", status: "активный" }],
} as DealerRow;

function entry(
  tradePointId: string,
  targetId: string,
  updatedAt: string,
): ShowcaseMatrixEntryDto {
  return {
    id: `e-${tradePointId}-${targetId}`,
    dealerId: "d1",
    tradePointId,
    targetKind: "model",
    targetId,
    status: "installed",
    comment: null,
    updatedAt,
    updatedBy: null,
    updatedByName: null,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
  };
}

const cache = new Map<string, ShowcaseMatrixEntryDto[]>();

function loadCachedMatrixMock(tradePointId: string): ShowcaseMatrixEntryDto[] {
  return cache.get(tradePointId) ?? [];
}

const templateByTp: Record<string, string[]> = {
  "tp-a1": ["m1", "m2", "m3", "m4"],
  "tp-a2": ["m1", "m2"],
  "tp-b1": ["x1", "x2"],
};

function resolveTemplate(_dealer: DealerRow, point: { id: string }): string[] {
  return templateByTp[point.id] ?? [];
}

cache.set("tp-a1", [
  entry("tp-a1", "m1", "2026-06-01T10:00:00.000Z"),
  entry("tp-a1", "m2", "2026-06-03T12:00:00.000Z"),
  entry("tp-a1", "m3", "2026-06-02T11:00:00.000Z"),
]);
cache.set("tp-a2", [entry("tp-a2", "m1", "2020-01-01T00:00:00.000Z")]);
cache.set("tp-b1", [
  entry("tp-b1", "x1", "2026-05-01T08:00:00.000Z"),
  entry("tp-b1", "extra-outside", "2026-05-02T08:00:00.000Z"),
]);

const rows = buildDistributionEntryTradePointRows({
  dealers: [dealerA, dealerB],
  loadCachedMatrixFn: loadCachedMatrixMock,
  resolveTemplateModelIds: resolveTemplate,
});

const rowA1 = rows.find((r) => r.tradePointId === "tp-a1")!;
assert.equal(rowA1.templateModelsCount, 4);
assert.equal(rowA1.filledCount, 3);
assert.equal(rowA1.coveragePct, 75);
assert.equal(rowA1.lastUpdatedAt, "2026-06-03T12:00:00.000Z");

const rowB1 = rows.find((r) => r.tradePointId === "tp-b1")!;
assert.equal(rowB1.filledCount, 1, "запись вне шаблона не учитывается");
assert.equal(rowB1.coveragePct, 50);

const emptyTemplateRows = buildDistributionEntryTradePointRows({
  dealers: [dealerA],
  loadCachedMatrixFn: () => [],
  resolveTemplateModelIds: () => [],
});
assert.equal(emptyTemplateRows[0]?.coveragePct, 0);

const sorted = rows.map((r) => r.tradePointId);
assert.equal(sorted[0], "tp-a2", "наименьшее покрытие выше");
assert.ok(sorted.indexOf("tp-a1") < sorted.indexOf("tp-b1") || sorted[0] === "tp-a2");

const filtered = buildDistributionEntryTradePointRows({
  dealers: [dealerA, dealerB],
  query: "казань",
  loadCachedMatrixFn: loadCachedMatrixMock,
  resolveTemplateModelIds: resolveTemplate,
});
assert.equal(filtered.length, 1);
assert.equal(filtered[0]?.tradePointId, "tp-b1");

const filteredClient = buildDistributionEntryTradePointRows({
  dealers: [dealerA, dealerB],
  query: "альфа",
  loadCachedMatrixFn: loadCachedMatrixMock,
  resolveTemplateModelIds: resolveTemplate,
});
assert.equal(filteredClient.length, 2);

console.log("✓ distribution-entry-tradepoint-view-model tests passed");
