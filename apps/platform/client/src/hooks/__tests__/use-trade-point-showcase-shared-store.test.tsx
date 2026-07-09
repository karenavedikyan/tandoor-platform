/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  __clearTradePointShowcaseSharedStoreCacheForTests,
  useTradePointShowcaseSharedStore,
} from "@/hooks/use-trade-point-showcase-shared-store";
import { SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import type { TradePointShowcaseActualization } from "@/lib/client-base-actualization-state";

const fetchBatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trade-point-showcase-shared-api", () => ({
  fetchTradePointShowcaseBatch: fetchBatchMock,
}));

function makeShowcase(tradePointId: string): TradePointShowcaseActualization {
  return {
    tradePointId,
    dealerId: "d-1",
    hasShowcase: true,
    totalPortals: 5,
    entrancePortals: 5,
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
    updatedAt: "2026-07-05T12:00:00.000Z",
    updatedBy: "user-1",
    updatedByName: "Test",
  };
}

afterEach(() => {
  fetchBatchMock.mockReset();
  __clearTradePointShowcaseSharedStoreCacheForTests();
});

describe("useTradePointShowcaseSharedStore", () => {
  it("returns ready=true after successful batch fetch", async () => {
    fetchBatchMock.mockResolvedValue([
      {
        tradePointId: "tp-1",
        dealerId: "d-1",
        data: makeShowcase("tp-1"),
        updatedAt: "2026-07-05T12:00:00.000Z",
        updatedBy: "user-1",
        updatedByName: "Test",
      },
    ]);

    const { result } = renderHook(() => useTradePointShowcaseSharedStore(["tp-1"]));

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(fetchBatchMock).toHaveBeenCalledWith(["tp-1"]);
    expect(result.current.recordByTradePointId["tp-1"]?.entrancePortals).toBe(5);
  });

  it("refetches after SHOWCASE_MATRIX_STORE_CHANGED_EVENT", async () => {
    fetchBatchMock.mockResolvedValue([]);

    const { result } = renderHook(() => useTradePointShowcaseSharedStore(["tp-1"]));

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    const callsBeforeEvent = fetchBatchMock.mock.calls.length;
    expect(callsBeforeEvent).toBeGreaterThanOrEqual(1);

    act(() => {
      window.dispatchEvent(new Event(SHOWCASE_MATRIX_STORE_CHANGED_EVENT));
    });

    await waitFor(() => {
      expect(fetchBatchMock.mock.calls.length).toBeGreaterThan(callsBeforeEvent);
    });
  });
});
