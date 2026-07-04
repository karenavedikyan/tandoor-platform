/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RoleDistributionSummaryBar } from "../role-distribution-summary-bar";

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

function mockSnapshotRange() {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        currentByTradePointId: {},
        baselineByTradePointId: {},
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RoleDistributionSummaryBar titleOverride", () => {
  it("renders titleOverride instead of access title", () => {
    mockSnapshotRange();
    const { getByRole } = render(
      <RoleDistributionSummaryBar
        access="team_lead"
        aggregate={emptyAggregate}
        tradePointsCount={0}
        tradePointIds={[]}
        testIdPrefix="probe"
        titleOverride="Дистрибуция менеджера"
      />,
    );
    expect(getByRole("heading", { name: "Дистрибуция менеджера" })).toBeTruthy();
  });

  it("falls back to access title when titleOverride is undefined", () => {
    mockSnapshotRange();
    const { getByRole } = render(
      <RoleDistributionSummaryBar
        access="team_lead"
        aggregate={emptyAggregate}
        tradePointsCount={0}
        tradePointIds={[]}
        testIdPrefix="probe"
      />,
    );
    expect(getByRole("heading", { name: "Дистрибуция команды" })).toBeTruthy();
  });
});
