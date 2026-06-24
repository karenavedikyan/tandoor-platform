import { describe, expect, it } from "vitest";
import {
  mergeActualizationStates,
  recordRecencyMs,
} from "../../../shared/actualization-state-merge.js";

function showcase(id: string, updatedAt: string) {
  return { tradePointId: id, updatedAt, distributionPct: 50 };
}

function dealerOv(id: string, updatedAt: string) {
  return { dealerId: id, updatedAt, fields: { name: `dealer-${id}` } };
}

function tpOv(id: string, updatedAt: string) {
  return { tradePointId: id, updatedAt, fields: { address: "addr" } };
}

function stateWith(
  updatedAt: string,
  updatedBy: string,
  partial: Record<string, unknown>,
): Record<string, unknown> {
  return {
    version: 1,
    updatedAt,
    updatedBy,
    clientCategoryOverridesById: {},
    dealerOverridesById: {},
    manuallyCreatedDealersById: {},
    tradePointOverridesById: {},
    manuallyCreatedTradePointsById: {},
    archivedLegalEntitiesById: {},
    legalEntityOverridesByDealerId: {},
    dealerCardViewSettingsByUserId: {},
    dealerActualizationContactsById: {},
    archivedDealerContactsById: {},
    tradePointShowcaseActualizationById: {},
    dealerActualizationAuditByDealerId: {},
    unloadingOrderByDealerId: {},
    routeOrderByRouteId: {},
    dealerPhotosByDealerId: {},
    tradePointPhotosByTradePointId: {},
    trashedDealersById: {},
    trashedTradePointsById: {},
    ...partial,
  };
}

describe("mergeActualizationStates last-write-wins", () => {
  it("picks newer tradePointShowcaseActualizationById regardless of state order", () => {
    const older = stateWith("2026-06-01T10:00:00.000Z", "user-a", {
      tradePointShowcaseActualizationById: {
        "tp-1": showcase("tp-1", "2026-06-01T08:00:00.000Z"),
      },
    });
    const newer = stateWith("2026-06-02T10:00:00.000Z", "user-b", {
      tradePointShowcaseActualizationById: {
        "tp-1": showcase("tp-1", "2026-06-02T12:00:00.000Z"),
      },
    });

    const forward = mergeActualizationStates([older, newer]);
    const reverse = mergeActualizationStates([newer, older]);

    const expected = showcase("tp-1", "2026-06-02T12:00:00.000Z");
    expect(forward.tradePointShowcaseActualizationById).toEqual({ "tp-1": expected });
    expect(reverse.tradePointShowcaseActualizationById).toEqual({ "tp-1": expected });
  });

  it("falls back to snapshot updatedAt when record has no updatedAt", () => {
    const staleSnapshot = stateWith("2026-06-01T10:00:00.000Z", "user-a", {
      tradePointOverridesById: {
        "tp-2": { tradePointId: "tp-2", fields: { city: "old" } },
      },
    });
    const freshSnapshot = stateWith("2026-06-10T10:00:00.000Z", "user-b", {
      tradePointOverridesById: {
        "tp-2": { tradePointId: "tp-2", fields: { city: "new" } },
      },
    });

    const merged = mergeActualizationStates([staleSnapshot, freshSnapshot]);
    expect(merged.tradePointOverridesById).toEqual({
      "tp-2": { tradePointId: "tp-2", fields: { city: "new" } },
    });
    expect(recordRecencyMs({ tradePointId: "tp-2" }, "2026-06-10T10:00:00.000Z")).toBe(
      Date.parse("2026-06-10T10:00:00.000Z"),
    );
  });

  it("keeps existing record on equal effective time (deterministic tie)", () => {
    const sameTime = "2026-06-05T10:00:00.000Z";
    const a = stateWith(sameTime, "user-a", {
      dealerOverridesById: { "d-1": dealerOv("d-1", sameTime) },
    });
    const b = stateWith(sameTime, "user-b", {
      dealerOverridesById: {
        "d-1": { dealerId: "d-1", updatedAt: sameTime, fields: { name: "other" } },
      },
    });

    const merged = mergeActualizationStates([a, b]);
    expect(merged.dealerOverridesById).toEqual(a.dealerOverridesById);
  });

  it("preserves top-level updatedAt max and updatedBy from first snapshot", () => {
    const s0 = stateWith("2026-06-01T00:00:00.000Z", "first-user", {});
    const s1 = stateWith("2026-06-15T00:00:00.000Z", "second-user", {});
    const s2 = stateWith("2026-06-10T00:00:00.000Z", "third-user", {});

    const merged = mergeActualizationStates([s0, s1, s2]);
    expect(merged.updatedAt).toBe("2026-06-15T00:00:00.000Z");
    expect(merged.updatedBy).toBe("first-user");
  });

  it("merges multiple map fields independently", () => {
    const stateA = stateWith("2026-06-01T10:00:00.000Z", "a", {
      tradePointShowcaseActualizationById: {
        "tp-x": showcase("tp-x", "2026-06-10T00:00:00.000Z"),
      },
      dealerOverridesById: {
        "d-x": dealerOv("d-x", "2026-06-01T00:00:00.000Z"),
      },
      tradePointOverridesById: {
        "tp-y": tpOv("tp-y", "2026-06-01T00:00:00.000Z"),
      },
    });
    const stateB = stateWith("2026-06-02T10:00:00.000Z", "b", {
      tradePointShowcaseActualizationById: {
        "tp-x": showcase("tp-x", "2026-06-05T00:00:00.000Z"),
      },
      dealerOverridesById: {
        "d-x": dealerOv("d-x", "2026-06-20T00:00:00.000Z"),
      },
      tradePointOverridesById: {
        "tp-y": tpOv("tp-y", "2026-06-25T00:00:00.000Z"),
      },
    });

    const merged = mergeActualizationStates([stateA, stateB]);
    expect((merged.tradePointShowcaseActualizationById as Record<string, unknown>)["tp-x"]).toEqual(
      showcase("tp-x", "2026-06-10T00:00:00.000Z"),
    );
    expect((merged.dealerOverridesById as Record<string, unknown>)["d-x"]).toEqual(
      dealerOv("d-x", "2026-06-20T00:00:00.000Z"),
    );
    expect((merged.tradePointOverridesById as Record<string, unknown>)["tp-y"]).toEqual(
      tpOv("tp-y", "2026-06-25T00:00:00.000Z"),
    );
  });
});
