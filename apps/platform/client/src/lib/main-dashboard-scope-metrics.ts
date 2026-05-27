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

function countTradePointsForRows(rows: DealerRow[], act: ActualizationState): { active: number; archived: number } {
  let active = 0;
  let archived = 0;
  for (const row of rows) {
    for (const entry of mergeTradePointsForActualization(row, act)) {
      if (entry.isArchived) archived += 1;
      else active += 1;
    }
  }
  return { active, archived };
}

/**
 * KPI /main: активные и архивные клиенты и ТТ в заданном scope (после roleScoped*).
 */
export function computeMainDashboardScopeMetrics(
  act: ActualizationState,
  profile: ReleaseDemoProfile,
  scopeRows: (rows: DealerRow[]) => DealerRow[],
): MainDashboardScopeMetrics {
  const activeBuilt = buildDealerBaseRowsWithActualization(act, profile, { includeArchivedDealers: false });
  const archivedBuilt = buildDealerBaseRowsWithActualization(act, profile, { includeArchivedDealers: true });
  const scopedActive = scopeRows(activeBuilt);
  const scopedArchivedOnly = scopeRows(archivedBuilt);
  const tpOnActiveClients = countTradePointsForRows(scopedActive, act);
  const tpOnArchivedClients = countTradePointsForRows(scopedArchivedOnly, act);
  return {
    activeClients: scopedActive.length,
    archivedClients: scopedArchivedOnly.length,
    activeTradePoints: tpOnActiveClients.active,
    archivedTradePoints: tpOnActiveClients.archived + tpOnArchivedClients.active + tpOnArchivedClients.archived,
  };
}
