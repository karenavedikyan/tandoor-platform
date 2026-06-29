/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __clearDistributionScopePrefetchKeys } from "@/lib/distribution-scope-prefetch-guard";
import { createEmptyActualizationState, type ActualizationState } from "@/lib/client-base-actualization-state";
import { emptyDistributionAnalyticsFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { DistributionAnalyticsData } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";
import { SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import { useTradePointDistributionAggregate } from "@/hooks/use-trade-point-distribution-aggregate";

const emptyAggregate = {
  byType: {
    entrance: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
    interior: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
    hardware: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
  },
  averagePercent: null,
  rotationPotentialPercent: null,
  totalLegacyOurs: 0,
  tradePointsCount: 0,
};

const fetchShowcaseMatrixScopeMock = vi.hoisted(() => vi.fn(async () => [] as ShowcaseMatrixEntryDto[]));
const loadCachedMatrixMock = vi.hoisted(() => vi.fn((_tradePointId?: string) => [] as ShowcaseMatrixEntryDto[]));
const applyScopeEntriesToMatrixCacheMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/showcase-matrix-api", () => ({
  fetchShowcaseMatrixScope: fetchShowcaseMatrixScopeMock,
}));

vi.mock("@/lib/showcase-matrix-store", () => ({
  applyScopeEntriesToMatrixCache: applyScopeEntriesToMatrixCacheMock,
  loadCachedMatrix: loadCachedMatrixMock,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT: "showcase-matrix-store-changed",
}));

function makeAct(tradePointId = "tp-1"): ActualizationState {
  const act = createEmptyActualizationState();
  act.tradePointShowcaseActualizationById[tradePointId] = {
    tradePointId,
    dealerId: "d1",
    hasShowcase: true,
    totalPortals: 2,
    entrancePortals: 2,
    interiorPortals: 2,
    hardwareSections: 1,
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
    showcasePriority: "medium",
    firstPriorityNeed: "",
    rmRopComment: "",
    updatedAt: "2026-01-01T00:00:00.000Z",
    updatedBy: "",
    updatedByName: "",
  };
  return act;
}

describe("useTradePointDistributionAggregate scope prefetch", () => {
  beforeEach(() => {
    __clearDistributionScopePrefetchKeys();
    fetchShowcaseMatrixScopeMock.mockClear();
    loadCachedMatrixMock.mockClear();
    applyScopeEntriesToMatrixCacheMock.mockClear();
    fetchShowcaseMatrixScopeMock.mockResolvedValue([]);
    loadCachedMatrixMock.mockReturnValue([]);
  });

  it("does not prefetch when scope exceeds threshold", async () => {
    const ids = Array.from({ length: 801 }, (_, i) => `tp-${i}`);
    renderHook(() => useTradePointDistributionAggregate(ids, makeAct()));
    await waitFor(() => {
      expect(fetchShowcaseMatrixScopeMock).not.toHaveBeenCalled();
    });
  });

  it("prefetches once for small scope and ignores store changed event", async () => {
    const { rerender } = renderHook(() =>
      useTradePointDistributionAggregate(["tp-1"], makeAct()),
    );

    await waitFor(() => {
      expect(fetchShowcaseMatrixScopeMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      window.dispatchEvent(new Event("showcase-matrix-store-changed"));
    });
    rerender();

    await waitFor(() => {
      expect(fetchShowcaseMatrixScopeMock).toHaveBeenCalledTimes(1);
    });
  });

  it("aggregates from cache without network for large scope", () => {
    const installedEntry: ShowcaseMatrixEntryDto = {
      id: "e1",
      dealerId: "d1",
      tradePointId: "tp-0",
      targetKind: "model",
      targetId: "tc-vh-model-1",
      status: "installed",
      comment: null,
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      updatedByName: null,
      placementType: null,
      placementSegment: "vh",
      placementCapacity: null,
      placementActual: null,
      placementRef: null,
      placementOurModels: [],
      placementCompetitors: [],
      placementLegacyOurs: null,
    };
    loadCachedMatrixMock.mockImplementation((tpId?: string) => (tpId === "tp-0" ? [installedEntry] : []));

    const ids = Array.from({ length: 801 }, (_, i) => `tp-${i}`);
    const { result } = renderHook(() => useTradePointDistributionAggregate(ids, makeAct("tp-0")));

    expect(fetchShowcaseMatrixScopeMock).not.toHaveBeenCalled();
    expect(result.current.aggregate.byType.entrance.tandoorOnShelf).toBeGreaterThan(0);
  });
});
