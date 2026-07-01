/**
 * Пересечение портфеля менеджера с зоной наблюдающего РОП (страница штаба менеджера).
 * Нормализация — dealerIdToClientCode / #974 / #976.
 */

import type { DbScopeResult } from "./db-scope-formula.js";
import { buildNormalizedDealerScopeSet, clientIdMatchesNormalizedScope } from "./trade-points-manager-detail-scope.js";

export function intersectExternalKeyLists(targetKeys: string[], viewerKeys: string[]): string[] {
  const viewerNorm = buildNormalizedDealerScopeSet(viewerKeys);
  if (viewerNorm.size === 0) return [];
  return targetKeys.filter((k) => clientIdMatchesNormalizedScope(k, viewerNorm));
}

export function intersectTargetDealerScopeWithViewerZone(
  targetScope: DbScopeResult,
  viewerExternalKeys: string[],
): DbScopeResult {
  const viewerNorm = buildNormalizedDealerScopeSet(viewerExternalKeys);
  const activeIds: string[] = [];
  const activeKeys: string[] = [];
  for (let i = 0; i < targetScope.active_dealer_external_keys.length; i++) {
    const key = targetScope.active_dealer_external_keys[i]!;
    if (clientIdMatchesNormalizedScope(key, viewerNorm)) {
      activeIds.push(targetScope.active_dealer_ids[i]!);
      activeKeys.push(key);
    }
  }
  return {
    ...targetScope,
    active_dealer_ids: activeIds,
    active_dealer_external_keys: activeKeys,
    trashed_dealer_ids: [],
    trashed_dealer_external_keys: [],
    totals: {
      ...targetScope.totals,
      active_dealers: activeKeys.length,
      trashed_dealers: 0,
      trashed_trade_points: 0,
    },
    scope_explanation: {
      ...targetScope.scope_explanation,
      all_codes: activeKeys.length,
    },
  };
}
