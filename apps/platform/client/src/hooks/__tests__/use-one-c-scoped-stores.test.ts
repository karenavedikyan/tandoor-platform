/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";

const fetchOneCStoresMock = vi.fn();

vi.mock("@/lib/one-c-showroom-api", () => ({
  fetchOneCStores: (...args: unknown[]) => fetchOneCStoresMock(...args),
}));

import { useOneCScopedStores } from "@/hooks/use-one-c-scoped-stores";

const item: OneCStoreListItem = {
  id_1c: "s1",
  address: "Адрес 1",
  manager_name: "Менеджер",
  legal_name: "ООО А",
  legal_inn: "123",
  legal_city: "Москва",
  legal_parent_1c: "h1",
  legal_parent_name: "Холдинг",
  legal_client_type: "ТОП 350",
  legal_regional_manager_name: "РМ",
  legal_payment_form: null,
  legal_phone: null,
  legal_email: null,
  status: "active",
  orders_count: 1,
  distribution_filled: 2,
  distribution_total: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchOneCStoresMock.mockResolvedValue({
    success: true,
    total: 1,
    limit: 500,
    offset: 0,
    onlyActive: false,
    items: [item],
  });
});

describe("useOneCScopedStores", () => {
  it("loads stores from GET /api/one-c/stores", async () => {
    const { result } = renderHook(() => useOneCScopedStores());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchOneCStoresMock).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(1);
    expect(result.current.tradePoints[0]?.tpId).toBe("s1");
    expect(result.current.dealers[0]?.tradePoints[0]?.id).toBe("s1");
  });
});
