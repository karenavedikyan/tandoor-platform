/**
 * Промт 441-fix6: distribution analytics URL routing must not loop on filter apply.
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import {
  deserializeFilters,
  emptyDistributionAnalyticsFilters,
  serializeFilters,
  type DistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import * as filtersModule from "@/lib/distribution-analytics/distribution-analytics-filters";
import * as hashLocationRouter from "@/lib/hash-location-router";
import { useHashLocation } from "@/lib/hash-location-router";
import DistributionPage from "@/pages/distribution";

const krasnodarFilters: DistributionAnalyticsFilters = {
  ...emptyDistributionAnalyticsFilters(),
  cities: ["Краснодар"],
};
const expectedF = serializeFilters(krasnodarFilters);

let analyticsRenderCount = 0;
let latestOnFiltersChange: ((filters: DistributionAnalyticsFilters) => void) | null = null;

vi.mock("@/pages/distribution-analytics", () => ({
  DistributionAnalyticsPage: ({
    onFiltersChange,
  }: {
    onFiltersChange: (filters: DistributionAnalyticsFilters) => void;
  }) => {
    latestOnFiltersChange = onFiltersChange;
    analyticsRenderCount += 1;
    return (
      <div data-testid="page-distribution-analytics">
        <button
          type="button"
          data-testid="button-apply-krasnodar-filter"
          onClick={() => onFiltersChange(krasnodarFilters)}
        >
          Применить
        </button>
      </div>
    );
  },
}));

vi.mock("@/hooks/use-release-demo-profile", () => ({
  useReleaseDemoProfile: () => ({ profile: { role: "admin", personaUserId: "admin-1" } }),
}));

vi.mock("@/hooks/use-distribution-scoped-dealers", () => ({
  useDistributionScopedDealers: () => [],
  useDistributionScopedTradePoints: () => [],
}));

vi.mock("@/components/distribution/distribution-entry-wizard", () => ({
  DistributionEntryWizard: () => <div data-testid="distribution-entry-wizard" />,
}));

function setHashRoute(hash: string): void {
  window.history.replaceState(null, "", `/${hash}`);
}

function TestApp(): JSX.Element {
  return (
    <Router hook={useHashLocation}>
      <Route path="/distribution" component={DistributionPage} />
    </Router>
  );
}

describe("DistributionPage routing loop (441-fix6)", () => {
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  let deserializeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    analyticsRenderCount = 0;
    latestOnFiltersChange = null;
    navigateSpy = vi.spyOn(hashLocationRouter, "navigateHashPathInHash");
    deserializeSpy = vi.spyOn(filtersModule, "deserializeFilters");
    setHashRoute("#/distribution?view=analytics");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps query in hash and bounds analytics renders after filter apply", async () => {
    render(<TestApp />);

    expect(screen.getByTestId("page-distribution-analytics")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-apply-krasnodar-filter"));
    });

    await waitFor(() => {
      expect(window.location.search).toBe("");
      expect(window.location.hash).toBe(
        `#/distribution?view=analytics&tab=trade-points&f=${expectedF}`,
      );
    });

    await waitFor(() => {
      expect(analyticsRenderCount).toBeGreaterThan(0);
      expect(analyticsRenderCount).toBeLessThanOrEqual(5);
    });
  });

  it("does not navigate again when applying the same filter", async () => {
    setHashRoute(`#/distribution?view=analytics&tab=trade-points&f=${expectedF}`);

    render(<TestApp />);
    navigateSpy.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-apply-krasnodar-filter"));
    });

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("does not re-deserialize filters when hashchange fires but f is unchanged", async () => {
    setHashRoute(`#/distribution?view=analytics&tab=trade-points&f=${expectedF}`);

    render(<TestApp />);
    const callsAfterMount = deserializeSpy.mock.calls.length;
    expect(latestOnFiltersChange).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(deserializeSpy.mock.calls.length).toBe(callsAfterMount);
    expect(deserializeFilters(expectedF)).toEqual(krasnodarFilters);
  });
});
