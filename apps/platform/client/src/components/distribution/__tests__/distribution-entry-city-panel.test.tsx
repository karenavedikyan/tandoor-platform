/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import * as hashLocationRouter from "@/lib/hash-location-router";
import { DistributionEntryCityPanel } from "@/components/distribution/distribution-entry-city-panel";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

const profile: ReleaseDemoProfile = { role: "sales_manager", personaUserId: "mgr-1" };

const mockDesktopLayout = vi.hoisted(() => ({ value: true }));

function makeDealer(tradePointId: string, city: string): DealerRow {
  return {
    id: `dealer-${tradePointId}`,
    name: "Клиент тест",
    city,
    region: "ЦФО",
    status: "активный",
    clientCategory: "top350",
    tradePoints: [
      {
        id: tradePointId,
        name: `ТТ ${tradePointId}`,
        city,
        address: "",
        status: "активный",
      },
    ],
  } as DealerRow;
}

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ user: null }),
  displayUserName: () => "Test User",
}));

vi.mock("@/lib/distribution-entry-element-virtualizer", () => ({
  DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE: { simpleRow: 56 },
  distributionEntryVirtualItemStyle: () => ({}),
  useDistributionEntryDesktopLayout: () => mockDesktopLayout.value,
  useDistributionEntryVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      count > 0 ? [{ key: "0", index: 0, start: 0, size: 56, lane: 0 }] : [],
    getTotalSize: () => (count > 0 ? 56 : 0),
    measureElement: vi.fn(),
  }),
}));

vi.mock("@/components/distribution/distribution-tradepoint-matrix-entry", () => ({
  DistributionTradePointMatrixEntry: () => (
    <div data-testid="distribution-tradepoint-matrix-entry" />
  ),
  coverageBadgeClass: () => "",
  freshnessLabel: () => "—",
}));

vi.mock("@/components/diag/distribution-refresh-diag", () => ({
  DistributionRefreshDiag: () => null,
}));

vi.mock("@/lib/diag-distribution-refresh-enabled", () => ({
  useDistributionRefreshDiagEnabled: () => false,
}));

describe("DistributionEntryCityPanel oneCStoreNavigation", () => {
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockDesktopLayout.value = true;
    navigateSpy = vi.spyOn(hashLocationRouter, "navigateHashPathInHash");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("navigates to /1c/store on trade point click and does not render inline showcase", () => {
    const tpId = "one-c-tp-uuid-1";
    const dealers = [makeDealer(tpId, "Москва")];

    render(
      <DistributionEntryCityPanel profile={profile} dealers={dealers} oneCStoreNavigation />,
    );

    fireEvent.click(screen.getByTestId("distribution-entry-city-row-Москва"));
    fireEvent.click(screen.getByTestId(`distribution-entry-city-tp-${tpId}`));

    expect(navigateSpy).toHaveBeenCalledWith(`/1c/store/${encodeURIComponent(tpId)}`);
    expect(screen.queryByTestId("distribution-tradepoint-matrix-entry")).toBeNull();
  });

  it("renders inline showcase when oneCStoreNavigation is false", () => {
    const tpId = "legacy-tp-1";
    const dealers = [makeDealer(tpId, "Казань")];

    render(
      <DistributionEntryCityPanel profile={profile} dealers={dealers} oneCStoreNavigation={false} />,
    );

    fireEvent.click(screen.getByTestId("distribution-entry-city-row-Казань"));
    fireEvent.click(screen.getByTestId(`distribution-entry-city-tp-${tpId}`));

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("distribution-tradepoint-matrix-entry")).toBeTruthy();
  });
});
