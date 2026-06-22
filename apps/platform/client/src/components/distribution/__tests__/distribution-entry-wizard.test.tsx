/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DistributionEntryWizard } from "@/components/distribution/distribution-entry-wizard";

vi.mock("@/hooks/use-distribution-scoped-dealers", () => ({
  useDistributionScopedDealers: () => [],
}));

vi.mock("@/components/distribution/distribution-entry-axis-picker", () => ({
  DistributionEntryAxisPicker: () => <div data-testid="distribution-entry-axis-picker" />,
}));

vi.mock("@/components/distribution/distribution-entry-tradepoint-panel", () => ({
  DistributionEntryTradePointPanel: () => <div data-testid="distribution-entry-tradepoint-panel" />,
}));

vi.mock("@/components/distribution/distribution-entry-product-panel", () => ({
  DistributionEntryProductPanel: () => <div data-testid="distribution-entry-product-panel" />,
}));

vi.mock("@/components/distribution/distribution-entry-city-panel", () => ({
  DistributionEntryCityPanel: () => <div data-testid="distribution-entry-city-panel" />,
}));

vi.mock("@/components/diag/distribution-refresh-diag", () => ({
  DistributionRefreshDiag: () => null,
}));

vi.mock("@/lib/diag-distribution-refresh-enabled", () => ({
  useDistributionRefreshDiagEnabled: () => false,
}));

import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

const profile: ReleaseDemoProfile = { role: "sales_director", personaUserId: "user-dir-goncharenko" };

describe("DistributionEntryWizard controlled axis", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders axis picker when axis is null", () => {
    render(
      <DistributionEntryWizard profile={profile} axis={null} onAxisSelect={() => {}} />,
    );
    expect(screen.getByTestId("distribution-entry-axis-picker")).toBeTruthy();
    expect(screen.queryByTestId("distribution-entry-product-panel")).toBeNull();
  });

  it("renders product panel when axis is product from hash", () => {
    render(
      <DistributionEntryWizard profile={profile} axis="product" onAxisSelect={() => {}} />,
    );
    expect(screen.getByTestId("distribution-entry-product-panel")).toBeTruthy();
    expect(screen.queryByTestId("distribution-entry-axis-picker")).toBeNull();
  });

  it("renders tradepoint panel when axis is tradePoint", () => {
    render(
      <DistributionEntryWizard profile={profile} axis="tradePoint" onAxisSelect={() => {}} />,
    );
    expect(screen.getByTestId("distribution-entry-tradepoint-panel")).toBeTruthy();
  });
});
