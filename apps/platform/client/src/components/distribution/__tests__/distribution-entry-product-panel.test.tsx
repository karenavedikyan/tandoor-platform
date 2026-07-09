/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { defaultDistributionFilterState } from "@/lib/distribution-filters";
import * as hashLocationRouter from "@/lib/hash-location-router";
import { DistributionEntryProductPanel } from "@/components/distribution/distribution-entry-product-panel";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

const profile: ReleaseDemoProfile = { role: "sales_manager", personaUserId: "mgr-1" };

const mockDesktopLayout = vi.hoisted(() => ({ value: true }));

const mockCatalogProducts = vi.hoisted(() => [
  {
    id: "model-vh-1",
    name: "Входная Эра",
    display_name: "Входная Эра",
    brand: "ВХ",
    image_url: null,
    total_stock: null,
    price_retail: null,
    price_retail_sale: null,
    is_new: false,
    is_hit: false,
    is_sale: false,
    variant_count: 0,
  },
]);

const mockTpRows = vi.hoisted(() => [
  {
    dealerId: "dealer-one-c-tp",
    tradePointId: "one-c-tp-uuid-2",
    tradePointName: "ТТ 1С",
    clientName: "Клиент 1С",
    city: "Москва",
    presence: "recommended" as const,
  },
]);

vi.mock("@/lib/distribution-entry-product-view-model", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/distribution-entry-product-view-model")>();
  return {
    ...actual,
    entryProductModelsToCatalogProducts: () => mockCatalogProducts,
    collectEntryCatalogModels: () => [
      {
        id: "model-vh-1",
        name: "Входная Эра",
        type: "entrance" as const,
        typeLabelRu: "ВХ" as const,
        imageUrl: "",
        basePriority: "high" as const,
        importanceReason: "",
        characteristics: "",
        advantages: "",
        benefitsDealer: "",
        benefitsBuyer: "",
        objections: "",
        objectionAnswers: "",
        copyMessage: "",
      },
    ],
    buildEntryProductTradePointRows: () => mockTpRows,
  };
});

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ user: null }),
  displayUserName: () => "Test User",
}));

vi.mock("@/lib/distribution-entry-element-virtualizer", () => ({
  DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE: {
    simpleRow: 56,
    catalogList: 72,
    catalogGridRow: 200,
  },
  distributionEntryVirtualItemStyle: () => ({}),
  useDistributionEntryDesktopLayout: () => mockDesktopLayout.value,
  useDistributionEntryCatalogGridColumns: () => 2,
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
}));

vi.mock("@/components/diag/distribution-refresh-diag", () => ({
  DistributionRefreshDiag: () => null,
}));

vi.mock("@/lib/diag-distribution-refresh-enabled", () => ({
  useDistributionRefreshDiagEnabled: () => false,
}));

describe("DistributionEntryProductPanel oneCStoreNavigation", () => {
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  const dealers = [
    {
      id: "dealer-one-c-tp",
      name: "Клиент 1С",
      city: "Москва",
      region: "ЦФО",
      status: "активный",
      clientCategory: "top350",
      tradePoints: [
        {
          id: "one-c-tp-uuid-2",
          name: "ТТ 1С",
          city: "Москва",
          address: "",
          status: "активный",
        },
      ],
    },
  ] as DealerRow[];

  beforeEach(() => {
    mockDesktopLayout.value = true;
    navigateSpy = vi.spyOn(hashLocationRouter, "navigateHashPathInHash");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("navigates to /1c/store on trade point click and does not render inline showcase", () => {
    const filter = { ...defaultDistributionFilterState(), segment: "vh" as const };

    render(
      <DistributionEntryProductPanel
        profile={profile}
        dealers={dealers}
        filter={filter}
        oneCStoreNavigation
      />,
    );

    fireEvent.click(screen.getByTestId("distribution-entry-product-model-model-vh-1"));
    fireEvent.click(screen.getByTestId("distribution-entry-product-tp-one-c-tp-uuid-2"));

    expect(navigateSpy).toHaveBeenCalledWith(
      `/1c/store/${encodeURIComponent("one-c-tp-uuid-2")}`,
    );
    expect(screen.queryByTestId("distribution-tradepoint-matrix-entry")).toBeNull();
  });

  it("renders inline showcase when oneCStoreNavigation is false", () => {
    const filter = { ...defaultDistributionFilterState(), segment: "vh" as const };

    render(
      <DistributionEntryProductPanel
        profile={profile}
        dealers={dealers}
        filter={filter}
        oneCStoreNavigation={false}
      />,
    );

    fireEvent.click(screen.getByTestId("distribution-entry-product-model-model-vh-1"));
    fireEvent.click(screen.getByTestId("distribution-entry-product-tp-one-c-tp-uuid-2"));

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("distribution-tradepoint-matrix-entry")).toBeTruthy();
  });
});
