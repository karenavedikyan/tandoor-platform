/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { RoleDistributionSummaryBar } from "../role-distribution-summary-bar";
import type { DistributionGroupMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";

const aggregate: DistributionGroupMetrics = {
  byType: {
    entrance: { capacity: 10, tandoorOnShelf: 3, legacyOurs: 0, percent: 30, rotationPotentialPercent: null },
    interior: { capacity: 8, tandoorOnShelf: 2, legacyOurs: 0, percent: 25, rotationPotentialPercent: null },
    hardware: { capacity: 5, tandoorOnShelf: 1, legacyOurs: 0, percent: 20, rotationPotentialPercent: null },
  },
  averagePercent: 25,
  rotationPotentialPercent: null,
  totalLegacyOurs: 0,
  tradePointsCount: 4,
};

function mockSnapshotRange(deltaEntrance: number | null) {
  const current = {
    entrance: { capacity: 10, onShelf: deltaEntrance != null ? 5 : 0 },
    interior: { capacity: 8, onShelf: 2 },
    hardware: { capacity: 5, onShelf: 1 },
  };
  const baseline = {
    entrance: { capacity: 10, onShelf: deltaEntrance != null ? 4 : 0 },
    interior: { capacity: 8, onShelf: 2 },
    hardware: { capacity: 5, onShelf: 1 },
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        currentByTradePointId: { "tp-1": current },
        baselineByTradePointId: { "tp-1": baseline },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

function renderBar(access: DealerBaseAccessRole, testIdPrefix = "summary") {
  return render(
    <RoleDistributionSummaryBar
      access={access}
      aggregate={aggregate}
      tradePointsCount={4}
      tradePointIds={["tp-1"]}
      testIdPrefix={testIdPrefix}
      showTradePointsCount={false}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RoleDistributionSummaryBar", () => {
  it.each([
    ["sales_manager", "Моя дистрибуция"],
    ["team_lead", "Дистрибуция команды"],
    ["sales_director", "Дистрибуция по региону"],
  ] as const)("renders heading for access %s", (access, title) => {
    mockSnapshotRange(null);
    const { getByRole } = renderBar(access);
    expect(getByRole("heading", { level: 2, name: title })).toBeTruthy();
  });

  it("renders distribution tiles with testIdPrefix", () => {
    mockSnapshotRange(null);
    const { getByTestId } = renderBar("team_lead", "trade-points");
    expect(getByTestId("section-trade-points-distribution")).toBeTruthy();
    expect(getByTestId("tile-trade-points-distribution-entrance")).toBeTruthy();
    expect(getByTestId("tile-trade-points-distribution-interior")).toBeTruthy();
    expect(getByTestId("tile-trade-points-distribution-hardware")).toBeTruthy();
  });

  it("renders positive delta with up arrow", async () => {
    mockSnapshotRange(10);
    const { getByTestId } = renderBar("team_lead", "trade-points");
    await waitFor(() => {
      expect(getByTestId("tile-trade-points-distribution-entrance-delta").textContent).toContain("↑");
    });
    expect(getByTestId("tile-trade-points-distribution-entrance-delta").textContent).toContain("+10.0 пп");
  });

  it("renders period switcher buttons and changes active state", async () => {
    mockSnapshotRange(0);
    const { getByTestId } = renderBar("team_lead", "trade-points");
    expect(getByTestId("button-trade-points-distribution-period-30").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(getByTestId("button-trade-points-distribution-period-7"));
    await waitFor(() => {
      expect(getByTestId("button-trade-points-distribution-period-7").getAttribute("aria-pressed")).toBe("true");
    });
    expect(getByTestId("button-trade-points-distribution-period-30").getAttribute("aria-pressed")).toBe("false");
    expect(getByTestId("tile-trade-points-distribution-entrance-delta")).toBeTruthy();
  });

  it("renders loading placeholder instead of zero metrics when loading=true", () => {
    const { getByTestId, queryByTestId } = render(
      <RoleDistributionSummaryBar
        access="team_lead"
        aggregate={aggregate}
        tradePointsCount={0}
        tradePointIds={[]}
        testIdPrefix="trade-points"
        showTradePointsCount={false}
        loading
      />,
    );
    expect(getByTestId("section-trade-points-distribution-loading")).toBeTruthy();
    expect(queryByTestId("tile-trade-points-distribution-entrance")).toBeNull();
    expect(queryByTestId("tile-trade-points-rotation")).toBeNull();
  });

  it("renders rotation tile with count and percent when legacy present", () => {
    mockSnapshotRange(null);
    const rotationAggregate: DistributionGroupMetrics = {
      ...aggregate,
      totalLegacyOurs: 7,
      rotationPotentialPercent: 35,
      byType: {
        ...aggregate.byType,
        interior: {
          ...aggregate.byType.interior,
          legacyOurs: 7,
          rotationPotentialPercent: 35,
        },
      },
    };
    const { getByTestId } = render(
      <RoleDistributionSummaryBar
        access="team_lead"
        aggregate={rotationAggregate}
        tradePointsCount={4}
        tradePointIds={["tp-1"]}
        testIdPrefix="trade-points"
        showTradePointsCount={false}
      />,
    );
    const tile = getByTestId("tile-trade-points-rotation");
    expect(tile.textContent).toContain("35%");
    expect(tile.textContent).toContain("Неактуальные: 7 шт");
  });
});
