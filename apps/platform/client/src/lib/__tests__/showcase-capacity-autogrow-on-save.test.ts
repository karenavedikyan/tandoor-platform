/**
 * Запуск: npm run test:showcase-capacity-autogrow-on-save
 */
import assert from "node:assert/strict";
import type { TradePointShowcaseActualization } from "../client-base-actualization-state.js";
import {
  aggregateShowcaseCapacityGrownTypes,
  formatShowcaseCapacityAutoGrowLine,
  formatShowcaseCapacityAutoGrowToastDescription,
  mergeMarkedCountsByType,
  planCategoryCapacityGrowthForMarked,
  showcaseCapacityCoversMarkedCounts,
} from "../showcase-capacity-autogrow-on-save.js";

const baseShowcase: TradePointShowcaseActualization = {
  tradePointId: "tp-1",
  dealerId: "d-1",
  hasShowcase: true,
  totalPortals: null,
  entrancePortals: 7,
  interiorPortals: 2,
  hardwareSections: null,
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

{
  const draftMarked = new Map([
    ["entrance", 10],
    ["interior", 5],
  ] as const);
  const selected = Array.from({ length: 14 }, (_, i) => ({
    productId: `ent-${i}`,
    productName: `E${i}`,
    productType: "Модель",
    selectedAt: new Date().toISOString(),
    selectedBy: "u",
    selectedByName: "U",
    portalType: "entrance" as const,
  }));
  selected.push(
  ...Array.from({ length: 11 }, (_, i) => ({
    productId: `int-${i}`,
    productName: `I${i}`,
    productType: "Модель",
    selectedAt: new Date().toISOString(),
    selectedBy: "u",
    selectedByName: "U",
    portalType: "interior" as const,
  })),
  );
  const merged = mergeMarkedCountsByType(draftMarked, selected, () => undefined);
  assert.equal(merged.get("entrance"), 14);
  assert.equal(merged.get("interior"), 11);

  const planned = planCategoryCapacityGrowthForMarked(baseShowcase, merged);
  assert.equal(planned.length, 2);
  const entrance = planned.find((g) => g.type === "entrance");
  const interior = planned.find((g) => g.type === "interior");
  assert.equal(entrance?.oldCapacity, 7);
  assert.equal(entrance?.nextCapacity, 14);
  assert.equal(interior?.oldCapacity, 2);
  assert.equal(interior?.nextCapacity, 11);

  const grown = aggregateShowcaseCapacityGrownTypes(merged, planned);
  assert.equal(grown.length, 2);
  assert.equal(formatShowcaseCapacityAutoGrowLine(grown[0]!).includes("было 7"), true);
  assert.equal(formatShowcaseCapacityAutoGrowLine(grown[1]!).includes("было 2"), true);

  const after = {
    ...baseShowcase,
    entrancePortals: 14,
    interiorPortals: 11,
  };
  assert.equal(showcaseCapacityCoversMarkedCounts(after, merged), true);
}

{
  const description = formatShowcaseCapacityAutoGrowToastDescription("entrance", 7, 14);
  assert.match(description, /7/);
  assert.match(description, /14/);
}

console.log("showcase-capacity-autogrow-on-save: ok");
