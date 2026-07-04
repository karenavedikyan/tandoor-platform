/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScopedTradePointDto } from "@/lib/trade-points-scoped-api";
import {
  BUCKET_TIMEOUT_MS,
  useProgressiveRopDistributionPrefetch,
} from "../use-progressive-rop-distribution-prefetch";

const fetchShowcaseMatrixScopeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/showcase-matrix-api", () => ({
  fetchShowcaseMatrixScope: fetchShowcaseMatrixScopeMock,
}));

vi.mock("@/lib/showcase-matrix-store", () => ({
  applyScopeEntriesToMatrixCache: vi.fn(),
}));

function makeTradePoint(
  id: string,
  ropUserId: string,
  ropFullName: string,
  teamId: string,
): ScopedTradePointDto {
  return {
    id,
    externalKey: id,
    name: `ТТ ${id}`,
    city: "Город",
    address: null,
    format: null,
    isActive: true,
    isPrimary: true,
    importanceTier: null,
    dealerId: `dealer-${id}`,
    dealerExternalKey: `dealer-${id}`,
    dealerName: "Дилер",
    dealerReleaseCode: null,
    dealerCity: null,
    dealerClientCategory: null,
    managerUserId: null,
    managerFullName: null,
    regionalManagerUserId: null,
    regionalManagerFullName: null,
    teamId,
    teamName: ropFullName,
    ropUserId,
    ropFullName,
  };
}

const tradePoints: ScopedTradePointDto[] = [
  makeTradePoint("tp-a1", "rop-a", "РОП A", "team-a"),
  makeTradePoint("tp-b1", "rop-b", "РОП B", "team-b"),
];

describe("useProgressiveRopDistributionPrefetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchShowcaseMatrixScopeMock.mockReset();
    fetchShowcaseMatrixScopeMock.mockImplementation(
      () =>
        new Promise(() => {
          /* never settles */
        }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not block prefetching forever when a bucket fetch never settles", async () => {
    const { result } = renderHook(() => useProgressiveRopDistributionPrefetch(tradePoints, true));

    expect(result.current.prefetching).toBe(true);
    expect(result.current.totalBuckets).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BUCKET_TIMEOUT_MS);
    });
    expect(result.current.loadedBuckets).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BUCKET_TIMEOUT_MS);
    });
    expect(result.current.prefetching).toBe(false);
    expect(result.current.loadedBuckets).toBe(2);
    expect(result.current.totalBuckets).toBe(2);
  });
});
