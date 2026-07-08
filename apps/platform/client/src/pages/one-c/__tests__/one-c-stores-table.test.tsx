/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import { DEFAULT_STORE_COLUMNS } from "../one-c-stores-columns";
import { OneCStoresTable } from "../one-c-stores-table";

vi.mock("@/hooks/use-trade-point-distribution-aggregate", () => ({
  useTradePointDistributionAggregate: () => ({
    aggregate: {
      byType: {
        entrance: { percent: 50 },
        interior: { percent: 25 },
        hardware: { percent: null },
      },
      totalLegacyOurs: 1,
      rotationPotentialPercent: 10,
    },
    loading: false,
  }),
}));

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
  legal_regional_manager_name: "Петров РМ",
  legal_payment_form: "Безналичные",
  legal_phone: "+7 900 000-00-00",
  legal_email: "shop@example.com",
  status: "active",
  orders_count: 0,
  distribution_filled: 2,
  distribution_total: 4,
};

describe("OneCStoresTable", () => {
  it("renders visible default columns and contact cell", () => {
    render(
      <OneCStoresTable
        items={[row]}
        columns={DEFAULT_STORE_COLUMNS}
        act="live"
        testIdPrefix="one-c-stores-test"
      />,
    );

    expect(screen.getByTestId("table-one-c-stores-test")).toBeTruthy();
    expect(screen.getByText("Холдинг А")).toBeTruthy();
    expect(screen.getByText("ул. Ленина, 1")).toBeTruthy();
    expect(screen.getByText("+7 900 000-00-00")).toBeTruthy();
    expect(screen.getByText("shop@example.com")).toBeTruthy();
    expect(screen.queryByText("ТОП 350")).toBeNull();
  });
});
