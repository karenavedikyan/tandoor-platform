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
  status: "active",
  distribution_filled: 0,
  distribution_total: 4,
};

afterEach(() => {
  cleanup();
});

describe("OneCStoreCard", () => {
  it("renders address, legal name, badges and distribution placeholder", () => {
    render(<OneCStoreCard row={row} act={act} />);

    expect(screen.getByTestId("card-one-c-store-store-1")).toBeTruthy();
    expect(screen.getByText("ул. Ленина, 1")).toBeTruthy();
    expect(screen.getByText("ООО Ромашка")).toBeTruthy();
    expect(screen.getByText("Холдинг: Холдинг А")).toBeTruthy();
    expect(screen.getByTestId("badge-one-c-client-type-store-1").textContent).toContain("ТОП 350");
    expect(screen.getByTestId("badge-one-c-payment-store-1").textContent).toContain("Безналичные");
    expect(screen.getByTestId("one-c-store-tile-distribution-store-1").textContent).toContain("dist-placeholder");
  });
});
