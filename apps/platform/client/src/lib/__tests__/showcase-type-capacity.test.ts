/**
 * Запуск: `npm run test:showcase-type-capacity` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { TradePointShowcaseActualization } from "../client-base-actualization-state";
import type { CatalogProduct } from "../catalog-product-type";
import {
  evaluateSelectionGate,
  getShowcaseTypeCapacity,
  neededCapacityGrowthByType,
  patchShowcaseTypeCapacity,
} from "../showcase-type-capacity";

assert.equal(getShowcaseTypeCapacity(undefined, "entrance"), null);

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

assert.equal(getShowcaseTypeCapacity(baseShowcase, "entrance"), 5);
assert.equal(getShowcaseTypeCapacity(baseShowcase, "hardware"), 2);
assert.deepEqual(patchShowcaseTypeCapacity("hardware", 7), { hardwareSections: 7 });

const entranceProduct = {
  id: "p-ent",
  name: "Багет белый",
  doorKind: "Входная",
} as CatalogProduct;

const catalogLookup = () => undefined;

{
  const gate = evaluateSelectionGate(baseShowcase, [], entranceProduct, catalogLookup);
  assert.equal(gate?.action, "select");
  assert.equal(gate?.type, "entrance");
}

{
  const gate = evaluateSelectionGate(
    { ...baseShowcase, entrancePortals: null },
    [],
    entranceProduct,
    catalogLookup,
  );
  assert.equal(gate?.action, "open-capacity-form");
}

{
  const selected = Array.from({ length: 10 }, (_, i) => ({
    productId: `p-${i}`,
    productName: `M${i}`,
    productType: "Модель",
    selectedAt: new Date().toISOString(),
    selectedBy: "u",
    selectedByName: "U",
    portalType: "entrance" as const,
  }));
  const gate = evaluateSelectionGate({ ...baseShowcase, entrancePortals: 10 }, selected, entranceProduct, catalogLookup);
  assert.equal(gate?.action, "select-and-grow");
  assert.equal(gate?.nextCapacity, 11);
  assert.equal(gate?.oldCapacity, 10);
}

{
  const marked = new Map([["entrance", 14]] as const);
  const growths = neededCapacityGrowthByType({ ...baseShowcase, entrancePortals: 11 }, marked);
  assert.equal(growths.length, 1);
  assert.equal(growths[0]!.type, "entrance");
  assert.equal(growths[0]!.oldCapacity, 11);
  assert.equal(growths[0]!.nextCapacity, 14);
}

{
  const marked = new Map([["interior", 5]] as const);
  const growths = neededCapacityGrowthByType({ ...baseShowcase, interiorPortals: 10 }, marked);
  assert.equal(growths.length, 0);
}

{
  const marked = new Map([["hardware", 3]] as const);
  const growths = neededCapacityGrowthByType({ ...baseShowcase, hardwareSections: null }, marked);
  assert.equal(growths.length, 1);
  assert.equal(growths[0]!.type, "hardware");
  assert.equal(growths[0]!.oldCapacity, 0);
  assert.equal(growths[0]!.nextCapacity, 3);
}

{
  const marked = new Map<"entrance" | "interior" | "hardware", number>();
  const growths = neededCapacityGrowthByType({ ...baseShowcase, entrancePortals: null }, marked);
  assert.equal(growths.length, 0);
  assert.equal(getShowcaseTypeCapacity({ ...baseShowcase, entrancePortals: null }, "entrance"), null);
}

{
  const marked = new Map([
    ["entrance", 14],
    ["interior", 5],
    ["hardware", 8],
  ] as const);
  const growths = neededCapacityGrowthByType(
    { ...baseShowcase, entrancePortals: 11, interiorPortals: 10, hardwareSections: 2 },
    marked,
  );
  assert.equal(growths.length, 2);
  assert.deepEqual(
    growths.map((g) => g.type).sort(),
    ["entrance", "hardware"],
  );
  const entrance = growths.find((g) => g.type === "entrance");
  const hardware = growths.find((g) => g.type === "hardware");
  assert.equal(entrance?.oldCapacity, 11);
  assert.equal(entrance?.nextCapacity, 14);
  assert.equal(hardware?.oldCapacity, 2);
  assert.equal(hardware?.nextCapacity, 8);
}

console.log("showcase-type-capacity: ok");
