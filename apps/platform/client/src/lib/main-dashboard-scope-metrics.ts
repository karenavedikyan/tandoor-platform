import {
  buildDealerBaseRowsWithActualization,
  mergeTradePointsForActualization,
} from "@/lib/client-base-actualization-data-merge";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

export type MainDashboardScopeMetrics = {
  activeClients: number;
  archivedClients: number;
  activeTradePoints: number;
  archivedTradePoints: number;
};

function countTradePointsForRows(rows: DealerRow[], act: ActualizationState): number {
  let n = 0;
  for (const row of rows) {
    for (const entry of mergeTradePointsForActualization(row, act)) {
      if (!entry.isArchived) n += 1;
    }
  }
  return n;
}

/**
 * KPI /main: активные клиенты и ТТ в заданном scope (после roleScoped*).
 * Промт 79: архив в JSON state игнорируется — «активные» = все не в корзине.
 */
export function computeMainDashboardScopeMetrics(
  act: ActualizationState,
  profile: ReleaseDemoProfile,
  scopeRows: (rows: DealerRow[]) => DealerRow[],
): MainDashboardScopeMetrics {
  const built = buildDealerBaseRowsWithActualization(act, profile, { includeArchivedDealers: false });
  const scoped = scopeRows(built);
  const activeTradePoints = countTradePointsForRows(scoped, act);
  return {
    activeClients: scoped.length,
    archivedClients: 0,
    activeTradePoints,
    archivedTradePoints: 0,
  };
}
