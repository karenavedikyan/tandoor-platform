import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getHiddenCategoryIds,
  hiddenCategoriesExcludeSql,
  hiddenCategoryFilterSql,
} from "./_hidden.js";

const FLOOR_ID = "cf1d70a8-85ad-11ed-8126-00155d0a0a4e";

describe("catalog _hidden", () => {
  const prev = process.env.CATALOG_HIDDEN_CATEGORY_IDS;

  afterEach(() => {
    if (prev === undefined) delete process.env.CATALOG_HIDDEN_CATEGORY_IDS;
    else process.env.CATALOG_HIDDEN_CATEGORY_IDS = prev;
  });

  it("returns empty when env unset", () => {
    delete process.env.CATALOG_HIDDEN_CATEGORY_IDS;
    expect(getHiddenCategoryIds()).toEqual([]);
    expect(hiddenCategoryFilterSql(1).sql).toBe("");
  });

  it("parses comma-separated UUIDs", () => {
    process.env.CATALOG_HIDDEN_CATEGORY_IDS = `${FLOOR_ID}, not-a-uuid `;
    expect(getHiddenCategoryIds()).toEqual([FLOOR_ID]);
  });

  it("builds product filter with recursive hidden tree", () => {
    process.env.CATALOG_HIDDEN_CATEGORY_IDS = FLOOR_ID;
    const { sql, params } = hiddenCategoryFilterSql(3);
    expect(sql).toContain("hidden_tree");
    expect(sql).toContain("catalog_product_categories");
    expect(params).toEqual([[FLOOR_ID]]);
  });

  it("builds category exclude filter", () => {
    process.env.CATALOG_HIDDEN_CATEGORY_IDS = FLOOR_ID;
    const { sql } = hiddenCategoriesExcludeSql("c", 1);
    expect(sql).toContain("c.id NOT IN");
    expect(sql).toContain("hidden_tree");
  });
});
