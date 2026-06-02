import { describe, expect, it } from "vitest";
import {
  INTERIOR_ROOT_ID_ALT,
  computeGroupKey,
  isInteriorDoorGrouping,
  parseCatalogListSort,
  resolveDefaultSortMode,
} from "./_catalog-grouping.js";
import { ROOT_CATEGORY_IDS } from "./_filter-config.js";

describe("catalog model grouping", () => {
  it("uses link value as group key by default", () => {
    expect(computeGroupKey("abc-uuid-main", null, "p1", false)).toBe("abc-uuid-main");
  });

  it("single product without link", () => {
    expect(computeGroupKey(null, null, "550e8400-e29b-41d4-a716-446655440000", false)).toBe(
      "single:550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("interior adds door type to key", () => {
    expect(computeGroupKey("link-1", "Глухая (ДГ)", "p1", true)).toBe("link-1|Глухая (ДГ)");
    expect(computeGroupKey("link-1", "Стеклянная (ДО)", "p2", true)).toBe("link-1|Стеклянная (ДО)");
    expect(computeGroupKey("link-1", "Глухая (ДГ)", "p3", true)).not.toBe(
      computeGroupKey("link-1", "Стеклянная (ДО)", "p4", true),
    );
  });

  it("detects interior root category", () => {
    expect(isInteriorDoorGrouping({ id: ROOT_CATEGORY_IDS.INTERIOR, name: "Межкомнатные двери" })).toBe(
      true,
    );
    expect(isInteriorDoorGrouping({ id: INTERIOR_ROOT_ID_ALT, name: null })).toBe(true);
    expect(isInteriorDoorGrouping({ id: ROOT_CATEGORY_IDS.ENTRANCE, name: "Входные двери" })).toBe(
      false,
    );
    expect(isInteriorDoorGrouping({ id: null, name: null })).toBe(false);
  });

  it("parses catalog sort param", () => {
    expect(parseCatalogListSort(undefined)).toBe("default");
    expect(parseCatalogListSort("default")).toBe("default");
    expect(parseCatalogListSort("name")).toBe("name");
    expect(parseCatalogListSort("price_asc")).toBe("price_asc");
    expect(parseCatalogListSort("bogus")).toBe("default");
  });

  it("resolves default sort mode by root category", () => {
    expect(resolveDefaultSortMode(ROOT_CATEGORY_IDS.INTERIOR, "Межкомнатные двери")).toBe("promo");
    expect(resolveDefaultSortMode(ROOT_CATEGORY_IDS.ENTRANCE, "Входные двери")).toBe("promo");
    expect(resolveDefaultSortMode(null, null)).toBe("promo");
    expect(resolveDefaultSortMode(ROOT_CATEGORY_IDS.HARDWARE, "Фурнитура")).toBe("article");
    expect(resolveDefaultSortMode(ROOT_CATEGORY_IDS.PLINTH, "Плинтус")).toBe("article");
  });
});
