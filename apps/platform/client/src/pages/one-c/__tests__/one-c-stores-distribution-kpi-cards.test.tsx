/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OneCStoresDistributionKpiCards } from "@/pages/one-c/one-c-stores-distribution-kpi-cards";
import type { DistributionGroupMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";

const emptyAggregate: DistributionGroupMetrics = {
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

const filledAggregate: DistributionGroupMetrics = {
  byType: {
    entrance: {
      capacity: 20,
      tandoorOnShelf: 10,
      legacyOurs: 1,
      percent: 50,
      rotationPotentialPercent: 5,
    },
    interior: {
      capacity: 10,
      tandoorOnShelf: 3,
      legacyOurs: 0,
      percent: 30,
      rotationPotentialPercent: 0,
    },
    hardware: {
      capacity: 8,
      tandoorOnShelf: 6,
      legacyOurs: 2,
      percent: 75,
      rotationPotentialPercent: 25,
    },
  },
  averagePercent: 51.67,
  rotationPotentialPercent: 7.89,
  totalLegacyOurs: 3,
  tradePointsCount: 5,
};

afterEach(() => {
  cleanup();
});

describe("OneCStoresDistributionKpiCards", () => {
  it("renders 4 cards with expected testIds", () => {
    render(
      <OneCStoresDistributionKpiCards
        tradePointsCount={12}
        aggregate={emptyAggregate}
        testId="kpi-one-c-stores-distribution"
      />,
    );

    expect(screen.getByTestId("kpi-one-c-stores-distribution")).toBeTruthy();
    expect(screen.getByTestId("kpi-one-c-stores-tp-count")).toBeTruthy();
    expect(screen.getByTestId("kpi-one-c-stores-avg-entrance")).toBeTruthy();
    expect(screen.getByTestId("kpi-one-c-stores-avg-interior")).toBeTruthy();
    expect(screen.getByTestId("kpi-one-c-stores-avg-hardware")).toBeTruthy();
  });

  it("shows dashes for empty aggregate capacities", () => {
    render(<OneCStoresDistributionKpiCards tradePointsCount={3} aggregate={emptyAggregate} />);

    expect(screen.getByTestId("kpi-one-c-stores-avg-entrance").textContent).toContain("—");
    expect(screen.getByTestId("kpi-one-c-stores-avg-interior").textContent).toContain("—");
    expect(screen.getByTestId("kpi-one-c-stores-avg-hardware").textContent).toContain("—");
    expect(screen.getByTestId("kpi-one-c-stores-avg-entrance").textContent).toContain("Σ 0 / Σ 0 слотов");
  });

  it("shows rounded percents and sigma hints for filled aggregate", () => {
    render(<OneCStoresDistributionKpiCards tradePointsCount={5} aggregate={filledAggregate} />);

    expect(screen.getByTestId("kpi-one-c-stores-avg-entrance").textContent).toContain("50%");
    expect(screen.getByTestId("kpi-one-c-stores-avg-entrance").textContent).toContain("Σ 10 / Σ 20 слотов");
    expect(screen.getByTestId("kpi-one-c-stores-avg-interior").textContent).toContain("30%");
    expect(screen.getByTestId("kpi-one-c-stores-avg-interior").textContent).toContain("Σ 3 / Σ 10 слотов");
    expect(screen.getByTestId("kpi-one-c-stores-avg-hardware").textContent).toContain("75%");
    expect(screen.getByTestId("kpi-one-c-stores-avg-hardware").textContent).toContain("Σ 6 / Σ 8 слотов");
  });

  it("formats tradePointsCount with ru-RU separators", () => {
    render(<OneCStoresDistributionKpiCards tradePointsCount={1234} aggregate={emptyAggregate} />);

    expect(screen.getByTestId("kpi-one-c-stores-tp-count").textContent).toContain(
      (1234).toLocaleString("ru-RU"),
    );
  });

  it("shows dashes for percent cards while loading", () => {
    render(
      <OneCStoresDistributionKpiCards tradePointsCount={5} aggregate={filledAggregate} loading />,
    );

    expect(screen.getByTestId("kpi-one-c-stores-tp-count").textContent).toContain("5");
    expect(screen.getByTestId("kpi-one-c-stores-avg-entrance").textContent).toContain("—");
    expect(screen.getByTestId("kpi-one-c-stores-avg-entrance").textContent).toContain("Σ 10 / Σ 20 слотов");
  });
});
