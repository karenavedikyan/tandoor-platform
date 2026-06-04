/**
 * Drill-down view-model: город → торговые точки.
 */

import {
  aggregateByCity,
  aggregateByTradePoint,
  resolveCityLabelForRef,
  type DistributionAnalyticsRow,
  type DistributionMetricsContext,
} from "@/lib/distribution-analytics";
import type { ScopeTradePointRef } from "@/lib/distribution-tree-data";

export type CityDrilldownLevel = "cities" | "tradePoints";

export type CityDrilldownPath = {
  city?: string;
};

export function getCityDrilldownLevel(path: CityDrilldownPath): CityDrilldownLevel {
  return path.city ? "tradePoints" : "cities";
}

export function selectRefsForCityPath(
  refs: readonly ScopeTradePointRef[],
  path: CityDrilldownPath,
): ScopeTradePointRef[] {
  if (!path.city) return [...refs];
  return refs.filter((ref) => resolveCityLabelForRef(ref) === path.city);
}

export function buildCityLevelRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): DistributionAnalyticsRow<{ city: string; refs: ScopeTradePointRef[] }>[] {
  return aggregateByCity(refs, ctxBuilder);
}

export function buildCityTradePointRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  city: string,
): DistributionAnalyticsRow<ScopeTradePointRef>[] {
  const scoped = selectRefsForCityPath(refs, { city });
  return aggregateByTradePoint(scoped, ctxBuilder);
}

export function cityDrilldownLevelLabel(level: CityDrilldownLevel): string {
  switch (level) {
    case "cities":
      return "Город";
    case "tradePoints":
      return "Торговая точка";
    default:
      return "Строка";
  }
}

export function parentCityDrilldownPath(_path: CityDrilldownPath): CityDrilldownPath {
  return {};
}
