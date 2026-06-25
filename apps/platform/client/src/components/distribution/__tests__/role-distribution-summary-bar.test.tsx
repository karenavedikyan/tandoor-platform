/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RoleDistributionSummaryBar } from "../role-distribution-summary-bar";
import type { DistributionGroupMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";

const aggregate: DistributionGroupMetrics = {
  byType: {
    entrance: { capacity: 10, tandoorOnShelf: 3, percent: 30 },
    interior: { capacity: 8, tandoorOnShelf: 2, percent: 25 },
    hardware: { capacity: 5, tandoorOnShelf: 1, percent: 20 },
  },
  averagePercent: 25,
  tradePointsCount: 4,
};

function renderBar(access: DealerBaseAccessRole, testIdPrefix = "summary") {
  return render(
    <RoleDistributionSummaryBar
      access={access}
      aggregate={aggregate}
      tradePointsCount={4}
      testIdPrefix={testIdPrefix}
      showTradePointsCount={false}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("RoleDistributionSummaryBar", () => {
  it.each([
    ["sales_manager", "Моя дистрибуция"],
    ["team_lead", "Дистрибуция команды"],
    ["sales_director", "Дистрибуция по региону"],
  ] as const)("renders heading for access %s", (access, title) => {
    const { getByRole } = renderBar(access);
    expect(getByRole("heading", { level: 2, name: title })).toBeTruthy();
  });

  it("renders distribution tiles with testIdPrefix", () => {
    const { getByTestId } = renderBar("team_lead", "trade-points");
    expect(getByTestId("section-trade-points-distribution")).toBeTruthy();
    expect(getByTestId("tile-trade-points-distribution-entrance")).toBeTruthy();
    expect(getByTestId("tile-trade-points-distribution-interior")).toBeTruthy();
    expect(getByTestId("tile-trade-points-distribution-hardware")).toBeTruthy();
  });
});
