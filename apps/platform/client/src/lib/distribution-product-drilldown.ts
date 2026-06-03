/**
 * Drill-down view-model: продукт (модель) → торговые точки.
 *
 * На уровне ТТ coverage отражает одну модель в одной точке (planCount=1),
 * а не общее покрытие витрины — статус модели в drilldownRef.
 */

import {
  aggregateByModel,
  statusForModelInTradePoint,
  type DistributionAnalyticsRow,
  type DistributionCoverage,
  type DistributionMetricsContext,
} from "@/lib/distribution-analytics";
import type { ShowcaseMatrixStatus } from "@/lib/showcase-matrix-api";
import type { ScopeTradePointRef } from "@/lib/distribution-tree-data";

export type ProductDrilldownLevel = "products" | "tradePoints";

export type ProductDrilldownPath = {
  targetId?: string;
  productName?: string;
};

/** Строка уровня «ТТ для продукта»: ref точки + статус модели в ней. */
export type ProductTradePointDrilldownRef = {
  ref: ScopeTradePointRef;
  modelStatus: ShowcaseMatrixStatus | null;
};

function roundPct(value: number): number {
  return Math.round(value);
}

function maxIsoDate(dates: readonly (string | null | undefined)[]): string | null {
  let max: string | null = null;
  for (const d of dates) {
    const t = d?.trim();
    if (!t) continue;
    if (!max || t > max) max = t;
  }
  return max;
}

/** Покрытие одной модели в одной ТТ (для таблицы drill «продукт → ТТ»). */
function coverageForModelInTradePoint(
  ctx: DistributionMetricsContext,
  targetId: string,
): DistributionCoverage {
  const status = statusForModelInTradePoint(ctx, targetId);
  const installed = status === "installed";
  const planModel = ctx.planModels.find((m) => m.targetId === targetId);
  const planCount = planModel ? 1 : 0;
  const factCount = installed && planCount > 0 ? 1 : 0;
  const weight = planModel && Number.isFinite(planModel.valueWeight) && planModel.valueWeight > 0
    ? planModel.valueWeight
    : 0;
  const qualitativePct = weight > 0 ? roundPct(installed ? 100 : 0) : null;
  const modelEntries = ctx.entries.filter(
    (e) =>
      (e.targetKind === "model" || e.targetKind === "variant") && e.targetId === targetId,
  );

  return {
    planCount,
    factCount,
    deficitCount: Math.max(0, planCount - factCount),
    quantitativePct: planCount > 0 ? roundPct((factCount / planCount) * 100) : null,
    qualitativePct,
    dataCoveragePct: ctx.entries.length > 0 ? 100 : 0,
    tradePointsTotal: 1,
    tradePointsWithData: ctx.entries.length > 0 ? 1 : 0,
    lastUpdatedAt: maxIsoDate(modelEntries.map((e) => e.updatedAt).concat(ctx.entries.map((e) => e.updatedAt))),
  };
}

export function getProductDrilldownLevel(path: ProductDrilldownPath): ProductDrilldownLevel {
  if (!path.targetId) return "products";
  return "tradePoints";
}

export function buildProductLevelRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): DistributionAnalyticsRow<{ targetId: string; refs: ScopeTradePointRef[] }>[] {
  return aggregateByModel(refs, ctxBuilder);
}

export function selectModelRefsForTradePoints(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  targetId: string,
): ScopeTradePointRef[] {
  const row = aggregateByModel(refs, ctxBuilder).find((r) => r.key === targetId);
  return row?.drilldownRef.refs ?? [];
}

export function buildProductTradePointRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  targetId: string,
): DistributionAnalyticsRow<ProductTradePointDrilldownRef>[] {
  const modelRefs = selectModelRefsForTradePoints(refs, ctxBuilder, targetId);

  return modelRefs.map((ref) => {
    const ctx = ctxBuilder(ref);
    const modelStatus = statusForModelInTradePoint(ctx, targetId);
    return {
      key: ref.point.id,
      label: ref.point.name?.trim() || ref.point.id,
      coverage: coverageForModelInTradePoint(ctx, targetId),
      drilldownRef: { ref, modelStatus },
    };
  });
}

export function productDrilldownLevelLabel(level: ProductDrilldownLevel): string {
  switch (level) {
    case "products":
      return "Продукт";
    case "tradePoints":
      return "Торговая точка";
    default:
      return "Строка";
  }
}

export function parentProductDrilldownPath(path: ProductDrilldownPath): ProductDrilldownPath {
  if (getProductDrilldownLevel(path) === "tradePoints") {
    const { targetId: _id, productName: _name, ...rest } = path;
    return rest;
  }
  return {};
}

export function productDrilldownPathForCrumbIndex(
  path: ProductDrilldownPath,
  crumbIndex: number,
): ProductDrilldownPath {
  if (crumbIndex <= 0) return {};
  return { targetId: path.targetId, productName: path.productName };
}
