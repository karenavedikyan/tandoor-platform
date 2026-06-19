import {
  buildDealerBaseRowsWithActualization,
  mergeTradePointsForActualization,
} from "./client-base-actualization-data-merge.js";
import type { ActualizationState } from "./client-base-actualization-state.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";

export type MainDashboardScopeMetrics = {
  activeClients: number;
  activeTradePoints: number;
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
 * «Активные» = все не в корзине.
 */
export function computeMainDashboardScopeMetrics(
  act: ActualizationState,
  profile: ReleaseDemoProfile,
  scopeRows: (rows: DealerRow[]) => DealerRow[],
): MainDashboardScopeMetrics {
  const built = buildDealerBaseRowsWithActualization(act, profile);
  const scoped = scopeRows(built);
  const activeTradePoints = countTradePointsForRows(scoped, act);
  return {
    activeClients: scoped.length,
    activeTradePoints,
  };
}
