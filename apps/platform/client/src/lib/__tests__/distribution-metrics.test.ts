/**
 * Запуск: npm run test:distribution-metrics
 */
import assert from "node:assert/strict";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import {
  computeDistributionMetrics,
  placementEntries,
} from "../distribution-metrics";
import { computeMatrixValueQualitativePct } from "../trade-point-matrix-resolver";

function placement(
  partial: Partial<ShowcaseMatrixEntryDto> & {
    placementType: NonNullable<ShowcaseMatrixEntryDto["placementType"]>;
  },
): ShowcaseMatrixEntryDto {
  return {
    id: "e-placement",
    dealerId: "d1",
    tradePointId: "tp1",
    targetKind: "placement",
    targetId: "block-1",
    status: "installed",
    comment: null,
    updatedAt: "2026-05-01T12:00:00.000Z",
    updatedBy: null,
    updatedByName: null,
    placementSegment: "vh",
    placementRef: null,
    placementCapacity: 100,
    placementActual: 100,
    ...partial,
  };
}

function modelEntry(): ShowcaseMatrixEntryDto {
  return {
    id: "e-model",
    dealerId: "d1",
    tradePointId: "tp1",
    targetKind: "model",
    targetId: "m1",
    status: "need_install",
    comment: null,
    updatedAt: "2026-05-01T12:00:00.000Z",
    updatedBy: null,
    updatedByName: null,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
  };
}

const empty = computeDistributionMetrics([]);
assert.equal(empty.totalCapacity, 0);
assert.equal(empty.totalActual, 0);
assert.equal(empty.quantitativePct, null);
assert.equal(empty.qualitativePct, null);
assert.equal(empty.byType.length, 0);

const withModel = computeDistributionMetrics([
  modelEntry(),
  placement({ placementType: "portal", placementCapacity: 100, placementActual: 50 }),
]);
assert.equal(withModel.totalCapacity, 100);
assert.equal(withModel.totalActual, 50);
assert.equal(withModel.quantitativePct, 50);

const portalFull = computeDistributionMetrics([
  placement({ placementType: "portal", placementCapacity: 100, placementActual: 100 }),
]);
assert.equal(portalFull.quantitativePct, 100);
assert.equal(portalFull.qualitativePct, 100);

const mixed = computeDistributionMetrics([
  placement({ id: "b1", targetId: "p1", placementType: "portal", placementCapacity: 100, placementActual: 50 }),
  placement({
    id: "b2",
    targetId: "p2",
    placementType: "unmounted",
    placementCapacity: 100,
    placementActual: 50,
  }),
]);
assert.equal(mixed.totalCapacity, 200);
assert.equal(mixed.totalActual, 100);
assert.equal(mixed.quantitativePct, 50);
assert.equal(mixed.qualitativePct, 60);

const zeroActual = computeDistributionMetrics([
  placement({ placementType: "cube", placementCapacity: 10, placementActual: 0 }),
]);
assert.equal(zeroActual.totalActual, 0);
assert.equal(zeroActual.qualitativePct, null);

const zeroCapacity = computeDistributionMetrics([
  placement({ placementType: "book", placementCapacity: 0, placementActual: 5 }),
]);
assert.equal(zeroCapacity.byType[0]?.quantitativePct, null);
assert.equal(zeroCapacity.quantitativePct, null);

const clamped = computeDistributionMetrics([
  placement({ placementType: "hoof", placementCapacity: 10, placementActual: 99 }),
]);
assert.equal(clamped.byType[0]?.actual, 10);

const invalidNums = computeDistributionMetrics([
  placement({
    placementType: "cube",
    placementCapacity: -5 as unknown as number,
    placementActual: "bad" as unknown as number,
  }),
]);
assert.equal(invalidNums.totalCapacity, 0);
assert.equal(invalidNums.totalActual, 0);

assert.equal(placementEntries([modelEntry(), placement({ placementType: "portal" })]).length, 1);

console.log("distribution-metrics: ok");
