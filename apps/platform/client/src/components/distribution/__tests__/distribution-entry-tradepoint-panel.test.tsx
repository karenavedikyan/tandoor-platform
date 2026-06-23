/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { defaultDistributionFilterState } from "@/lib/distribution-filters";
import * as hashLocationRouter from "@/lib/hash-location-router";
import { DistributionEntryTradePointPanel } from "@/components/distribution/distribution-entry-tradepoint-panel";
import {
  isEntryDataLoading,
  shouldShowEntryLoadingPlaceholder,
} from "@/components/distribution/distribution-entry-tradepoint-panel";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

const mockActx = vi.hoisted(() => ({
  enabled: false,
  loading: false,
}));

const mockTeamPlane = vi.hoisted(() => ({
  mergedState: {},
  teamFetchLoading: false,
}));

const mockIsMobile = vi.hoisted(() => ({
  value: false,
}));

const mockDesktopLayout = vi.hoisted(() => ({
  value: true,
}));

const profile: ReleaseDemoProfile = { role: "sales_director", personaUserId: "user-dir-goncharenko" };

const filter = defaultDistributionFilterState();

function makeDealer(tradePointId: string, name: string): DealerRow {
  return {
    id: `dealer-${tradePointId}`,
    name: "Клиент тест",
    city: "Москва",
    status: "активный",
    clientCategory: "top350",
    tradePoints: [
      {
        id: tradePointId,
        name,
        city: "Москва",
        address: "",
        status: "активный",
      },
    ],
  } as DealerRow;
}

vi.mock("@/lib/client-base-actualization-data-merge", () => ({
  buildDealerBaseRowsWithActualization: () => [],
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ user: null }),
  displayUserName: () => "Test User",
}));

vi.mock("@/context/client-base-actualization-context", () => ({
  useClientBaseActualization: () => mockActx,
}));

vi.mock("@/context/client-base-team-actualization-context", () => ({
  useClientBaseTeamActualization: () => mockTeamPlane,
}));

vi.mock("@/hooks/use-role-scoped-dealer-rows-auto", () => ({
  useRoleScopedDealerRowsAuto: (rows: readonly DealerRow[]) => rows,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile.value,
}));

vi.mock("@/lib/distribution-entry-tradepoint-view", () => ({
  readDistributionEntryTradePointView: () => "list",
  writeDistributionEntryTradePointView: vi.fn(),
}));

vi.mock("@/lib/distribution-entry-element-virtualizer", () => ({
  DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE: {
    tradepointLarge: 120,
    tradepointGridRow: 100,
    tradepointList: 72,
  },
  distributionEntryVirtualItemStyle: () => ({}),
  useDistributionEntryDesktopLayout: () => mockDesktopLayout.value,
  useDistributionEntryTradepointGridLanes: () => 2,
  useDistributionEntryVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      count > 0 ? [{ key: "0", index: 0, start: 0, size: 72, lane: 0 }] : [],
    getTotalSize: () => (count > 0 ? 72 : 0),
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  }),
}));

vi.mock("@/components/distribution/distribution-tradepoint-matrix-entry", () => ({
  DistributionTradePointMatrixEntry: () => (
    <div data-testid="distribution-tradepoint-matrix-entry" />
  ),
  coverageBadgeClass: () => "",
  freshnessLabel: () => "—",
}));

vi.mock("@/components/showcase-cover-photo-slot", () => ({
  ShowcaseCoverPhotoSlot: () => <div data-testid="showcase-cover-photo-slot" />,
}));

vi.mock("@/components/diag/distribution-refresh-diag", () => ({
  DistributionRefreshDiag: () => null,
}));

vi.mock("@/lib/diag-distribution-refresh-enabled", () => ({
  useDistributionRefreshDiagEnabled: () => false,
}));

function setHashRoute(hash: string): void {
  window.history.replaceState(null, "", `/${hash}`);
}

function currentHashWithoutPrefix(): string {
  const hash = window.location.hash;
  return hash.startsWith("#") ? hash.slice(1) : hash;
}

function renderPanel(dealers: readonly DealerRow[]) {
  return render(
    <DistributionEntryTradePointPanel
      profile={profile}
      dealers={dealers}
      filter={filter}
      onFilterChange={() => {}}
      regionOptions={[]}
      cityOptions={[]}
    />,
  );
}

describe("distribution entry tradepoint loading placeholder predicates", () => {
  it("isEntryDataLoading is true only when actualization is enabled and loading", () => {
    expect(isEntryDataLoading(false, true, true)).toBe(false);
    expect(isEntryDataLoading(true, true, false)).toBe(true);
    expect(isEntryDataLoading(true, false, true)).toBe(true);
    expect(isEntryDataLoading(true, false, false)).toBe(false);
  });

  it("shouldShowEntryLoadingPlaceholder covers tp-resolve combinations", () => {
    expect(
      shouldShowEntryLoadingPlaceholder({
        selectedTradePointId: "tp-1",
        hasSelectedRow: false,
        isEntryDataLoading: true,
      }),
    ).toBe(true);
    expect(
      shouldShowEntryLoadingPlaceholder({
        selectedTradePointId: "tp-1",
        hasSelectedRow: true,
        isEntryDataLoading: true,
      }),
    ).toBe(false);
    expect(
      shouldShowEntryLoadingPlaceholder({
        selectedTradePointId: null,
        hasSelectedRow: false,
        isEntryDataLoading: true,
      }),
    ).toBe(false);
    expect(
      shouldShowEntryLoadingPlaceholder({
        selectedTradePointId: "tp-1",
        hasSelectedRow: false,
        isEntryDataLoading: false,
      }),
    ).toBe(false);
  });
});

describe("DistributionEntryTradePointPanel tp hash persistence", () => {
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockActx.enabled = false;
    mockActx.loading = false;
    mockTeamPlane.teamFetchLoading = false;
    mockIsMobile.value = false;
    mockDesktopLayout.value = true;
    navigateSpy = vi.spyOn(hashLocationRouter, "navigateHashPathInHash");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("does not strip tp from hash while selected trade point is absent from rows (hydration race)", async () => {
    const pendingTp = "manual-tp-pending";
    setHashRoute(`#/distribution?view=entry&ax=tradePoint&tp=${pendingTp}`);

    renderPanel([makeDealer("tp-other", "Другая ТТ")]);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(currentHashWithoutPrefix()).toContain(`tp=${pendingTp}`);
    const clearedTpNav = navigateSpy.mock.calls.find(([target]) => {
      const path = typeof target === "string" ? target : "";
      return path.includes("ax=tradePoint") && !path.includes("tp=");
    });
    expect(clearedTpNav).toBeUndefined();
  });

  it("renders matrix entry when tp exists in rows", async () => {
    const tpId = "tp-selected";
    setHashRoute(`#/distribution?view=entry&ax=tradePoint&tp=${tpId}`);

    renderPanel([makeDealer(tpId, "Выбранная ТТ")]);

    await waitFor(() => {
      expect(screen.getByTestId("distribution-tradepoint-matrix-entry")).toBeTruthy();
    });
    expect(currentHashWithoutPrefix()).toContain(`tp=${tpId}`);
  });

  it("writes tp to hash when a list row is selected", async () => {
    setHashRoute("#/distribution?view=entry&ax=tradePoint");
    navigateSpy.mockClear();

    const tpId = "tp-click";
    renderPanel([makeDealer(tpId, "Кликабельная ТТ")]);

    const row = await screen.findByTestId(`distribution-entry-tradepoint-row-${tpId}`);
    fireEvent.click(row);

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith(
        `/distribution?view=entry&ax=tradePoint&tp=${tpId}`,
      );
    });
  });

  it("shows loading placeholder on mobile while tp is resolving during data fetch", () => {
    mockActx.enabled = true;
    mockActx.loading = true;
    mockIsMobile.value = true;
    mockDesktopLayout.value = false;

    const pendingTp = "manual-tp-loading";
    setHashRoute(`#/distribution?view=entry&ax=tradePoint&tp=${pendingTp}`);

    renderPanel([]);

    expect(screen.getByTestId("distribution-entry-tradepoint-loading")).toBeTruthy();
    expect(screen.getByText("Загружаем торговую точку…")).toBeTruthy();
    expect(screen.queryByTestId("list-distribution-entry-tradepoints")).toBeNull();
  });
});
