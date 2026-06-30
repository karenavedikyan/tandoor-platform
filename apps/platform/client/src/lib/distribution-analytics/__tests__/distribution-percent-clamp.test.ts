import { describe, expect, it } from "vitest";
import type { TradePointShowcaseActualization } from "../../client-base-actualization-state";
import type { ShowcaseMatrixEntryDto } from "../../showcase-matrix-api";
import {
  aggregateDistribution,
  computeDistributionForTradePoint,
  distributionPercentFromCounts,
} from "../distribution-analytics-math";

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

function baseShowcase(partial: Partial<TradePointShowcaseActualization>): TradePointShowcaseActualization {
  return {
    tradePointId: "tp-1",
    dealerId: "d-1",
    hasShowcase: true,
    totalPortals: null,
    entrancePortals: 11,
    interiorPortals: null,
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

describe("distributionPercentFromCounts", () => {
  it("clamps overflow to 100%", () => {
    expect(distributionPercentFromCounts(14, 11)).toBe(100);
  });

  it("returns normal percent without clamp when within capacity", () => {
    expect(distributionPercentFromCounts(5, 10)).toBe(50);
  });

  it("returns 0 for empty shelf", () => {
    expect(distributionPercentFromCounts(0, 10)).toBe(0);
  });

  it("returns null for zero or missing capacity", () => {
    expect(distributionPercentFromCounts(3, 0)).toBeNull();
    expect(distributionPercentFromCounts(3, null)).toBeNull();
  });
});

describe("aggregateDistribution overflow", () => {
  it("keeps honest counts but clamps displayed percent to 100%", () => {
    const entries = Array.from({ length: 14 }, (_, i) => makeInstalledModel(`tc-vh-${i}`));
    const tp = computeDistributionForTradePoint(
      baseShowcase({ entrancePortals: 11, interiorPortals: null, selectedShowcaseModels: [] }),
      entries,
    );
    expect(tp.byType.entrance.tandoorOnShelf).toBe(14);
    expect(tp.byType.entrance.capacity).toBe(11);
    expect(tp.byType.entrance.percent).toBe(100);

    const agg = aggregateDistribution([tp]);
    expect(agg.byType.entrance.tandoorOnShelf).toBe(14);
    expect(agg.byType.entrance.capacity).toBe(11);
    expect(agg.byType.entrance.percent).toBe(100);
  });
});
