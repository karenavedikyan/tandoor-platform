/**
 * Drill-down view-model: клиент → ТТ → модели.
 */

import {
  aggregateByDealer,
  aggregateByModel,
  aggregateByTradePoint,
  type DistributionAnalyticsRow,
  type DistributionMetricsContext,
} from "@/lib/distribution-analytics";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ScopeTradePointRef } from "@/lib/distribution-tree-data";

export type ClientDrilldownLevel = "clients" | "tradePoints" | "models";

export type ClientDrilldownPath = {
  dealerId?: string;
  dealerName?: string;
  tradePointId?: string;
  tradePointName?: string;
};

export function getClientDrilldownLevel(path: ClientDrilldownPath): ClientDrilldownLevel {
  if (!path.dealerId) return "clients";
  if (!path.tradePointId) return "tradePoints";
  return "models";
}

export function selectRefsForClientPath(
  refs: readonly ScopeTradePointRef[],
  path: ClientDrilldownPath,
): ScopeTradePointRef[] {
  let out = [...refs];
  if (path.dealerId) {
    out = out.filter((ref) => ref.dealer.id === path.dealerId);
  }
  if (path.tradePointId) {
    out = out.filter((ref) => ref.point.id === path.tradePointId);
  }
  return out;
}

export function buildClientLevelRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): DistributionAnalyticsRow<{ dealer: DealerRow; refs: ScopeTradePointRef[] }>[] {
  return aggregateByDealer(refs, ctxBuilder);
}

export function buildClientTradePointRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  dealerId: string,
): DistributionAnalyticsRow<ScopeTradePointRef>[] {
  const scoped = selectRefsForClientPath(refs, { dealerId });
  return aggregateByTradePoint(scoped, ctxBuilder);
}

export function buildClientModelRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  tradePointId: string,
): DistributionAnalyticsRow<{ targetId: string; refs: ScopeTradePointRef[] }>[] {
  const scoped = selectRefsForClientPath(refs, { tradePointId });
  return aggregateByModel(scoped, ctxBuilder);
}

export function clientDrilldownLevelLabel(level: ClientDrilldownLevel): string {
  switch (level) {
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

export function parentClientDrilldownPath(path: ClientDrilldownPath): ClientDrilldownPath {
  const level = getClientDrilldownLevel(path);
  if (level === "models") {
    const { tradePointId: _tp, tradePointName: _tpn, ...rest } = path;
    return rest;
  }
  if (level === "tradePoints") {
    const { dealerId: _d, dealerName: _dn, ...rest } = path;
    return rest;
  }
  return {};
}

export function clientDrilldownPathForCrumbIndex(
  path: ClientDrilldownPath,
  crumbIndex: number,
): ClientDrilldownPath {
  if (crumbIndex <= 0) return {};
  if (crumbIndex === 1) {
    return { dealerId: path.dealerId, dealerName: path.dealerName };
  }
  return { ...path };
}
