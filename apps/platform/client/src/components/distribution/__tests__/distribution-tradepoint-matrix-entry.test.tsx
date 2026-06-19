import { describe, expect, it } from "vitest";
import { filterCatalogProductsByFilters } from "@/lib/catalog-facets";
import { productDistributionCategory } from "@/lib/distribution-catalog-categories";
import { readStateFromParams } from "@/hooks/use-catalog-filters-url";
import type { CatalogProduct } from "@/lib/catalog-product-type";

function makeProduct(partial: Partial<CatalogProduct> & Pick<CatalogProduct, "id" | "name">): CatalogProduct {
  return {
    article: partial.id,
    category: partial.category ?? "Входные двери",
    series: partial.series ?? "Series",
    type: "door",
    doorKind: partial.doorKind ?? "Входная",
    status: "active",
    image: null,
    shortDescription: "",
    description: "",
    features: [],
    specs: [],
    equipment: [],
    variants: [],
    colors: partial.colors ?? [],
    sizes: [],
    manufacturer: partial.manufacturer ?? "Tandoor",
    warranty: "",
    coating: partial.coating ?? "",
    openType: partial.openType ?? "",
    isTop: false,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 1,
    salesPriority: 1,
    recommendedForShowcase: false,
    relatedDealerIds: [],
    relatedTradePointIds: [],
    relatedTaskCount: 0,
    history: [],
    ...partial,
  };
}

describe("distribution fullscreen entry filters (prompt 428)", () => {
  const vh = makeProduct({ id: "vh-1", name: "VH door", doorKind: "Входная" });
  const mk = makeProduct({ id: "mk-1", name: "MK door", doorKind: "Межкомнатная", category: "Межкомнатные" });
  const hw = makeProduct({
    id: "hw-1",
    name: "Handle",
    doorKind: "Фурнитура",
    category: "Фурнитура",
  });
  const molding = makeProduct({
    id: "ml-1",
    name: "Molding strip",
    doorKind: "Плинтус",
    category: "Плинтусы",
  });

  it("detects hardware and molding categories", () => {
    expect(productDistributionCategory(hw)).toBe("hardware");
    expect(productDistributionCategory(molding)).toBe("molding");
    expect(productDistributionCategory(vh)).toBe("vh");
    expect(productDistributionCategory(mk)).toBe("mk");
  });

  it("filters catalog products by hardware category", () => {
    const all = [vh, mk, hw, molding];
    const filtered = filterCatalogProductsByFilters(all, {}, ["hardware"]);
    expect(filtered.map((p) => p.id)).toEqual(["hw-1"]);
  });

  it("default source is all (not matrix)", () => {
    const sp = new URLSearchParams();
    const state = readStateFromParams(sp, "dx", undefined);
    expect(state.source).toBe("all");
  });
});
