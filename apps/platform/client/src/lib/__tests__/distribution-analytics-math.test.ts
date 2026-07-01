/**
 * Запуск: `npm run test:distribution-analytics-math` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { TradePointShowcaseActualization } from "../client-base-actualization-state";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api";
import {
  aggregateDistribution,
  computeDistributionForTradePoint,
  computeModelCoverage,
  distributionPercentTone,
} from "../distribution-analytics/distribution-analytics-math";
import {
  resetDistributionDbPrimaryFlagCache,
  seedDistributionDbPrimaryFromBootstrap,
} from "../distribution-db-primary-flag";

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
  opts: { placementLegacyOurs?: number; placementCapacity?: number },
): ShowcaseMatrixEntryDto {
  return {
    id: `p-${segment}`,
    dealerId: "d-1",
    tradePointId: "tp-1",
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
    placementLegacyOurs: opts.placementLegacyOurs ?? null,
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

{
  const sh = baseShowcase({
    entrancePortals: 50,
    interiorPortals: 100,
    selectedShowcaseModels: [],
  });
  const entries = [
    ...Array.from({ length: 50 }, (_, i) => makeInstalledModel(`tc-vh-e-${i}`)),
    ...Array.from({ length: 70 }, (_, i) => makeInstalledModel(`tc-mk-i-${i}`)),
  ];
  const m = computeDistributionForTradePoint(sh, entries);
  assert.equal(m.byType.entrance.tandoorOnShelf, 50);
  assert.equal(m.byType.interior.tandoorOnShelf, 70);
  assert.equal(m.byType.entrance.percent, 100);
  assert.equal(m.byType.interior.percent, 70);
  assert.equal(m.byType.hardware.percent, null);
  assert.equal(m.averagePercent, 85);
}

{
  const sh = baseShowcase({
    entrancePortals: 10,
    interiorPortals: null,
    hardwareSections: null,
    selectedShowcaseModels: [],
  });
  const entries = Array.from({ length: 5 }, (_, i) => makeInstalledModel(`tc-vh-e-${i}`));
  const m = computeDistributionForTradePoint(sh, entries);
  assert.equal(m.byType.entrance.tandoorOnShelf, 5);
  assert.equal(m.byType.entrance.percent, 50);
  assert.equal(m.averagePercent, 50);
}

{
  const tp1Entries: ShowcaseMatrixEntryDto[] = [];
  const tp2Entries = Array.from({ length: 10 }, (_, i) => makeInstalledModel(`tc-vh-e2-${i}`, "tp-2"));
  const tp1 = computeDistributionForTradePoint(
    baseShowcase({ tradePointId: "tp-1", entrancePortals: 10, interiorPortals: null, selectedShowcaseModels: [] }),
    tp1Entries,
  );
  const tp2 = computeDistributionForTradePoint(
    baseShowcase({
      tradePointId: "tp-2",
      entrancePortals: 20,
      interiorPortals: null,
      selectedShowcaseModels: [],
    }),
    tp2Entries,
  );
  const tp3 = computeDistributionForTradePoint(
    baseShowcase({ tradePointId: "tp-3", entrancePortals: 0, interiorPortals: 5, selectedShowcaseModels: [] }),
    [],
  );
  const agg = aggregateDistribution([tp1, tp2, tp3]);
  assert.equal(agg.byType.entrance.capacity, 30);
  assert.equal(agg.byType.entrance.tandoorOnShelf, 10);
  assert.ok(Math.abs((agg.byType.entrance.percent ?? 0) - (10 / 30) * 100) < 0.001);
}

{
  resetDistributionDbPrimaryFlagCache();
  seedDistributionDbPrimaryFromBootstrap({ flags: { DISTRIBUTION_DB_PRIMARY_CAPACITY: false } });
  try {
    const sh = baseShowcase({ hasShowcase: false, entrancePortals: 10 });
    const m = computeDistributionForTradePoint(sh, [makeInstalledModel("tc-vh-x")]);
    assert.equal(m.hasShowcase, false);
    assert.equal(m.averagePercent, null);
    const agg = aggregateDistribution([m]);
    assert.equal(agg.tradePointsCount, 0);
  } finally {
    resetDistributionDbPrimaryFlagCache();
  }
}

{
  const metrics = [
    computeDistributionForTradePoint(baseShowcase({ tradePointId: "tp-1", entrancePortals: 1 }), []),
    computeDistributionForTradePoint(baseShowcase({ tradePointId: "tp-2", entrancePortals: 1 }), []),
    computeDistributionForTradePoint(baseShowcase({ tradePointId: "tp-3", entrancePortals: 1 }), []),
    computeDistributionForTradePoint(baseShowcase({ tradePointId: "tp-4", entrancePortals: 1 }), []),
    computeDistributionForTradePoint(baseShowcase({ tradePointId: "tp-5", entrancePortals: 1 }), []),
  ];
  const installedMap: Record<string, ShowcaseMatrixEntryDto[]> = {
    "tp-1": [makeInstalledModel("tc-vh-m1", "tp-1")],
    "tp-2": [makeInstalledModel("tc-vh-m1", "tp-2")],
    "tp-3": [],
    "tp-4": [],
    "tp-5": [],
  };
  const cov = computeModelCoverage("tc-vh-m1", "entrance", metrics, installedMap);
  assert.equal(cov.presentTradePoints, 2);
  assert.equal(cov.eligibleTradePoints, 5);
  assert.equal(cov.coveragePercent, 40);
}

{
  const cov = computeModelCoverage("tc-vh-m1", "entrance", [], {});
  assert.equal(cov.coveragePercent, null);
}

{
  const sh = baseShowcase({
    entrancePortals: 8,
    interiorPortals: 12,
    hardwareSections: 10,
    selectedShowcaseModels: Array.from({ length: 99 }, (_, i) => ({
      productId: `legacy-${i}`,
      productName: `L${i}`,
      productType: "Модель",
      selectedAt: new Date().toISOString(),
      selectedBy: "u",
      selectedByName: "U",
      portalType: "entrance" as const,
    })),
  });
  const entries = [
    ...Array.from({ length: 8 }, (_, i) => makeInstalledModel(`tc-vh-installed-${i}`)),
    ...Array.from({ length: 12 }, (_, i) => makeInstalledModel(`tc-mk-installed-${i}`)),
    ...Array.from({ length: 10 }, (_, i) => makeInstalledModel(`tc-hw-installed-${i}`)),
  ];
  const m = computeDistributionForTradePoint(sh, entries);
  assert.equal(m.byType.entrance.tandoorOnShelf, 8);
  assert.equal(m.byType.interior.tandoorOnShelf, 12);
  assert.equal(m.byType.hardware.tandoorOnShelf, 10);
  assert.equal(m.byType.entrance.percent, 100);
  assert.equal(m.byType.interior.percent, 100);
  assert.equal(m.byType.hardware.percent, 100);
}

{
  assert.equal(distributionPercentTone(10), "red");
  assert.equal(distributionPercentTone(14.99), "red");
  assert.equal(distributionPercentTone(15), "yellow");
  assert.equal(distributionPercentTone(39.99), "yellow");
  assert.equal(distributionPercentTone(40), "green");
  assert.equal(distributionPercentTone(100), "green");
  assert.equal(distributionPercentTone(null), "empty");
  assert.equal(distributionPercentTone(Number.NaN), "empty");
}

{
  const sh = baseShowcase({
    entrancePortals: null,
    interiorPortals: 10,
    hardwareSections: null,
    selectedShowcaseModels: [],
  });
  const entries = [makePlacementBlock("mk", { placementLegacyOurs: 3, placementCapacity: 10 })];
  const m = computeDistributionForTradePoint(sh, entries);
  assert.equal(m.byType.interior.legacyOurs, 3);
  assert.ok(Math.abs((m.rotationPotentialPercent ?? 0) - 30) < 0.001);
}

{
  const mkBlock = (legacy: number, tradePointId: string) =>
    ({
      ...makePlacementBlock("mk", { placementLegacyOurs: legacy, placementCapacity: 10 }),
      tradePointId,
    }) as ShowcaseMatrixEntryDto;

  const tp1 = computeDistributionForTradePoint(
    baseShowcase({ tradePointId: "tp-1", entrancePortals: null, interiorPortals: 10, selectedShowcaseModels: [] }),
    [mkBlock(3, "tp-1")],
  );
  const tp2 = computeDistributionForTradePoint(
    baseShowcase({ tradePointId: "tp-2", entrancePortals: null, interiorPortals: 10, selectedShowcaseModels: [] }),
    [mkBlock(2, "tp-2")],
  );
  const agg = aggregateDistribution([tp1, tp2]);
  assert.equal(agg.totalLegacyOurs, 5);
  assert.equal(agg.rotationPotentialPercent, 25);
}

console.log("distribution-analytics-math: ok");
