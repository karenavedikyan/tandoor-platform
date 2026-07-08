/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OneCStoreCard } from "../one-c-store-card";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";

vi.mock("@/components/distribution/compact-distribution-badge", () => ({
  CompactDistributionBadge: ({ testId }: { testId: string }) => (
    <span data-testid={testId}>dist-placeholder</span>
  ),
}));

vi.mock("@/components/distribution/distribution-card-header-block", () => ({
  DistributionCardHeaderBlock: ({ testId }: { testId: string }) => (
    <span data-testid={testId}>dist-full-placeholder</span>
  ),
}));

const act = createEmptyActualizationState();

const row: OneCStoreListItem = {
  id_1c: "store-1",
  address: "ул. Ленина, 1",
  manager_name: "Иванов",
  legal_name: "ООО Ромашка",
  legal_inn: "7700000000",
  legal_city: "Москва",
  legal_parent_1c: "parent-1",
  legal_parent_name: "Холдинг А",
  legal_client_type: "ТОП 350",
  legal_regional_manager_name: "Петров",
  legal_payment_form: "Безналичные",
  legal_phone: null,
  legal_email: null,
  status: "active",
  distribution_filled: 0,
  distribution_total: 4,
};

afterEach(() => {
  cleanup();
});

describe("OneCStoreCard", () => {
  it("renders grid density with badges and compact distribution", () => {
    render(<OneCStoreCard row={row} density="grid" act={act} />);

    const card = screen.getByTestId("card-one-c-store-store-1");
    expect(card.getAttribute("data-density")).toBe("grid");
    expect(screen.getByText("ул. Ленина, 1")).toBeTruthy();
    expect(screen.getByTestId("one-c-store-tile-distribution-store-1").textContent).toContain(
      "dist-placeholder",
    );
  });

  it("renders large density with full distribution block", () => {
    render(<OneCStoreCard row={row} density="large" act={act} />);

    const card = screen.getByTestId("card-one-c-store-store-1");
    expect(card.getAttribute("data-density")).toBe("large");
    expect(screen.getByTestId("one-c-store-large-dist-store-1").textContent).toContain(
      "dist-full-placeholder",
    );
  });

  it("renders list density as horizontal row", () => {
    render(<OneCStoreCard row={row} density="list" act={act} />);

    const card = screen.getByTestId("card-one-c-store-store-1");
    expect(card.getAttribute("data-density")).toBe("list");
    expect(screen.getByTestId("one-c-store-list-dist-store-1").textContent).toContain(
      "dist-placeholder",
    );
  });
});
