/**
 * Запуск: npm run test:showcase-capacity-by-equipment
 */
import assert from "node:assert/strict";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";
import {
  capacityByEquipmentType,
  categoryCapacityFieldsForPersist,
  categoryCapacityFromPlacements,
  equipmentCapacityKey,
  mergeCategoryCapacityPreservingLegacy,
  seedInputsWithLegacyFallback,
} from "../showcase-capacity-by-equipment.js";

function placement(
  partial: Partial<ShowcaseMatrixEntryDto> & {
    placementType: NonNullable<ShowcaseMatrixEntryDto["placementType"]>;
    placementSegment: NonNullable<ShowcaseMatrixEntryDto["placementSegment"]>;
  },
): ShowcaseMatrixEntryDto {
  return {
    id: "e-placement",
    dealerId: "d1",
    tradePointId: "tp1",
    targetKind: "placement",
    targetId: partial.targetId ?? "block-1",
    status: "installed",
    comment: null,
    updatedAt: "2026-05-01T12:00:00.000Z",
    updatedBy: null,
    updatedByName: null,
    placementRef: null,
    placementCapacity: 4,
    placementActual: 0,
    placementOurModels: [],
    placementCompetitors: [],
    ...partial,
  };
}

const entries = [
  placement({ targetId: "vh-portal", placementSegment: "vh", placementType: "portal", placementCapacity: 6 }),
  placement({ targetId: "vh-cube", placementSegment: "vh", placementType: "cube", placementCapacity: 4 }),
  placement({ targetId: "mk-portal", placementSegment: "mk", placementType: "portal", placementCapacity: 5 }),
  placement({ targetId: "mk-portal-2", placementSegment: "mk", placementType: "portal", placementCapacity: 3 }),
];

assert.equal(categoryCapacityFromPlacements(entries).entrance, 10);
assert.equal(categoryCapacityFromPlacements(entries).interior, 8);
assert.equal(categoryCapacityFromPlacements(entries).hardware, 0);

const byType = capacityByEquipmentType(entries);
assert.equal(byType.vh.find((r) => r.placementType === "portal")?.capacity, 6);
assert.equal(byType.vh.find((r) => r.placementType === "cube")?.capacity, 4);
assert.equal(byType.mk.find((r) => r.placementType === "portal")?.capacity, 8);
assert.equal(byType.mk.find((r) => r.placementType === "portal")?.blockTargetId, "mk-portal");

assert.equal(equipmentCapacityKey("vh", "portal"), "vh:portal");

const legacy = { entrance: 10, interior: 20, hardware: 20 };
const seeded = seedInputsWithLegacyFallback([], legacy);
assert.equal(seeded["vh:unmounted"], 10);
assert.equal(seeded["mk:unmounted"], 20);
assert.equal(seeded["hardware:branded_stand"], 20);

const seededWithPlacement = seedInputsWithLegacyFallback(entries, legacy);
assert.equal(seededWithPlacement["vh:portal"], 6);
assert.equal(seededWithPlacement["vh:unmounted"] ?? 0, 0);

assert.deepEqual(mergeCategoryCapacityPreservingLegacy({ entrance: 0, interior: 0, hardware: 0 }, legacy), legacy);

const persisted = categoryCapacityFieldsForPersist({
  next: { entrance: 0, interior: 0, hardware: 0 },
  prevRec: { entrancePortals: 10, interiorPortals: 20, hardwareSections: 20 },
  hasShowcase: true,
});
assert.equal(persisted.entrancePortals, 10);
assert.equal(persisted.interiorPortals, 20);
assert.equal(persisted.hardwareSections, 20);

const migrated = categoryCapacityFieldsForPersist({
  next: { entrance: 10, interior: 20, hardware: 20 },
  prevRec: { entrancePortals: 10, interiorPortals: 20, hardwareSections: 20 },
  hasShowcase: true,
});
assert.equal(migrated.entrancePortals, 10);
assert.equal(migrated.interiorPortals, 20);
assert.equal(migrated.hardwareSections, 20);

console.log("showcase-capacity-by-equipment: ok");
