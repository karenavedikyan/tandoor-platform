/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __clearDistributionScopePrefetchKeys } from "@/lib/distribution-scope-prefetch-guard";
import { createEmptyActualizationState, type ActualizationState } from "@/lib/client-base-actualization-state";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import { SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import {
  hasMatrixCacheForTradePointIds,
  LOADING_DEADLINE_MS,
  useTradePointDistributionAggregate,
} from "@/hooks/use-trade-point-distribution-aggregate";

const fetchShowcaseMatrixScopeMock = vi.hoisted(() => vi.fn(async () => [] as ShowcaseMatrixEntryDto[]));
const loadCachedMatrixMock = vi.hoisted(() => vi.fn((_tradePointId?: string) => [] as ShowcaseMatrixEntryDto[]));
const applyScopeEntriesToMatrixCacheMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/showcase-matrix-api", () => ({
  fetchShowcaseMatrixScope: fetchShowcaseMatrixScopeMock,
}));

vi.mock("@/lib/showcase-matrix-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/showcase-matrix-store")>();
  return {
    ...actual,
    applyScopeEntriesToMatrixCache: applyScopeEntriesToMatrixCacheMock,
    loadCachedMatrix: loadCachedMatrixMock,
    SHOWCASE_MATRIX_STORE_CHANGED_EVENT: "showcase-matrix-store-changed",
  };
});

function makePlacement(tradePointId: string, capacity = 10): ShowcaseMatrixEntryDto {
  return {
    id: `p-vh-${tradePointId}`,
    dealerId: "d1",
    tradePointId,
    targetKind: "placement",
    targetId: "placement-vh",
    status: "installed",
    comment: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByName: null,
    placementType: "book",
    placementSegment: "vh",
    placementCapacity: capacity,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
    placementLegacyOurs: null,
  };
}

function makeInstalledModel(tradePointId: string): ShowcaseMatrixEntryDto {
  return {
    id: `m-${tradePointId}`,
    dealerId: "d1",
    tradePointId,
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
}

function makeAct(tradePointId = "tp-1"): ActualizationState {
  const state = createEmptyActualizationState();
  state.tradePointShowcaseActualizationById[tradePointId] = {
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
  return state;
}

describe("useTradePointDistributionAggregate scope prefetch", () => {
  beforeEach(() => {
    __clearDistributionScopePrefetchKeys();
    fetchShowcaseMatrixScopeMock.mockClear();
    loadCachedMatrixMock.mockClear();
    applyScopeEntriesToMatrixCacheMock.mockClear();
    fetchShowcaseMatrixScopeMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 50)),
    );
    loadCachedMatrixMock.mockReturnValue([]);
  });

  it("does not prefetch when scope exceeds threshold", async () => {
    const ids = Array.from({ length: 2501 }, (_, i) => `tp-${i}`);
    renderHook(() => useTradePointDistributionAggregate(ids, makeAct()));
    await waitFor(() => {
      expect(fetchShowcaseMatrixScopeMock).not.toHaveBeenCalled();
    });
  });

  it("prefetches once for small scope and ignores store changed event", async () => {
    const { rerender } = renderHook(() => useTradePointDistributionAggregate(["tp-1"], makeAct()));

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
    const placementEntry = makePlacement("tp-0");
    const installedEntry = makeInstalledModel("tp-0");
    loadCachedMatrixMock.mockImplementation((tpId?: string) =>
      tpId === "tp-0" ? [placementEntry, installedEntry] : [],
    );

    const ids = Array.from({ length: 2501 }, (_, i) => `tp-${i}`);
    const { result } = renderHook(() => useTradePointDistributionAggregate(ids, makeAct("tp-0")));

    expect(fetchShowcaseMatrixScopeMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.aggregate.byType.entrance.tandoorOnShelf).toBeGreaterThan(0);
  });
});

describe("useTradePointDistributionAggregate skipInternalPrefetch", () => {
  beforeEach(() => {
    __clearDistributionScopePrefetchKeys();
    fetchShowcaseMatrixScopeMock.mockClear();
    loadCachedMatrixMock.mockClear();
    loadCachedMatrixMock.mockReturnValue([]);
    fetchShowcaseMatrixScopeMock.mockResolvedValue([]);
  });

  it("does not call fetch when skipInternalPrefetch is true", async () => {
    renderHook(() =>
      useTradePointDistributionAggregate(["tp-1"], makeAct(), undefined, {
        skipInternalPrefetch: true,
        externalPrefetching: true,
      }),
    );

    await waitFor(() => {
      expect(fetchShowcaseMatrixScopeMock).not.toHaveBeenCalled();
    });
  });

  it("shows loading on cold external prefetch without cache", () => {
    const { result } = renderHook(() =>
      useTradePointDistributionAggregate(["tp-ext"], makeAct("tp-ext"), undefined, {
        skipInternalPrefetch: true,
        externalPrefetching: true,
      }),
    );

    expect(result.current.loading).toBe(true);
  });

  it("keeps loading=false after cache event when skipInternalPrefetch", async () => {
    const { result, rerender } = renderHook(
      ({ externalPrefetching }) =>
        useTradePointDistributionAggregate(["tp-1"], makeAct(), undefined, {
          skipInternalPrefetch: true,
          externalPrefetching,
        }),
      { initialProps: { externalPrefetching: true } },
    );

    expect(result.current.loading).toBe(true);

    loadCachedMatrixMock.mockImplementation((tpId?: string) =>
      tpId === "tp-1" ? [makePlacement("tp-1", 6)] : [],
    );

    rerender({ externalPrefetching: false });
    act(() => {
      window.dispatchEvent(new Event(SHOWCASE_MATRIX_STORE_CHANGED_EVENT));
    });
    rerender({ externalPrefetching: false });

    expect(result.current.loading).toBe(false);
    expect(result.current.aggregate.byType.entrance.capacity).toBe(6);
  });
});

describe("useTradePointDistributionAggregate SWR", () => {
  beforeEach(() => {
    __clearDistributionScopePrefetchKeys();
    fetchShowcaseMatrixScopeMock.mockClear();
    loadCachedMatrixMock.mockClear();
    applyScopeEntriesToMatrixCacheMock.mockClear();
    fetchShowcaseMatrixScopeMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 50)),
    );
    loadCachedMatrixMock.mockReturnValue([]);
  });

  it("shows cached aggregate immediately with loading=false while prefetch runs", async () => {
    const placementEntry = makePlacement("tp-1", 12);
    const installedEntry = makeInstalledModel("tp-1");
    loadCachedMatrixMock.mockImplementation((tpId?: string) =>
      tpId === "tp-1" ? [placementEntry, installedEntry] : [],
    );

    expect(hasMatrixCacheForTradePointIds(["tp-1"])).toBe(true);

    const { result } = renderHook(() => useTradePointDistributionAggregate(["tp-1"], makeAct()));

    expect(result.current.loading).toBe(false);
    expect(result.current.aggregate.byType.entrance.capacity).toBe(12);
    expect(fetchShowcaseMatrixScopeMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.revalidating).toBe(false);
    });
    expect(result.current.loading).toBe(false);
  });

  it("cold load shows loading=true until prefetch completes", async () => {
    const { result } = renderHook(() => useTradePointDistributionAggregate(["tp-cold"], makeAct("tp-cold")));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("cache-changed event keeps loading=false when data was already shown", async () => {
    const placementEntry = makePlacement("tp-1", 8);
    loadCachedMatrixMock.mockImplementation((tpId?: string) => (tpId === "tp-1" ? [placementEntry] : []));

    const { result, rerender } = renderHook(() => useTradePointDistributionAggregate(["tp-1"], makeAct()));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    loadCachedMatrixMock.mockImplementation((tpId?: string) =>
      tpId === "tp-1" ? [placementEntry, makeInstalledModel("tp-1")] : [],
    );

    act(() => {
      window.dispatchEvent(new Event(SHOWCASE_MATRIX_STORE_CHANGED_EVENT));
    });
    rerender();

    expect(result.current.loading).toBe(false);
    expect(result.current.aggregate.byType.entrance.tandoorOnShelf).toBeGreaterThan(0);
  });

  it("scope change with cache does not reset to cold loading", async () => {
    loadCachedMatrixMock.mockImplementation((tpId?: string) => {
      if (tpId === "tp-a" || tpId === "tp-b") return [makePlacement(tpId!, 5)];
      return [];
    });

    const { result, rerender } = renderHook(
      ({ ids }) => useTradePointDistributionAggregate(ids, makeAct(ids[0])),
      { initialProps: { ids: ["tp-a"] as string[] } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    rerender({ ids: ["tp-b"] });

    expect(result.current.loading).toBe(false);
    expect(result.current.aggregate.byType.entrance.capacity).toBe(5);
  });
});

describe("useTradePointDistributionAggregate loading deadline", () => {
  beforeEach(() => {
    __clearDistributionScopePrefetchKeys();
    fetchShowcaseMatrixScopeMock.mockClear();
    loadCachedMatrixMock.mockClear();
    loadCachedMatrixMock.mockReturnValue([]);
    fetchShowcaseMatrixScopeMock.mockImplementation(
      () =>
        new Promise(() => {
          /* never settles */
        }),
    );
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops cold loading after deadline while external prefetching stays true", async () => {
    const { result } = renderHook(() =>
      useTradePointDistributionAggregate(["tp-deadline"], makeAct("tp-deadline"), undefined, {
        skipInternalPrefetch: true,
        externalPrefetching: true,
      }),
    );

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOADING_DEADLINE_MS);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.tradePointsCount).toBe(1);
  });
});
