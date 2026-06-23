/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterCatalogProductsByFilters } from "@/lib/catalog-facets";
import { productDistributionCategory } from "@/lib/distribution-catalog-categories";
import { readStateFromParams } from "@/hooks/use-catalog-filters-url";
import {
  fullscreenOpenStorageKey,
  readFullscreenOpen,
  writeFullscreenOpen,
} from "@/components/distribution/distribution-tradepoint-matrix-entry";
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

describe("distribution entry fullscreen session persistence", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("writeFullscreenOpen(true) persists until cleared", () => {
    writeFullscreenOpen("dealer-1", "tp-1", true);
    expect(readFullscreenOpen("dealer-1", "tp-1")).toBe(true);
    expect(window.sessionStorage.getItem(fullscreenOpenStorageKey("dealer-1", "tp-1"))).toBe("1");
  });

  it("writeFullscreenOpen(false) removes the key", () => {
    writeFullscreenOpen("dealer-1", "tp-1", true);
    writeFullscreenOpen("dealer-1", "tp-1", false);
    expect(readFullscreenOpen("dealer-1", "tp-1")).toBe(false);
    expect(window.sessionStorage.getItem(fullscreenOpenStorageKey("dealer-1", "tp-1"))).toBeNull();
  });

  it("keeps storage keys independent per trade point", () => {
    writeFullscreenOpen("dealer-1", "tp-1", true);
    expect(readFullscreenOpen("dealer-2", "tp-2")).toBe(false);
    expect(readFullscreenOpen("dealer-1", "tp-1")).toBe(true);
  });

  it("handles unavailable sessionStorage gracefully", () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
      clear: () => {},
      key: () => null,
      length: 0,
    };
    vi.stubGlobal("sessionStorage", brokenStorage);

    expect(() => writeFullscreenOpen("dealer-x", "tp-x", true)).not.toThrow();
    expect(readFullscreenOpen("dealer-x", "tp-x")).toBe(false);

    vi.unstubAllGlobals();
  });
});
