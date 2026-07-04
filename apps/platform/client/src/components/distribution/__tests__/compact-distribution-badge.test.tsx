/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { CompactDistributionBadge } from "../compact-distribution-badge";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import type { DistributionGroupMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";

const useTradePointDistributionAggregateMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-trade-point-distribution-aggregate", () => ({
  useTradePointDistributionAggregate: useTradePointDistributionAggregateMock,
}));

const aggregate: DistributionGroupMetrics = {
  byType: {
    entrance: { capacity: 10, tandoorOnShelf: 3, legacyOurs: 1, percent: 30, rotationPotentialPercent: 10 },
    interior: { capacity: 8, tandoorOnShelf: 2, legacyOurs: 0, percent: 25, rotationPotentialPercent: null },
    hardware: { capacity: 5, tandoorOnShelf: 1, legacyOurs: 0, percent: 20, rotationPotentialPercent: null },
  },
  averagePercent: 42,
  rotationPotentialPercent: 10,
  totalLegacyOurs: 1,
  tradePointsCount: 2,
};

const act = createEmptyActualizationState();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CompactDistributionBadge", () => {
  it("renders percent badge with aggregate averagePercent", () => {
    useTradePointDistributionAggregateMock.mockReturnValue({
      aggregate,
      loading: false,
    });

    const { getByTestId, getByText } = render(
      <CompactDistributionBadge
        externalKeys={["tp-1", "tp-2"]}
        act={act}
        testId="compact-dist"
      />,
    );

    expect(getByTestId("compact-dist")).toBeTruthy();
    expect(getByText("Дистр")).toBeTruthy();
    expect(getByText("42%")).toBeTruthy();
    expect(useTradePointDistributionAggregateMock).toHaveBeenCalledWith(
      ["tp-1", "tp-2"],
      act,
      undefined,
      { skipInternalPrefetch: false },
    );
  });

  it("returns null when externalKeys is empty", () => {
    const { container } = render(
      <CompactDistributionBadge externalKeys={[]} act={act} testId="compact-dist" />,
    );

    expect(container.firstChild).toBeNull();
    expect(useTradePointDistributionAggregateMock).not.toHaveBeenCalled();
  });

  it("shows loader while loading", () => {
    useTradePointDistributionAggregateMock.mockReturnValue({
      aggregate,
      loading: true,
    });

    const { getByTestId } = render(
      <CompactDistributionBadge externalKeys={["tp-1"]} act={act} testId="compact-dist" />,
    );

    expect(getByTestId("compact-dist-loading")).toBeTruthy();
  });
});
