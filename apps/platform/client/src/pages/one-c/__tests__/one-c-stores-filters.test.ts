import { describe, expect, it } from "vitest";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import type { DistributionTradePointMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";
import {
  applyOneCStoresFilters,
  emptyOneCStoresFilters,
  hasActiveOneCStoresFilters,
} from "../one-c-stores-filter-logic";

function makeItem(overrides: Partial<OneCStoreListItem> = {}): OneCStoreListItem {
  return {
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
    legal_phone: null,
    legal_email: null,
    status: "active",
    orders_count: 0,
    distribution_filled: 2,
    distribution_total: 4,
    ...overrides,
  };
}

function makeMetrics(overrides?: Partial<DistributionTradePointMetrics>): DistributionTradePointMetrics {
  return {
    tradePointId: "store-1",
    hasShowcase: true,
    byType: {
      entrance: { capacity: 10, tandoorOnShelf: 5, legacyOurs: 1, percent: 50 },
      interior: { capacity: 10, tandoorOnShelf: 0, legacyOurs: 0, percent: 0 },
      hardware: { capacity: 10, tandoorOnShelf: 0, legacyOurs: 0, percent: null },
    },
    averagePercent: 25,
    rotationPotentialPercent: 10,
    ...overrides,
  };
}

describe("applyOneCStoresFilters", () => {
  it("returns all items when filters are empty", () => {
    const items = [makeItem(), makeItem({ id_1c: "store-2" })];
    const result = applyOneCStoresFilters(items, emptyOneCStoresFilters(), new Map());
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    const result = applyOneCStoresFilters([], emptyOneCStoresFilters(), new Map());
    expect(result).toEqual([]);
  });

  it("filters by search query", () => {
    const items = [makeItem(), makeItem({ id_1c: "store-2", legal_name: "ООО Лилия" })];
    const filters = { ...emptyOneCStoresFilters(), search: "ромашка" };
    const result = applyOneCStoresFilters(items, filters, new Map());
    expect(result).toHaveLength(1);
    expect(result[0]?.id_1c).toBe("store-1");
  });

  it("filters by holding multiselect", () => {
    const items = [
      makeItem(),
      makeItem({ id_1c: "store-2", legal_parent_name: "Холдинг Б" }),
    ];
    const filters = { ...emptyOneCStoresFilters(), holdings: ["Холдинг Б"] };
    const result = applyOneCStoresFilters(items, filters, new Map());
    expect(result).toHaveLength(1);
    expect(result[0]?.id_1c).toBe("store-2");
  });

  it("filters by matrix fill partial", () => {
    const items = [
      makeItem({ distribution_filled: 2, distribution_total: 4 }),
      makeItem({ id_1c: "store-2", distribution_filled: 4, distribution_total: 4 }),
      makeItem({ id_1c: "store-3", distribution_filled: 0, distribution_total: 4 }),
    ];
    const filters = { ...emptyOneCStoresFilters(), matrixFill: "partial" as const };
    const result = applyOneCStoresFilters(items, filters, new Map());
    expect(result.map((i) => i.id_1c)).toEqual(["store-1"]);
  });

  it("filters by distribution segment presence", () => {
    const items = [makeItem(), makeItem({ id_1c: "store-2" })];
    const dist = new Map<string, DistributionTradePointMetrics>([
      ["store-1", makeMetrics()],
      ["store-2", makeMetrics({ byType: {
        entrance: { capacity: 10, tandoorOnShelf: 0, legacyOurs: 0, percent: 0 },
        interior: { capacity: 10, tandoorOnShelf: 0, legacyOurs: 0, percent: 0 },
        hardware: { capacity: 10, tandoorOnShelf: 0, legacyOurs: 0, percent: 0 },
      } })],
    ]);
    const filters = { ...emptyOneCStoresFilters(), vhPresence: "yes" as const };
    const result = applyOneCStoresFilters(items, filters, dist);
    expect(result).toHaveLength(1);
    expect(result[0]?.id_1c).toBe("store-1");
  });

  it("combines multiple filters", () => {
    const items = [
      makeItem(),
      makeItem({ id_1c: "store-2", legal_client_type: "Розница" }),
    ];
    const filters = {
      ...emptyOneCStoresFilters(),
      clientTypes: ["ТОП 350"],
      managers: ["Иванов"],
    };
    const result = applyOneCStoresFilters(items, filters, new Map());
    expect(result).toHaveLength(1);
    expect(result[0]?.id_1c).toBe("store-1");
  });

  it("skips search when serverSideSearch option is set", () => {
    const items = [makeItem({ legal_name: "ООО Лилия" })];
    const filters = { ...emptyOneCStoresFilters(), search: "ромашка" };
    const result = applyOneCStoresFilters(items, filters, new Map(), { skipSearch: true });
    expect(result).toHaveLength(1);
  });
});

describe("hasActiveOneCStoresFilters", () => {
  it("is false for empty filters", () => {
    expect(hasActiveOneCStoresFilters(emptyOneCStoresFilters())).toBe(false);
  });

  it("is true when matrix fill filter is set", () => {
    expect(hasActiveOneCStoresFilters({ ...emptyOneCStoresFilters(), matrixFill: "empty" })).toBe(true);
  });
});
