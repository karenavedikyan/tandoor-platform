import { describe, expect, it } from "vitest";
import { mergeActualizationWithSharedShowcaseStore } from "@/lib/trade-point-showcase-shared-merge";
import { createEmptyActualizationState, type TradePointShowcaseActualization } from "@/lib/client-base-actualization-state";

function makeShowcase(
  tradePointId: string,
  updatedAt: string,
  entrancePortals: number,
): TradePointShowcaseActualization {
  return {
    tradePointId,
    dealerId: "d-1",
    hasShowcase: true,
    totalPortals: entrancePortals,
    entrancePortals,
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
    updatedAt,
    updatedBy: "user-1",
    updatedByName: "Test",
  };
}

describe("mergeActualizationWithSharedShowcaseStore", () => {
  it("uses shared-store record when it is newer than jsonb", () => {
    const act = createEmptyActualizationState();
    act.tradePointShowcaseActualizationById = {
      "tp-1": makeShowcase("tp-1", "2026-07-01T10:00:00.000Z", 3),
    };
    const merged = mergeActualizationWithSharedShowcaseStore(act, {
      "tp-1": makeShowcase("tp-1", "2026-07-05T12:00:00.000Z", 7),
    });
    expect(merged.tradePointShowcaseActualizationById["tp-1"]?.entrancePortals).toBe(7);
  });

  it("keeps jsonb record when it is newer than shared-store", () => {
    const act = createEmptyActualizationState();
    act.tradePointShowcaseActualizationById = {
      "tp-1": makeShowcase("tp-1", "2026-07-05T12:00:00.000Z", 7),
    };
    const merged = mergeActualizationWithSharedShowcaseStore(act, {
      "tp-1": makeShowcase("tp-1", "2026-07-01T10:00:00.000Z", 3),
    });
    expect(merged.tradePointShowcaseActualizationById["tp-1"]?.entrancePortals).toBe(7);
  });

  it("uses shared-store when jsonb has no record", () => {
    const act = createEmptyActualizationState();
    const merged = mergeActualizationWithSharedShowcaseStore(act, {
      "tp-2": makeShowcase("tp-2", "2026-07-02T10:00:00.000Z", 4),
    });
    expect(merged.tradePointShowcaseActualizationById["tp-2"]?.entrancePortals).toBe(4);
  });
});
