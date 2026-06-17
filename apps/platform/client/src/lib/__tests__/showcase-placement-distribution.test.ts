/**
 * Запуск: npm run test:placement-distribution
 */
import assert from "node:assert/strict";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";
import { computePlacementDistribution } from "../showcase-placement-distribution";

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
    placementOurModels: [],
    placementCompetitors: [],
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
    placementOurModels: [],
    placementCompetitors: [],
  };
}

// 1. Empty array
const empty = computePlacementDistribution([]);
assert.equal(empty.overall.totalCapacity, 0);
assert.equal(empty.overall.totalOurs, 0);
assert.equal(empty.overall.totalCompetitors, 0);
assert.equal(empty.overall.remaining, 0);
assert.equal(empty.overall.distributionPercent, 0);
assert.equal(empty.overall.blockCount, 0);
assert.deepEqual(empty.bySegment, []);

// 2. Single vh block: capacity 4, ours 1 → 25%, remaining 3
const single = computePlacementDistribution([
  placement({
    targetId: "b1",
    placementSegment: "vh",
    placementCapacity: 4,
    placementActual: 1,
  }),
]);
assert.equal(single.overall.distributionPercent, 25);
assert.equal(single.overall.remaining, 3);
assert.equal(single.overall.totalOurs, 1);
assert.equal(single.overall.totalCapacity, 4);
assert.equal(single.bySegment.length, 1);
assert.equal(single.bySegment[0]?.segment, "vh");
assert.equal(single.bySegment[0]?.stats.distributionPercent, 25);

// 3. Competitors: capacity 4, ours 1, competitors 2 → remaining 1, percent 25
const withCompetitors = computePlacementDistribution([
  placement({
    placementCapacity: 4,
    placementActual: 1,
    placementCompetitors: [{ brand: "X", count: 2 }],
  }),
]);
assert.equal(withCompetitors.overall.distributionPercent, 25);
assert.equal(withCompetitors.overall.remaining, 1);
assert.equal(withCompetitors.overall.totalCompetitors, 2);

// 4. Multiple segments — order vh, mk, hardware; overall sums all
const multi = computePlacementDistribution([
  placement({ targetId: "vh1", placementSegment: "vh", placementCapacity: 10, placementActual: 5 }),
  placement({ targetId: "mk1", placementSegment: "mk", placementCapacity: 20, placementActual: 10 }),
  placement({
    targetId: "hw1",
    placementSegment: "hardware",
    placementType: "branded_stand",
    placementCapacity: 30,
    placementActual: 15,
  }),
]);
assert.equal(multi.overall.totalCapacity, 60);
assert.equal(multi.overall.totalOurs, 30);
assert.equal(multi.overall.distributionPercent, 50);
assert.deepEqual(
  multi.bySegment.map((s) => s.segment),
  ["vh", "mk", "hardware"],
);
assert.equal(multi.bySegment[0]?.stats.distributionPercent, 50);
assert.equal(multi.bySegment[1]?.stats.distributionPercent, 50);
assert.equal(multi.bySegment[2]?.stats.distributionPercent, 50);

// 5. Fallback ours from placementOurModels when placementActual is null
const fromModels = computePlacementDistribution([
  placement({
    placementCapacity: 8,
    placementActual: null,
    placementOurModels: [
      { modelId: "m1", count: 2 },
      { modelId: "m2", count: 1 },
    ],
  }),
]);
assert.equal(fromModels.overall.totalOurs, 3);
assert.equal(fromModels.overall.distributionPercent, 38);
assert.equal(fromModels.overall.remaining, 5);

// 6. Non-placement entries ignored
const mixed = computePlacementDistribution([
  placement({ placementCapacity: 10, placementActual: 5 }),
  modelEntry(),
]);
assert.equal(mixed.overall.blockCount, 1);
assert.equal(mixed.overall.totalCapacity, 10);
assert.equal(mixed.overall.totalOurs, 5);

// 7. capacity 0 → percent 0, no division by zero
const zeroCap = computePlacementDistribution([
  placement({ placementCapacity: 0, placementActual: 5 }),
]);
assert.equal(zeroCap.overall.distributionPercent, 0);
assert.equal(zeroCap.overall.totalCapacity, 0);

console.log("✓ showcase-placement-distribution tests passed");
