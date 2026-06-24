/**
 * Запуск: `npm run test:distribution-analytics-sort` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { DistributionGroupMetrics } from "../distribution-analytics/distribution-analytics-math";
import type { ProductAnalyticsRow, TerritoryRegionRow } from "../distribution-analytics/distribution-analytics-view-models";
import {
  compareNullableNumber,
  compareTerritoryEntries,
  defaultSortDirForKey,
  sortProductRows,
  sortTerritoryRows,
} from "../distribution-analytics/distribution-analytics-sort";

function metrics(partial: {
  average?: number | null;
  entrance?: number | null;
  interior?: number | null;
  hardware?: number | null;
  count?: number;
}): DistributionGroupMetrics {
  return {
    averagePercent: partial.average ?? null,
    tradePointsCount: partial.count ?? 0,
    byType: {
      entrance: { capacity: 10, tandoorOnShelf: 5, percent: partial.entrance ?? null },
      interior: { capacity: 10, tandoorOnShelf: 5, percent: partial.interior ?? null },
      hardware: { capacity: 10, tandoorOnShelf: 5, percent: partial.hardware ?? null },
    },
  };
}

function productRow(
  id: string,
  name: string,
  coveragePercent: number | null,
  present = 0,
): ProductAnalyticsRow {
  return {
    product: { id, name, image: null } as ProductAnalyticsRow["product"],
    modelType: "entrance",
    coverage: {
      modelId: id,
      modelType: "entrance",
      presentTradePoints: present,
      eligibleTradePoints: 10,
      coveragePercent,
    },
    coverageTop150: {
      modelId: id,
      modelType: "entrance",
      presentTradePoints: 0,
      eligibleTradePoints: 0,
      coveragePercent: null,
    },
    coverageTop350: {
      modelId: id,
      modelType: "entrance",
      presentTradePoints: 0,
      eligibleTradePoints: 0,
      coveragePercent: null,
    },
    topCities: [],
  };
}

assert.equal(defaultSortDirForKey("average"), "desc");
assert.equal(defaultSortDirForKey("name"), "asc");

assert.ok(compareNullableNumber(80, 40, "desc") < 0);
assert.ok(compareNullableNumber(null, 40, "desc") > 0);
assert.ok(compareNullableNumber(40, null, "desc") < 0);
assert.ok(compareNullableNumber(null, null, "desc") === 0);

assert.ok(
  compareTerritoryEntries("A", metrics({ average: 90 }), "B", metrics({ average: 50 }), "average", "desc") < 0,
);
assert.ok(
  compareTerritoryEntries("A", metrics({ average: null }), "B", metrics({ average: 10 }), "average", "desc") > 0,
);

const territoryRows: TerritoryRegionRow[] = [
  {
    region: "Север",
    metrics: metrics({ average: 30, count: 2 }),
    cities: [
      { region: "Север", city: "Мурманск", metrics: metrics({ average: 20 }) },
      { region: "Север", city: "Архангельск", metrics: metrics({ average: 80 }) },
    ],
  },
  {
    region: "Юг",
    metrics: metrics({ average: 70, count: 3 }),
    cities: [
      { region: "Юг", city: "Сочи", metrics: metrics({ average: 60 }) },
      { region: "Юг", city: "Краснодар", metrics: metrics({ average: 90 }) },
    ],
  },
];

const sortedTerritory = sortTerritoryRows(territoryRows, "average", "desc");
assert.deepEqual(
  sortedTerritory.map((r) => r.region),
  ["Юг", "Север"],
);
assert.deepEqual(
  sortedTerritory[0]!.cities.map((c) => c.city),
  ["Краснодар", "Сочи"],
);

const productRows = [
  productRow("m1", "Alpha", 10, 1),
  productRow("m2", "Beta", 80, 5),
  productRow("m3", "Gamma", null, 0),
];
const sortedProducts = sortProductRows(productRows, "coverage", "desc");
assert.deepEqual(
  sortedProducts.map((r) => r.product.id),
  ["m2", "m1", "m3"],
);

console.log("distribution-analytics-sort.test.ts: ok");
