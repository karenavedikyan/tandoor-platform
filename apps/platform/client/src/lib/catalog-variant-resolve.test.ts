import { describe, expect, it } from "vitest";
import { resolveCatalogVariant } from "./catalog-variant-resolve.js";
import type { CatalogVariant } from "./catalog-variant-resolve.js";

const variants: CatalogVariant[] = [
  {
    product_id: "a",
    size: "600",
    color: "Белый",
    door_type: "Глухая (ДГ)",
    side: null,
    price_retail: 10000,
    price_retail_sale: null,
    image_url: null,
    total_stock: 1,
  },
  {
    product_id: "b",
    size: "700",
    color: "Белый",
    door_type: "Глухая (ДГ)",
    side: null,
    price_retail: 11000,
    price_retail_sale: null,
    image_url: null,
    total_stock: 2,
  },
  {
    product_id: "c",
    size: "700",
    color: "Чёрный",
    door_type: "Стеклянная (ДО)",
    side: null,
    price_retail: 12000,
    price_retail_sale: null,
    image_url: null,
    total_stock: 0,
  },
];

describe("resolveCatalogVariant", () => {
  it("returns exact match for size", () => {
    const r = resolveCatalogVariant(variants, { size: "700", door_type: "Глухая (ДГ)" }, "a");
    expect(r?.product_id).toBe("b");
  });

  it("prefers size+door_type over size+color when exact combo missing", () => {
    const r = resolveCatalogVariant(
      variants,
      { size: "700", color: "Белый", door_type: "Стеклянная (ДО)" },
      "a",
    );
    expect(r?.product_id).toBe("c");
  });

  it("uses fallback id when no selection", () => {
    const r = resolveCatalogVariant(variants, {}, "a");
    expect(r?.product_id).toBe("a");
  });
});
