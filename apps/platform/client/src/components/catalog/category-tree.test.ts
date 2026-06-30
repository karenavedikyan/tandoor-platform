import { describe, expect, it } from "vitest";
import { buildCategoryTree } from "@/lib/catalog-category-tree";
import type { CatalogCategoryFlat as CatalogCategoryItem } from "@/lib/catalog-category-tree";

describe("buildCategoryTree", () => {
  const flat: CatalogCategoryItem[] = [
    { id: "r1", name: "Root B", parent_id: null, sort_order: 2, product_count: 10 },
    { id: "r2", name: "Root A", parent_id: null, sort_order: 1, product_count: 5 },
    { id: "c1", name: "Child", parent_id: "r1", sort_order: null, product_count: 3 },
    { id: "empty", name: "Empty", parent_id: null, sort_order: 0, product_count: 0 },
  ];

  it("filters zero-count nodes and sorts roots", () => {
    const roots = buildCategoryTree(flat);
    expect(roots).toHaveLength(2);
    expect(roots[0]!.id).toBe("r2");
    expect(roots[1]!.id).toBe("r1");
    expect(roots[1]!.children).toHaveLength(1);
    expect(roots[1]!.children[0]!.id).toBe("c1");
  });

  it("returns empty tree for no visible categories", () => {
    expect(buildCategoryTree([{ id: "x", name: "X", parent_id: null, product_count: 0 }])).toEqual([]);
  });
});
