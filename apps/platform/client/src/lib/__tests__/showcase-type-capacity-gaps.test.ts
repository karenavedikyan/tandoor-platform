/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import type { TradePointShowcaseActualization, TradePointShowcaseSelectedModel } from "../client-base-actualization-state";
import type { CatalogProduct } from "../catalog-product-type";
import { findShowcaseCapacityGaps } from "../showcase-type-capacity";

const baseShowcase: TradePointShowcaseActualization = {
  tradePointId: "tp-1",
  dealerId: "d-1",
  hasShowcase: true,
  totalPortals: null,
  entrancePortals: 5,
  interiorPortals: null,
  hardwareSections: 2,
  showcaseAreaSqm: null,
  showcaseComment: "",
  tandoorTotalPortals: null,
  tandoorEntrancePortals: null,
  tandoorInteriorPortals: null,
  competitorPortals: null,
  competitorsListed: "",
  fillingComment: "",
  hasExpansionPotential: null,
  additionalPortalsPotential: null,
  showcasePriority: "",
  firstPriorityNeed: "",
  rmRopComment: "",
  updatedAt: new Date().toISOString(),
  updatedBy: "",
  updatedByName: "",
};

function selectedModel(productId: string, portalType: "entrance" | "interior" | "hardware"): TradePointShowcaseSelectedModel {
  return {
    productId,
    productName: productId,
    productType: "Модель",
    selectedAt: new Date().toISOString(),
    selectedBy: "u",
    selectedByName: "U",
    portalType,
  };
}

const catalogByPortal: Record<string, CatalogProduct> = {
  "p-ent": { id: "p-ent", name: "Входная", doorKind: "Входная" } as CatalogProduct,
  "p-int": { id: "p-int", name: "МК", doorKind: "Межкомнатная" } as CatalogProduct,
  "p-hw": { id: "p-hw", name: "Фурн", doorKind: "Фурнитура" } as CatalogProduct,
};

const gapCatalogLookup = (id: string) => catalogByPortal[id];

describe("findShowcaseCapacityGaps", () => {
  it("returns empty when no selected models", () => {
    expect(findShowcaseCapacityGaps(baseShowcase, [], gapCatalogLookup)).toEqual([]);
  });

  it("flags entrance when models selected but entrancePortals is null", () => {
    const selected = [selectedModel("p-ent", "entrance")];
    expect(findShowcaseCapacityGaps({ ...baseShowcase, entrancePortals: null }, selected, gapCatalogLookup)).toEqual([
      "entrance",
    ]);
  });

  it("does not flag entrance when entrancePortals is 0", () => {
    const selected = [selectedModel("p-ent", "entrance")];
    expect(findShowcaseCapacityGaps({ ...baseShowcase, entrancePortals: 0 }, selected, gapCatalogLookup)).toEqual([]);
  });

  it("does not flag entrance when entrancePortals is set", () => {
    const selected = [selectedModel("p-ent", "entrance")];
    expect(findShowcaseCapacityGaps({ ...baseShowcase, entrancePortals: 5 }, selected, gapCatalogLookup)).toEqual([]);
  });

  it("returns entrance and interior in stable order when both lack capacity", () => {
    const selected = [selectedModel("p-ent", "entrance"), selectedModel("p-int", "interior")];
    expect(
      findShowcaseCapacityGaps(
        { ...baseShowcase, entrancePortals: null, interiorPortals: null },
        selected,
        gapCatalogLookup,
      ),
    ).toEqual(["entrance", "interior"]);
  });

  it("with undefined showcaseRec flags all types with selected models", () => {
    const selected = [selectedModel("p-ent", "entrance"), selectedModel("p-hw", "hardware")];
    expect(findShowcaseCapacityGaps(undefined, selected, gapCatalogLookup)).toEqual(["entrance", "hardware"]);
  });
});
