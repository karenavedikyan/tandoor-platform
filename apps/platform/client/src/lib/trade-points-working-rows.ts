/**
 * Рабочие строки ТТ для счётчиков — тот же источник, что `workingRows` / `summary.total` на /trade-points.
 */

import { createEmptyActualizationState, type ActualizationState } from "./client-base-actualization-state.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import {
  buildTradePointListForActualization,
  type TradePointListRow,
} from "./trade-point-list-for-actualization.js";
import type { SidebarNavRealScope } from "./sidebar-nav-real-scope.js";

export type BuildTradePointsWorkingRowsInput = {
  profile: ReleaseDemoProfile;
  actEnabled: boolean;
  actState: ActualizationState;
  realScope?: SidebarNavRealScope;
};

export function buildTradePointsWorkingRowsForCount(
  input: BuildTradePointsWorkingRowsInput,
): TradePointListRow[] | null {
  const { profile, actEnabled, actState, realScope } = input;

  if (realScope?.isRealUser && realScope.loading) return null;

  const state = actEnabled ? actState : createEmptyActualizationState();

  if (realScope?.isRealUser && !realScope.ready) {
    return [];
  }

  const opts: Parameters<typeof buildTradePointListForActualization>[2] = {
    includeArchivedTradePoints: false,
  };

  if (realScope?.ready && realScope.releaseDealerRows && realScope.orgScope) {
    opts.releaseDealerRows = realScope.releaseDealerRows;
    opts.orgScope = realScope.orgScope;
    opts.assignmentsScope = realScope.assignmentsScope;
  }

  return buildTradePointListForActualization(state, profile, opts);
}

export function countTradePointsWorkingRows(input: BuildTradePointsWorkingRowsInput): number | null {
  const rows = buildTradePointsWorkingRowsForCount(input);
  if (rows === null) return null;
  return rows.length;
}
