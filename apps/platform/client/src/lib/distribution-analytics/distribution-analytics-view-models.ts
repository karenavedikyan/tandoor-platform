import type { ActualizationState } from "../client-base-actualization-state.js";
import type { CatalogProduct } from "../catalog-product-type.js";
import type { ClientCategoryId } from "../client-category.js";
import { CATALOG_PRODUCTS } from "../catalog-data.js";
import type { DealerRow } from "../dealer-base-mock-data.js";
import type { ReleaseDemoProfile } from "../release-demo-profile.js";
import { buildTradePointListForActualization, type TradePointListRow } from "../trade-point-list-for-actualization.js";
import { inferShowcasePortalTypeFromCatalogProduct } from "../trade-point-showcase-matrix-required.js";
import { resolveTradePointMatrixModels } from "../trade-point-matrix-resolver.js";
import type { SidebarNavRealScope } from "../sidebar-nav-real-scope.js";
import type { ShowcaseTypeKey } from "../showcase-type-capacity.js";
import {
  aggregateDistribution,
  computeDistributionForTradePoint,
  computeModelCoverage,
  type DistributionGroupMetrics,
  type DistributionTradePointMetrics,
  type EquipmentTypeKey,
  type ModelCoverageMetrics,
} from "./distribution-analytics-math";
import {
  applyDistributionAnalyticsFilters,
  resolveRegionForRow,
  type DistributionAnalyticsFilters,
} from "./distribution-analytics-filters";

export type AnalyticsTradePointRow = {
  row: TradePointListRow;
  metrics: DistributionTradePointMetrics;
};

export type TerritoryCityRow = {
  region: string;
  city: string;
  metrics: DistributionGroupMetrics;
};

export type TerritoryRegionRow = {
  region: string;
  metrics: DistributionGroupMetrics;
  cities: TerritoryCityRow[];
};

export type ProductAnalyticsRow = {
  product: CatalogProduct;
  modelType: EquipmentTypeKey;
  coverage: ModelCoverageMetrics;
  coverageTop150: ModelCoverageMetrics;
  coverageTop350: ModelCoverageMetrics;
  topCities: { city: string; coveragePercent: number | null; present: number; eligible: number }[];
};

export function buildScopedAnalyticsTradePointRows(
  act: ActualizationState,
  profile: ReleaseDemoProfile,
  scopedDealers: DealerRow[],
  realScope?: SidebarNavRealScope,
): TradePointListRow[] {
  // #441: scopedDealers уже корректно ограничен (useDistributionScopedDealers:
  // full_catalog для admin/sales_director/category_manager, role-scope для остальных).
  // Результат ниже всё равно сужается scopedIds, поэтому повторная ре-скопировка по
  // orgScope здесь ИЗБЫТОЧНА и при этом кидает RoleScope-исключение для sales_director/
  // team_lead (dealer-base-real-scope.ts: roleScopedDealerRowsForReal throw). Не передаём orgScope.
  const scopedIds = new Set(scopedDealers.map((d) => d.id));
  const all = buildTradePointListForActualization(act, profile, {
    releaseDealerRows: realScope?.ready ? realScope.releaseDealerRows : undefined,
    assignmentsScope: realScope?.assignmentsScope,
  });
  return all.filter((r) => scopedIds.has(r.dealerId) && !r.isArchived && r.hasShowcase);
}

export function buildAnalyticsTradePointRows(
  rows: TradePointListRow[],
  shByTradePointId: Record<string, ActualizationState["tradePointShowcaseActualizationById"][string] | undefined>,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): AnalyticsTradePointRow[] {
  return rows.map((row) => ({
    row,
    metrics: computeDistributionForTradePoint(shByTradePointId[row.tradePointId], catalogLookup),
  }));
}

export function buildTerritoryRows(
  tpRows: AnalyticsTradePointRow[],
): TerritoryRegionRow[] {
  const byRegion = new Map<string, Map<string, AnalyticsTradePointRow[]>>();
  for (const item of tpRows) {
    const region = resolveRegionForRow(item.row);
    const city = item.row.city || "—";
    if (!byRegion.has(region)) byRegion.set(region, new Map());
    const cityMap = byRegion.get(region)!;
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(item);
  }

  const regions: TerritoryRegionRow[] = [];
  for (const [region, cityMap] of byRegion.entries()) {
    const allInRegion = Array.from(cityMap.values()).flat();
    const cities: TerritoryCityRow[] = [];
    for (const [city, items] of cityMap.entries()) {
      cities.push({
        region,
        city,
        metrics: aggregateDistribution(items.map((x) => x.metrics)),
      });
    }
    cities.sort((a, b) => (a.metrics.averagePercent ?? -1) - (b.metrics.averagePercent ?? -1));
    regions.push({
      region,
      metrics: aggregateDistribution(allInRegion.map((x) => x.metrics)),
      cities,
    });
  }
  regions.sort((a, b) => (a.metrics.averagePercent ?? -1) - (b.metrics.averagePercent ?? -1));
  return regions;
}

function isShowcaseCatalogProduct(p: CatalogProduct): boolean {
  const t = inferShowcasePortalTypeFromCatalogProduct(p);
  return t === "entrance" || t === "interior" || t === "hardware";
}

export function collectAnalyticsCatalogProducts(): CatalogProduct[] {
  return CATALOG_PRODUCTS.filter(isShowcaseCatalogProduct);
}

export function buildProductAnalyticsRows(
  products: CatalogProduct[],
  tpRows: AnalyticsTradePointRow[],
  shByTradePointId: Record<string, ActualizationState["tradePointShowcaseActualizationById"][string] | undefined>,
  allRowsByCategory: (category: ClientCategoryId) => AnalyticsTradePointRow[],
): ProductAnalyticsRow[] {
  const metrics = tpRows.map((x) => x.metrics);
  const rows: ProductAnalyticsRow[] = [];

  for (const product of products) {
    const portalType = inferShowcasePortalTypeFromCatalogProduct(product);
    if (portalType !== "entrance" && portalType !== "interior" && portalType !== "hardware") continue;
    const modelType = portalType;

    const coverage = computeModelCoverage(product.id, modelType, metrics, shByTradePointId);
    const coverageTop150 = computeModelCoverage(
      product.id,
      modelType,
      allRowsByCategory("top150").map((x) => x.metrics),
      shByTradePointId,
    );
    const coverageTop350 = computeModelCoverage(
      product.id,
      modelType,
      allRowsByCategory("top350").map((x) => x.metrics),
      shByTradePointId,
    );

    const byCity = new Map<string, AnalyticsTradePointRow[]>();
    for (const item of tpRows) {
      const city = item.row.city || "—";
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city)!.push(item);
    }
    const topCities = Array.from(byCity.entries())
      .map(([city, items]) => {
        const cityMetrics = items.map((x) => x.metrics);
        const cov = computeModelCoverage(product.id, modelType, cityMetrics, shByTradePointId);
        return {
          city,
          coveragePercent: cov.coveragePercent,
          present: cov.presentTradePoints,
          eligible: cov.eligibleTradePoints,
        };
      })
      .filter((c) => c.eligible > 0)
      .sort((a, b) => (b.coveragePercent ?? -1) - (a.coveragePercent ?? -1))
      .slice(0, 3);

    rows.push({
      product,
      modelType,
      coverage,
      coverageTop150,
      coverageTop350,
      topCities,
    });
  }

  rows.sort((a, b) => (a.coverage.coveragePercent ?? -1) - (b.coverage.coveragePercent ?? -1));
  return rows;
}

export function buildModelGapTradePoints(
  modelId: string,
  modelType: EquipmentTypeKey,
  tpRows: AnalyticsTradePointRow[],
  shByTradePointId: Record<string, ActualizationState["tradePointShowcaseActualizationById"][string] | undefined>,
): {
  row: TradePointListRow;
  freeSlots: number;
}[] {
  const gaps: { row: TradePointListRow; freeSlots: number }[] = [];
  for (const item of tpRows) {
    const sh = shByTradePointId[item.row.tradePointId];
    const cap = item.metrics.byType[modelType].capacity;
    if (cap == null || cap <= 0) continue;
    const required = resolveTradePointMatrixModels({
      dealerId: item.row.dealerId,
      tradePointId: item.row.tradePointId,
      clientCategory: item.row.clientCategory,
      region: item.row.dealer.region,
      city: item.row.city,
    }).some((m) => m.id === modelId);
    if (!required) continue;
    const present = sh?.selectedShowcaseModels?.some((m) => m.productId === modelId) ?? false;
    if (present) continue;
    const onShelf = item.metrics.byType[modelType].tandoorOnShelf;
    gaps.push({ row: item.row, freeSlots: Math.max(0, cap - onShelf) });
  }
  gaps.sort((a, b) => b.freeSlots - a.freeSlots);
  return gaps;
}

export function filterAnalyticsRows(
  rows: TradePointListRow[],
  filters: DistributionAnalyticsFilters,
  act: ActualizationState,
  shByTradePointId: Record<string, ActualizationState["tradePointShowcaseActualizationById"][string] | undefined>,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): TradePointListRow[] {
  return applyDistributionAnalyticsFilters(rows, filters, shByTradePointId, act, catalogLookup);
}

export type DistributionAnalyticsData = {
  filteredRows: TradePointListRow[];
  tradePointRows: AnalyticsTradePointRow[];
  metricsByTradePointId: Record<string, DistributionTradePointMetrics>;
  groupAggregate: DistributionGroupMetrics;
  modelCoverageByModelId: Record<string, ModelCoverageMetrics>;
  productRows: ProductAnalyticsRow[];
  territoryRows: TerritoryRegionRow[];
};

export function buildDistributionAnalyticsData(params: {
  scopedRows: TradePointListRow[];
  filters: DistributionAnalyticsFilters;
  act: ActualizationState;
  catalogLookup: (id: string) => CatalogProduct | undefined;
}): DistributionAnalyticsData {
  const shByTradePointId = params.act.tradePointShowcaseActualizationById;
  const filteredRows = filterAnalyticsRows(
    params.scopedRows,
    params.filters,
    params.act,
    shByTradePointId,
    params.catalogLookup,
  );
  const tradePointRows = buildAnalyticsTradePointRows(filteredRows, shByTradePointId, params.catalogLookup);
  const metricsByTradePointId: Record<string, DistributionTradePointMetrics> = {};
  for (const item of tradePointRows) {
    metricsByTradePointId[item.row.tradePointId] = item.metrics;
  }
  const groupAggregate = aggregateDistribution(tradePointRows.map((x) => x.metrics));
  const products = collectAnalyticsCatalogProducts();
  const productRows = buildProductAnalyticsRows(
    products,
    tradePointRows,
    shByTradePointId,
    (category) =>
      buildAnalyticsTradePointRows(
        params.scopedRows.filter((r) => r.clientCategory === category),
        shByTradePointId,
        params.catalogLookup,
      ),
  );
  const modelCoverageByModelId: Record<string, ModelCoverageMetrics> = {};
  for (const pr of productRows) {
    modelCoverageByModelId[pr.product.id] = pr.coverage;
  }
  return {
    filteredRows,
    tradePointRows,
    metricsByTradePointId,
    groupAggregate,
    modelCoverageByModelId,
    productRows,
    territoryRows: buildTerritoryRows(tradePointRows),
  };
}
