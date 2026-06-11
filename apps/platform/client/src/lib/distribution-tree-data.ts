/**
 * Хелперы дерева дистрибуции (группировка, счётчики, scope ТТ).
 */

import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { buildSyntheticBackendTradePoint, getMergedDealerTradePoints } from "@/lib/dealer-trade-points-overrides";
import type { ShowcaseMatrixEntryDto, ShowcaseMatrixStatus } from "@/lib/showcase-matrix-api";
import { resolveShowcaseMatrixPositionForEntry } from "@/lib/showcase-matrix-deficit-tasks";
import { loadCachedMatrix } from "@/lib/showcase-matrix-store";

export type DistributionScope =
  | { kind: "global"; dealers: DealerRow[] }
  | { kind: "dealer"; dealer: DealerRow }
  | { kind: "trade-point"; dealer: DealerRow; point: DealerTradePoint };

export type ScopeTradePointRef = {
  dealer: DealerRow;
  point: DealerTradePoint;
};

export type ShowcaseMatrixStatusCounts = Record<ShowcaseMatrixStatus, number>;

export const EMPTY_STATUS_COUNTS = (): ShowcaseMatrixStatusCounts => ({
  need_install: 0,
  installed: 0,
  postponed: 0,
  not_relevant: 0,
});

let backendScopeProvider: ((dealerId: string) => string[]) | null = null;

export function setBackendScopeProvider(fn: ((dealerId: string) => string[]) | null): void {
  backendScopeProvider = fn;
}

export function collectScopeTradePoints(
  scope: DistributionScope,
  getBackendIds?: (dealerId: string) => string[],
): ScopeTradePointRef[] {
  if (scope.kind === "trade-point") {
    return [{ dealer: scope.dealer, point: scope.point }];
  }

  const dealers = scope.kind === "global" ? scope.dealers : [scope.dealer];
  const out: ScopeTradePointRef[] = [];
  const provider = getBackendIds ?? backendScopeProvider ?? undefined;

  for (const dealer of dealers) {
    const seen = new Set<string>();
    for (const { point } of getMergedDealerTradePoints(dealer, { includeArchived: false })) {
      if (point.status?.trim() === "Архив") continue;
      seen.add(point.id);
      out.push({ dealer, point });
    }
    if (provider) {
      for (const tpId of provider(dealer.id)) {
        if (seen.has(tpId)) continue;
        seen.add(tpId);
        out.push({ dealer, point: buildSyntheticBackendTradePoint(dealer, tpId) });
      }
    }
  }

  return out;
}

export function collectScopeTradePointIds(
  scope: DistributionScope,
  getBackendIds?: (dealerId: string) => string[],
): string[] {
  return collectScopeTradePoints(scope, getBackendIds).map((r) => r.point.id);
}

export function countStatuses(entries: readonly ShowcaseMatrixEntryDto[]): ShowcaseMatrixStatusCounts {
  const counts = EMPTY_STATUS_COUNTS();
  for (const e of entries) {
    counts[e.status] += 1;
  }
  return counts;
}

export type GroupedDistributionTree = Map<string, Map<string, ShowcaseMatrixEntryDto[]>>;

export function groupMatrixEntries(entries: readonly ShowcaseMatrixEntryDto[]): GroupedDistributionTree {
  const tree: GroupedDistributionTree = new Map();

  for (const entry of entries) {
    let byTp = tree.get(entry.dealerId);
    if (!byTp) {
      byTp = new Map();
      tree.set(entry.dealerId, byTp);
    }
    const list = byTp.get(entry.tradePointId) ?? [];
    list.push(entry);
    byTp.set(entry.tradePointId, list);
  }

  return tree;
}

export function mergeEntriesFromCache(tradePointIds: readonly string[]): ShowcaseMatrixEntryDto[] {
  const out: ShowcaseMatrixEntryDto[] = [];
  for (const tpId of tradePointIds) {
    out.push(...loadCachedMatrix(tpId));
  }
  return out;
}

export function resolvePositionDisplayName(entry: ShowcaseMatrixEntryDto, dealer: DealerRow): string {
  const name = resolveShowcaseMatrixPositionForEntry(entry, dealer).productName?.trim();
  return name || entry.targetId;
}

export function entriesForDealer(tree: GroupedDistributionTree, dealerId: string): ShowcaseMatrixEntryDto[] {
  const byTp = tree.get(dealerId);
  if (!byTp) return [];
  const out: ShowcaseMatrixEntryDto[] = [];
  for (const list of byTp.values()) {
    out.push(...list);
  }
  return out;
}

export function entriesForTradePoint(
  tree: GroupedDistributionTree,
  dealerId: string,
  tradePointId: string,
): ShowcaseMatrixEntryDto[] {
  return tree.get(dealerId)?.get(tradePointId) ?? [];
}

export function haystackForScopeRef(ref: ScopeTradePointRef): string {
  const dealer = ref.dealer.name?.trim() ?? "";
  const city = ref.dealer.city?.trim() ?? "";
  const tp = ref.point.name?.trim() ?? "";
  const tpCity = ref.point.city?.trim() ?? "";
  return `${dealer} ${city} ${tp} ${tpCity}`.toLowerCase();
}

export function haystackForDealer(dealer: DealerRow): string {
  return `${dealer.name ?? ""} ${dealer.city ?? ""}`.toLowerCase();
}

export function matchesSearch(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.includes(q);
}
