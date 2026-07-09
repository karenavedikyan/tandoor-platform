/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DistributionEntryWizard } from "@/components/distribution/distribution-entry-wizard";

import type { DealerRow } from "@/lib/dealer-base-mock-data";

const mockOneCDealers = vi.hoisted(
  () =>
    [
      {
        id: "one-c-dealer-1",
        name: "1C Dealer",
        city: "Москва",
        region: "ЦФО",
        status: "активный",
        clientCategory: "top350",
        tradePoints: [
          {
            id: "one-c-tp-1",
            name: "ТТ 1С",
            city: "Москва",
            address: "",
            status: "активный",
          },
        ],
      },
    ] as DealerRow[],
);

vi.mock("@/hooks/use-auth-user", () => ({
  useAuthUser: () => ({ user: { role: "manager" }, isLoading: false, isError: false }),
}));

vi.mock("@/hooks/use-distribution-scoped-dealers", () => ({
  useDistributionScopedDealers: () => [{ id: "legacy-dealer-1", name: "Legacy Dealer" }],
}));

vi.mock("@/hooks/use-one-c-scoped-stores", () => ({
  useOneCScopedStores: () => ({
    items: [],
    dealers: mockOneCDealers,
    tradePoints: [],
    rowRefs: new Map(),
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

const capturedPanelProps = vi.hoisted(() => ({
  tradepoint: null as Record<string, unknown> | null,
  city: null as Record<string, unknown> | null,
  product: null as Record<string, unknown> | null,
}));

vi.mock("@/components/distribution/distribution-entry-axis-picker", () => ({
  DistributionEntryAxisPicker: () => <div data-testid="distribution-entry-axis-picker" />,
}));

vi.mock("@/components/distribution/distribution-entry-tradepoint-panel", () => ({
  DistributionEntryTradePointPanel: (props: Record<string, unknown>) => {
    capturedPanelProps.tradepoint = props;
    return <div data-testid="distribution-entry-tradepoint-panel" />;
  },
}));

vi.mock("@/components/distribution/distribution-entry-product-panel", () => ({
  DistributionEntryProductPanel: (props: Record<string, unknown>) => {
    capturedPanelProps.product = props;
    return <div data-testid="distribution-entry-product-panel" />;
  },
}));

vi.mock("@/components/distribution/distribution-entry-city-panel", () => ({
  DistributionEntryCityPanel: (props: Record<string, unknown>) => {
    capturedPanelProps.city = props;
    return <div data-testid="distribution-entry-city-panel" />;
  },
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
    expect(capturedPanelProps.tradepoint?.oneCStoreNavigation).toBe(true);
    expect(capturedPanelProps.tradepoint?.scopedDealers).toEqual(mockOneCDealers);
  });

  it("passes oneCStoreNavigation and 1C dealers to city and product panels for non-admin", () => {
    render(
      <DistributionEntryWizard profile={profile} axis="city" onAxisSelect={() => {}} />,
    );
    expect(capturedPanelProps.city?.oneCStoreNavigation).toBe(true);
    expect((capturedPanelProps.city?.dealers as DealerRow[])?.[0]?.id).toBe("one-c-dealer-1");

    cleanup();
    capturedPanelProps.product = null;

    render(
      <DistributionEntryWizard profile={profile} axis="product" onAxisSelect={() => {}} />,
    );
    expect(capturedPanelProps.product?.oneCStoreNavigation).toBe(true);
    expect((capturedPanelProps.product?.dealers as DealerRow[])?.[0]?.id).toBe("one-c-dealer-1");
  });
});
