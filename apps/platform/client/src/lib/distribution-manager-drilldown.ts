/**
 * Drill-down view-model: менеджер → город → клиент → ТТ → модели.
 */

import {
  aggregateByCity,
  aggregateByDealer,
  aggregateByManager,
  aggregateByModel,
  aggregateByTradePoint,
  resolveCityLabelForRef,
  resolveManagerKeyForRef,
  type DistributionAnalyticsRow,
  type DistributionMetricsContext,
  type ManagerAggregationOptions,
} from "@/lib/distribution-analytics";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ScopeTradePointRef } from "@/lib/distribution-tree-data";

export type ManagerDrilldownLevel = "managers" | "cities" | "clients" | "tradePoints" | "models";

export type ManagerDrilldownPath = {
  managerKey?: string;
  managerLabel?: string;
  city?: string;
  dealerId?: string;
  dealerName?: string;
  tradePointId?: string;
  tradePointName?: string;
};

export function getManagerDrilldownLevel(path: ManagerDrilldownPath): ManagerDrilldownLevel {
  if (!path.managerKey) return "managers";
  if (!path.city) return "cities";
  if (!path.dealerId) return "clients";
  if (!path.tradePointId) return "tradePoints";
  return "models";
}

export function selectRefsForPath(
  refs: readonly ScopeTradePointRef[],
  path: ManagerDrilldownPath,
  options?: ManagerAggregationOptions,
): ScopeTradePointRef[] {
  let out = [...refs];
  if (path.managerKey) {
    out = out.filter((ref) => resolveManagerKeyForRef(ref, options) === path.managerKey);
  }
  if (path.city) {
    out = out.filter((ref) => resolveCityLabelForRef(ref) === path.city);
  }
  if (path.dealerId) {
    out = out.filter((ref) => ref.dealer.id === path.dealerId);
  }
  if (path.tradePointId) {
    out = out.filter((ref) => ref.point.id === path.tradePointId);
  }
  return out;
}

export function buildManagerLevelRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  options?: ManagerAggregationOptions,
): DistributionAnalyticsRow<{ managerKey: string; refs: ScopeTradePointRef[] }>[] {
  return aggregateByManager(refs, ctxBuilder, options);
}

export function buildManagerCityRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  managerKey: string,
  options?: ManagerAggregationOptions,
): DistributionAnalyticsRow<{ city: string; refs: ScopeTradePointRef[] }>[] {
  const scoped = selectRefsForPath(refs, { managerKey }, options);
  return aggregateByCity(scoped, ctxBuilder);
}

export function buildManagerClientRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  managerKey: string,
  city: string,
  options?: ManagerAggregationOptions,
): DistributionAnalyticsRow<{ dealer: DealerRow; refs: ScopeTradePointRef[] }>[] {
  const scoped = selectRefsForPath(refs, { managerKey, city }, options);
  return aggregateByDealer(scoped, ctxBuilder);
}

export function buildManagerTradePointRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  managerKey: string,
  city: string,
  dealerId: string,
  options?: ManagerAggregationOptions,
): DistributionAnalyticsRow<ScopeTradePointRef>[] {
  const scoped = selectRefsForPath(refs, { managerKey, city, dealerId }, options);
  return aggregateByTradePoint(scoped, ctxBuilder);
}

export function buildManagerModelRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  tradePointId: string,
): DistributionAnalyticsRow<{ targetId: string; refs: ScopeTradePointRef[] }>[] {
  const scoped = selectRefsForPath(refs, { tradePointId });
  return aggregateByModel(scoped, ctxBuilder);
}

export function managerDrilldownLevelLabel(level: ManagerDrilldownLevel): string {
  switch (level) {
    case "managers":
      return "Менеджер";
    case "cities":
      return "Город";
    case "clients":
      return "Клиент";
    case "tradePoints":
      return "Торговая точка";
    case "models":
      return "Модель";
    default:
      return "Строка";
  }
}

/** Сужает path на один уровень вверх (для «Назад» и крошек). */
export function parentManagerDrilldownPath(path: ManagerDrilldownPath): ManagerDrilldownPath {
  const level = getManagerDrilldownLevel(path);
  if (level === "models") {
    const { tradePointId: _tp, tradePointName: _tpn, ...rest } = path;
    return rest;
  }
  if (level === "tradePoints") {
    const { dealerId: _d, dealerName: _dn, ...rest } = path;
    return rest;
  }
  if (level === "clients") {
    const { city: _c, ...rest } = path;
    return rest;
  }
  if (level === "cities") {
    const { managerKey: _mk, managerLabel: _ml, ...rest } = path;
    return rest;
  }
  return {};
}

/** Path для крошки по индексу: 0 = корень менеджеры, 1 = менеджер, … */
export function managerDrilldownPathForCrumbIndex(
  path: ManagerDrilldownPath,
  crumbIndex: number,
): ManagerDrilldownPath {
  if (crumbIndex <= 0) return {};
  if (crumbIndex === 1) {
    return { managerKey: path.managerKey, managerLabel: path.managerLabel };
  }
  if (crumbIndex === 2) {
    return {
      managerKey: path.managerKey,
      managerLabel: path.managerLabel,
      city: path.city,
    };
  }
  if (crumbIndex === 3) {
    return {
      managerKey: path.managerKey,
      managerLabel: path.managerLabel,
      city: path.city,
      dealerId: path.dealerId,
      dealerName: path.dealerName,
    };
  }
  return { ...path };
}
