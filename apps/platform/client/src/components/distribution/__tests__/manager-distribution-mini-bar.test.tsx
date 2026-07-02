/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ManagerDistributionMiniBar } from "../manager-distribution-mini-bar";
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
  averagePercent: 25,
  rotationPotentialPercent: 10,
  totalLegacyOurs: 1,
  tradePointsCount: 4,
};

const act = createEmptyActualizationState();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ManagerDistributionMiniBar", () => {
  it("renders nothing when externalKeys is empty", () => {
    const { container } = render(
      <ManagerDistributionMiniBar
        externalKeys={[]}
        act={act}
        prefetching={false}
        testId="mgr-dist"
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(useTradePointDistributionAggregateMock).not.toHaveBeenCalled();
  });

  it("renders compact loader while loading", () => {
    useTradePointDistributionAggregateMock.mockReturnValue({
      aggregate,
      loading: true,
    });
    const { getByTestId } = render(
      <ManagerDistributionMiniBar
        externalKeys={["ek-1"]}
        act={act}
        prefetching
        testId="mgr-dist"
      />,
    );
    expect(getByTestId("mgr-dist-loading")).toBeTruthy();
    expect(useTradePointDistributionAggregateMock).toHaveBeenCalledWith(
      ["ek-1"],
      act,
      undefined,
      { skipInternalPrefetch: true, externalPrefetching: true },
    );
  });

  it("renders type badges and rotation when data is ready", () => {
    useTradePointDistributionAggregateMock.mockReturnValue({
      aggregate,
      loading: false,
    });
    const { getByTestId, getByText } = render(
      <ManagerDistributionMiniBar
        externalKeys={["ek-1", "ek-2"]}
        act={act}
        prefetching={false}
        testId="mgr-dist"
      />,
    );
    expect(getByTestId("mgr-dist")).toBeTruthy();
    expect(getByText("ВХ")).toBeTruthy();
    expect(getByText("МК")).toBeTruthy();
    expect(getByText("Фурн")).toBeTruthy();
    expect(getByText("Ротация")).toBeTruthy();
    expect(getByTestId("mgr-dist-rotation")).toBeTruthy();
  });
});
