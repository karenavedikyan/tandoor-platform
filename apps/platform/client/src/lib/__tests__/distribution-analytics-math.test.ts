/**
 * Запуск: `npm run test:distribution-analytics-math` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { TradePointShowcaseActualization } from "../client-base-actualization-state";
import {
  aggregateDistribution,
  computeDistributionForTradePoint,
  computeModelCoverage,
} from "../distribution-analytics/distribution-analytics-math";

const catalogLookup = () => undefined;

function baseShowcase(partial: Partial<TradePointShowcaseActualization>): TradePointShowcaseActualization {
  return {
    tradePointId: "tp-1",
    dealerId: "d-1",
    hasShowcase: true,
    totalPortals: null,
    entrancePortals: 50,
    interiorPortals: 100,
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
    selectedShowcaseModels: [],
    ...partial,
  };
}

{
  const sh = baseShowcase({
    entrancePortals: 50,
    interiorPortals: 100,
    selectedShowcaseModels: [
      ...Array.from({ length: 50 }, (_, i) => ({
        productId: `e-${i}`,
        productName: `E${i}`,
        productType: "Модель",
        selectedAt: new Date().toISOString(),
        selectedBy: "u",
        selectedByName: "U",
        portalType: "entrance" as const,
      })),
      ...Array.from({ length: 70 }, (_, i) => ({
        productId: `i-${i}`,
        productName: `I${i}`,
        productType: "Модель",
        selectedAt: new Date().toISOString(),
        selectedBy: "u",
        selectedByName: "U",
        portalType: "interior" as const,
      })),
    ],
  });
  const m = computeDistributionForTradePoint(sh, catalogLookup);
  assert.equal(m.byType.entrance.percent, 100);
  assert.equal(m.byType.interior.percent, 70);
  assert.equal(m.byType.hardware.percent, null);
  assert.equal(m.averagePercent, 85);
}

{
  const sh = baseShowcase({
    entrancePortals: 10,
    interiorPortals: null,
    hardwareSections: null,
    selectedShowcaseModels: Array.from({ length: 5 }, (_, i) => ({
      productId: `e-${i}`,
      productName: `E${i}`,
      productType: "Модель",
      selectedAt: new Date().toISOString(),
      selectedBy: "u",
      selectedByName: "U",
      portalType: "entrance" as const,
    })),
  });
  const m = computeDistributionForTradePoint(sh, catalogLookup);
  assert.equal(m.byType.entrance.percent, 50);
  assert.equal(m.averagePercent, 50);
}

{
  const tp1 = computeDistributionForTradePoint(
    baseShowcase({ tradePointId: "tp-1", entrancePortals: 10, interiorPortals: null, selectedShowcaseModels: [] }),
    catalogLookup,
  );
  const tp2 = computeDistributionForTradePoint(
    baseShowcase({
      tradePointId: "tp-2",
      entrancePortals: 20,
      interiorPortals: null,
      selectedShowcaseModels: Array.from({ length: 10 }, (_, i) => ({
        productId: `e2-${i}`,
        productName: `E${i}`,
        productType: "Модель",
        selectedAt: new Date().toISOString(),
        selectedBy: "u",
        selectedByName: "U",
        portalType: "entrance" as const,
      })),
    }),
    catalogLookup,
  );
  const tp3 = computeDistributionForTradePoint(
    baseShowcase({ tradePointId: "tp-3", entrancePortals: 0, interiorPortals: 5, selectedShowcaseModels: [] }),
    catalogLookup,
  );
  const agg = aggregateDistribution([tp1, tp2, tp3]);
  assert.equal(agg.byType.entrance.capacity, 30);
  assert.equal(agg.byType.entrance.tandoorOnShelf, 10);
  assert.ok(Math.abs((agg.byType.entrance.percent ?? 0) - (10 / 30) * 100) < 0.001);
}

{
  const sh = baseShowcase({ hasShowcase: false, entrancePortals: 10 });
  const m = computeDistributionForTradePoint(sh, catalogLookup);
  assert.equal(m.hasShowcase, false);
  assert.equal(m.averagePercent, null);
  const agg = aggregateDistribution([m]);
  assert.equal(agg.tradePointsCount, 0);
}

{
  const metrics = [
    computeDistributionForTradePoint(baseShowcase({ tradePointId: "tp-1", entrancePortals: 1 }), catalogLookup),
    computeDistributionForTradePoint(baseShowcase({ tradePointId: "tp-2", entrancePortals: 1 }), catalogLookup),
    computeDistributionForTradePoint(baseShowcase({ tradePointId: "tp-3", entrancePortals: 1 }), catalogLookup),
    computeDistributionForTradePoint(baseShowcase({ tradePointId: "tp-4", entrancePortals: 1 }), catalogLookup),
    computeDistributionForTradePoint(baseShowcase({ tradePointId: "tp-5", entrancePortals: 1 }), catalogLookup),
  ];
  const shMap: Record<string, TradePointShowcaseActualization> = {
    "tp-1": baseShowcase({ tradePointId: "tp-1", entrancePortals: 1, selectedShowcaseModels: [{ productId: "m1", productName: "M", productType: "Модель", selectedAt: "", selectedBy: "", selectedByName: "", portalType: "entrance" }] }),
    "tp-2": baseShowcase({ tradePointId: "tp-2", entrancePortals: 1, selectedShowcaseModels: [{ productId: "m1", productName: "M", productType: "Модель", selectedAt: "", selectedBy: "", selectedByName: "", portalType: "entrance" }] }),
    "tp-3": baseShowcase({ tradePointId: "tp-3", entrancePortals: 1 }),
    "tp-4": baseShowcase({ tradePointId: "tp-4", entrancePortals: 1 }),
    "tp-5": baseShowcase({ tradePointId: "tp-5", entrancePortals: 1 }),
  };
  const cov = computeModelCoverage("m1", "entrance", metrics, shMap);
  assert.equal(cov.presentTradePoints, 2);
  assert.equal(cov.eligibleTradePoints, 5);
  assert.equal(cov.coveragePercent, 40);
}

{
  const cov = computeModelCoverage("m1", "entrance", [], {});
  assert.equal(cov.coveragePercent, null);
}

console.log("distribution-analytics-math: ok");
