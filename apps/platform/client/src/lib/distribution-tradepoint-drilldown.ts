/**
 * Drill-down view-model: торговая точка → модели; группы дефицита по ТТ.
 */

import {
  aggregateByModel,
  aggregateByTradePoint,
  listDeficitPositions,
  type DeficitPositionItem,
  type DistributionAnalyticsRow,
  type DistributionMetricsContext,
} from "@/lib/distribution-analytics";
import type { ScopeTradePointRef } from "@/lib/distribution-tree-data";

export type TradePointDrilldownLevel = "tradePoints" | "models";

export type TradePointDrilldownPath = {
  tradePointId?: string;
  tradePointName?: string;
};

export type TradePointDeficitGroup = {
  tradePointId: string;
  tradePointName: string;
  dealerId: string;
  dealerName: string;
  items: DeficitPositionItem[];
  deficitCount: number;
};

export function getTradePointDrilldownLevel(path: TradePointDrilldownPath): TradePointDrilldownLevel {
  if (!path.tradePointId) return "tradePoints";
  return "models";
}

export function selectRefsForTradePointPath(
  refs: readonly ScopeTradePointRef[],
  path: TradePointDrilldownPath,
): ScopeTradePointRef[] {
  let out = [...refs];
  if (path.tradePointId) {
    out = out.filter((ref) => ref.point.id === path.tradePointId);
  }
  return out;
}

export function buildTradePointLevelRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): DistributionAnalyticsRow<ScopeTradePointRef>[] {
  return aggregateByTradePoint(refs, ctxBuilder);
}

export function buildTradePointModelRows(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  tradePointId: string,
): DistributionAnalyticsRow<{ targetId: string; refs: ScopeTradePointRef[] }>[] {
  const scoped = selectRefsForTradePointPath(refs, { tradePointId });
  return aggregateByModel(scoped, ctxBuilder);
}

export function buildDeficitGroupsByTradePoint(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): TradePointDeficitGroup[] {
  const positions = listDeficitPositions(refs, ctxBuilder);
  const byTp = new Map<string, TradePointDeficitGroup>();

  for (const item of positions) {
    let group = byTp.get(item.tradePointId);
    if (!group) {
      group = {
        tradePointId: item.tradePointId,
        tradePointName: item.tradePointName,
        dealerId: item.dealerId,
        dealerName: item.dealerName,
        items: [],
        deficitCount: 0,
      };
      byTp.set(item.tradePointId, group);
    }
    group.items.push(item);
    group.deficitCount += 1;
  }

  return Array.from(byTp.values()).sort((a, b) => {
    if (b.deficitCount !== a.deficitCount) return b.deficitCount - a.deficitCount;
    return a.tradePointName.localeCompare(b.tradePointName, "ru");
  });
}

export function tradePointDrilldownLevelLabel(level: TradePointDrilldownLevel): string {
  switch (level) {
    case "tradePoints":
      return "Торговая точка";
    case "models":
      return "Модель";
    default:
      return "Строка";
  }
}

export function parentTradePointDrilldownPath(path: TradePointDrilldownPath): TradePointDrilldownPath {
  if (getTradePointDrilldownLevel(path) === "models") {
    const { tradePointId: _tp, tradePointName: _tpn, ...rest } = path;
    return rest;
  }
  return {};
}

export function tradePointDrilldownPathForCrumbIndex(
  path: TradePointDrilldownPath,
  crumbIndex: number,
): TradePointDrilldownPath {
  if (crumbIndex <= 0) return {};
  return { tradePointId: path.tradePointId, tradePointName: path.tradePointName };
}
