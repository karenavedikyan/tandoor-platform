import type { DistributionGroupMetrics } from "./distribution-analytics-math";
import type { ProductAnalyticsRow, TerritoryRegionRow } from "./distribution-analytics-view-models";

export type SortDir = "asc" | "desc";

export function defaultSortDirForKey(key: string): SortDir {
  return key === "name" || key === "type" ? "asc" : "desc";
}

/** null/NaN трактуются как самые низкие значения (при DESC уходят вниз). */
export function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: SortDir,
): number {
  const an = a == null || !Number.isFinite(Number(a)) ? -1 : Number(a);
  const bn = b == null || !Number.isFinite(Number(b)) ? -1 : Number(b);
  return dir === "asc" ? an - bn : bn - an;
}

export function compareLocaleString(a: string, b: string, dir: SortDir): number {
  return dir === "asc" ? a.localeCompare(b, "ru") : b.localeCompare(a, "ru");
}

export type TerritorySortKey = "average" | "entrance" | "interior" | "hardware" | "count" | "name";

function territorySortNumber(
  sortKey: TerritorySortKey,
  metrics: DistributionGroupMetrics,
): number | null {
  switch (sortKey) {
    case "average":
      return metrics.averagePercent;
    case "entrance":
      return metrics.byType.entrance.percent;
    case "interior":
      return metrics.byType.interior.percent;
    case "hardware":
      return metrics.byType.hardware.percent;
    case "count":
      return metrics.tradePointsCount;
    default:
      return null;
  }
}

export function compareTerritoryEntries(
  nameA: string,
  metricsA: DistributionGroupMetrics,
  nameB: string,
  metricsB: DistributionGroupMetrics,
  sortKey: TerritorySortKey,
  dir: SortDir,
): number {
  if (sortKey === "name") return compareLocaleString(nameA, nameB, dir);
  return compareNullableNumber(
    territorySortNumber(sortKey, metricsA),
    territorySortNumber(sortKey, metricsB),
    dir,
  );
}

export function sortTerritoryRows(
  rows: TerritoryRegionRow[],
  sortKey: TerritorySortKey,
  dir: SortDir,
): TerritoryRegionRow[] {
  const sortedRegions = [...rows].sort((a, b) =>
    compareTerritoryEntries(a.region, a.metrics, b.region, b.metrics, sortKey, dir),
  );
  return sortedRegions.map((region) => ({
    ...region,
    cities: [...region.cities].sort((a, b) =>
      compareTerritoryEntries(a.city, a.metrics, b.city, b.metrics, sortKey, dir),
    ),
  }));
}

export type ProductSortKey = "coverage" | "present" | "top150" | "top350" | "name" | "type";

const PRODUCT_TYPE_ORDER: Record<ProductAnalyticsRow["modelType"], number> = {
  entrance: 0,
  interior: 1,
  hardware: 2,
};

function productSortNumber(row: ProductAnalyticsRow, sortKey: ProductSortKey): number | null {
  switch (sortKey) {
    case "coverage":
      return row.coverage.coveragePercent;
    case "present":
      return row.coverage.presentTradePoints;
    case "top150":
      return row.coverageTop150.coveragePercent;
    case "top350":
      return row.coverageTop350.coveragePercent;
    default:
      return null;
  }
}

export function compareProductRows(
  a: ProductAnalyticsRow,
  b: ProductAnalyticsRow,
  sortKey: ProductSortKey,
  dir: SortDir,
): number {
  if (sortKey === "name") return compareLocaleString(a.product.name, b.product.name, dir);
  if (sortKey === "type") {
    const ao = PRODUCT_TYPE_ORDER[a.modelType];
    const bo = PRODUCT_TYPE_ORDER[b.modelType];
    return dir === "asc" ? ao - bo : bo - ao;
  }
  return compareNullableNumber(productSortNumber(a, sortKey), productSortNumber(b, sortKey), dir);
}

export function sortProductRows(
  rows: ProductAnalyticsRow[],
  sortKey: ProductSortKey,
  dir: SortDir,
): ProductAnalyticsRow[] {
  return [...rows].sort((a, b) => compareProductRows(a, b, sortKey, dir));
}
