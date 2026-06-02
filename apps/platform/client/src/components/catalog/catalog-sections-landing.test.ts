import { describe, expect, it } from "vitest";
import { DoorClosed, KeyRound, Percent } from "lucide-react";
import { getRootCatalogSections, sectionIcon } from "./CatalogSectionsLanding";
import type { CatalogCategoryItem } from "./CategoryTreeNav";

describe("CatalogSectionsLanding helpers", () => {
  it("filters and sorts root sections", () => {
    const flat: CatalogCategoryItem[] = [
      { id: "b", name: "B", parent_id: null, sort_order: 2, product_count: 1 },
      { id: "a", name: "A", parent_id: null, sort_order: 1, product_count: 5 },
      { id: "c", name: "Child", parent_id: "a", product_count: 3 },
      { id: "z", name: "Empty", parent_id: null, product_count: 0 },
    ];
    expect(getRootCatalogSections(flat).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("maps section icons by name", () => {
    expect(sectionIcon("Входные двери").Icon).toBe(DoorClosed);
    expect(sectionIcon("Скидки").Icon).toBe(Percent);
    expect(sectionIcon("Скидки").className).toContain("d84040");
    expect(sectionIcon("Фурнитура").Icon).toBe(KeyRound);
  });
});
