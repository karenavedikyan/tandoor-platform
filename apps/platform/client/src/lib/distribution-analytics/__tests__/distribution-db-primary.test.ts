/**
 * Запуск: `npm run test:distribution-db-primary` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { TradePointShowcaseActualization } from "../../client-base-actualization-state";
import type { ShowcaseMatrixEntryDto } from "../../showcase-matrix-api";
import {
  aggregateDistribution,
  capacityFromMatrixEntries,
  computeDistributionForTradePoint,
} from "../distribution-analytics-math";
import {
  resetDistributionDbPrimaryFlagCache,
  seedDistributionDbPrimaryFromBootstrap,
} from "../../distribution-db-primary-flag";

function makeInstalledModel(targetId: string, tradePointId = "tp-1"): ShowcaseMatrixEntryDto {
  return {
    id: `m-${targetId}`,
    dealerId: "d-1",
    tradePointId,
    targetKind: "model",
    targetId,
    status: "installed",
    comment: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByName: null,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
    placementLegacyOurs: null,
  };
}

function makePlacementBlock(
  segment: "vh" | "mk" | "hardware",
  opts: { placementCapacity?: number | null; tradePointId?: string },
): ShowcaseMatrixEntryDto {
  return {
    id: `p-${segment}-${opts.tradePointId ?? "tp-1"}`,
    dealerId: "d-1",
    tradePointId: opts.tradePointId ?? "tp-1",
    targetKind: "placement",
    targetId: `placement-${segment}`,
    status: "installed",
    comment: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByName: null,
    placementType: "book",
    placementSegment: segment,
    placementCapacity: opts.placementCapacity ?? 10,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
    placementLegacyOurs: null,
  };
}

function baseShowcase(partial: Partial<TradePointShowcaseActualization>): TradePointShowcaseActualization {
  return {
    tradePointId: "tp-1",
    dealerId: "d-1",
    hasShowcase: true,
    totalPortals: null,
    entrancePortals: 50,
    interiorPortals: 100,
    hardwareSections: null,
    showcaseAreaSqm: null,
    showcaseComment: "",
    tandoorTotalPortals: null,
    tandoorEntrancePortals: null,
    tandoorInteriorPortals: null,
    competitorPortals: null,
    competitorsListed: "",
    fillingComment: "",
    hasExpansionPotential: null,
    additionalPortalsPotential: null,
    showcasePriority: "",
    firstPriorityNeed: "",
    rmRopComment: "",
    updatedAt: new Date().toISOString(),
    updatedBy: "",
    updatedByName: "",
    selectedShowcaseModels: [],
    ...partial,
  };
}

function withFlag(on: boolean, fn: () => void): void {
  resetDistributionDbPrimaryFlagCache();
  seedDistributionDbPrimaryFromBootstrap({ flags: { DISTRIBUTION_DB_PRIMARY_CAPACITY: on } });
  try {
    fn();
  } finally {
    resetDistributionDbPrimaryFlagCache();
  }
}

{
  withFlag(true, () => {
    const sh = baseShowcase({ entrancePortals: 50, interiorPortals: 100 });
    const entries = [
      makePlacementBlock("vh", { placementCapacity: 20 }),
      makePlacementBlock("mk", { placementCapacity: 40 }),
      ...Array.from({ length: 10 }, (_, i) => makeInstalledModel(`tc-vh-e-${i}`)),
      ...Array.from({ length: 20 }, (_, i) => makeInstalledModel(`tc-mk-i-${i}`)),
    ];
    assert.equal(capacityFromMatrixEntries(entries, "entrance"), 20);
    assert.equal(capacityFromMatrixEntries(entries, "interior"), 40);
    const m = computeDistributionForTradePoint(sh, entries);
    assert.equal(m.byType.entrance.capacity, 20);
    assert.equal(m.byType.interior.capacity, 40);
    assert.equal(m.byType.entrance.percent, 50);
    assert.equal(m.byType.interior.percent, 50);
  });
}

{
  withFlag(true, () => {
    const sh = baseShowcase({ entrancePortals: 30, interiorPortals: null });
    const entries = [
      makePlacementBlock("vh", { placementCapacity: 30 }),
      ...Array.from({ length: 5 }, (_, i) => makeInstalledModel(`tc-vh-e-${i}`)),
    ];
    const m = computeDistributionForTradePoint(sh, entries);
    assert.equal(m.byType.entrance.capacity, 30);
    assert.equal(m.byType.entrance.percent, (5 / 30) * 100);
  });
}

{
  withFlag(false, () => {
    const sh = baseShowcase({ entrancePortals: 50, interiorPortals: 100 });
    const entries = [
      makePlacementBlock("vh", { placementCapacity: 20 }),
      makePlacementBlock("mk", { placementCapacity: 40 }),
      ...Array.from({ length: 10 }, (_, i) => makeInstalledModel(`tc-vh-e-${i}`)),
    ];
    const m = computeDistributionForTradePoint(sh, entries);
    assert.equal(m.byType.entrance.capacity, 50);
    assert.equal(m.byType.interior.capacity, 100);
    assert.equal(m.byType.entrance.percent, 20);
  });
}

{
  withFlag(true, () => {
    const sh = baseShowcase({ hasShowcase: false, entrancePortals: 10 });
    const entries = [
      makePlacementBlock("vh", { placementCapacity: 10 }),
      makeInstalledModel("tc-vh-x"),
    ];
    const m = computeDistributionForTradePoint(sh, entries);
    assert.equal(m.hasShowcase, true);
    assert.ok(m.byType.entrance.percent != null);
  });
}

{
  withFlag(true, () => {
    const tpDb = computeDistributionForTradePoint(
      baseShowcase({ tradePointId: "tp-db", entrancePortals: 100 }),
      [
        makePlacementBlock("vh", { placementCapacity: 10, tradePointId: "tp-db" }),
        ...Array.from({ length: 5 }, (_, i) => makeInstalledModel(`tc-vh-db-${i}`, "tp-db")),
      ],
    );
    const tpBlob = computeDistributionForTradePoint(
      baseShowcase({ tradePointId: "tp-blob", entrancePortals: 20 }),
      [
        makePlacementBlock("vh", { placementCapacity: 20, tradePointId: "tp-blob" }),
        ...Array.from({ length: 5 }, (_, i) => makeInstalledModel(`tc-vh-bl-${i}`, "tp-blob")),
      ],
    );
    const agg = aggregateDistribution([tpDb, tpBlob]);
    assert.equal(agg.byType.entrance.capacity, 30);
    assert.equal(agg.byType.entrance.tandoorOnShelf, 10);
    assert.ok(Math.abs((agg.byType.entrance.percent ?? 0) - (10 / 30) * 100) < 0.001);
  });
}

{
  resetDistributionDbPrimaryFlagCache();
  seedDistributionDbPrimaryFromBootstrap({ flags: {} });
  try {
    const sh = baseShowcase({ entrancePortals: 50, interiorPortals: 100 });
    const entries = [
      makePlacementBlock("vh", { placementCapacity: 20 }),
      ...Array.from({ length: 10 }, (_, i) => makeInstalledModel(`tc-vh-def-${i}`)),
    ];
    const m = computeDistributionForTradePoint(sh, entries);
    assert.equal(m.byType.entrance.capacity, 20);
    assert.equal(m.byType.interior.capacity, 100);
  } finally {
    resetDistributionDbPrimaryFlagCache();
  }
}

console.log("distribution-db-primary: ok");
