/**
 * Единая плоскость данных для управленческих экранов РОП/директора:
 * загрузка и merge нескольких user state с `/api/actualization/state`,
 * те же правила userId, что и дашборд активности (`resolveActualizationDashboardSourceUserIds`).
 */

import { fetchActualizationStateByUserIdsBatch } from "./client-base-actualization-api.js";
import { canActualizeClientBase } from "./client-base-actualization-permissions.js";
import { buildDealerBaseRowsWithActualization } from "./client-base-actualization-data-merge.js";
import {
  countManualDealersInState,
  countManualTradePointsInState,
  mergeActualizationStatesForActivityDashboard,
  resolveActualizationDashboardSourceUserIds,
} from "./client-base-actualization-team-state-merge.js";
import { createEmptyActualizationState, type ActualizationState } from "./client-base-actualization-state.js";
import {
  getTeamActualizationCacheKey,
  invalidateTeamActualizationCache,
  runWithTeamActualizationCache,
} from "./client-base-team-actualization-cache.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import type { UserRole } from "@shared/auth";

export { invalidateTeamActualizationCache };

export type TeamActualizationFetchDiagnostics = {
  requestedUserIds: string[];
  loadedSnapshots: number;
  failedSnapshots: number;
  emptySnapshots: number;
  sumManualDealersAcrossSources: number;
};

export type TeamActualizationFetchResult = {
  merged: ActualizationState;
  parts: { userId: string; state: ActualizationState }[];
  diagnostics: TeamActualizationFetchDiagnostics;
  errorMessage?: string;
};

function emptyDiag(ids: string[]): TeamActualizationFetchDiagnostics {
  return {
    requestedUserIds: ids,
    loadedSnapshots: 0,
    failedSnapshots: 0,
    emptySnapshots: 0,
    sumManualDealersAcrossSources: 0,
  };
}

function roleQueryForTeamBatch(profile: ReleaseDemoProfile): string | undefined {
  if (profile.role === "team_lead" || profile.role === "sales_director") return profile.role;
  return undefined;
}

async function fetchMergedTeamActualizationForManagementUncached(
  profile: ReleaseDemoProfile,
  dashboardRopTeamId: string,
): Promise<TeamActualizationFetchResult> {
  const ids = resolveActualizationDashboardSourceUserIds(profile, dashboardRopTeamId);
  if (ids.length === 0) {
    return {
      merged: createEmptyActualizationState(),
      parts: [],
      diagnostics: emptyDiag([]),
      errorMessage: "Не задан пользователь для загрузки актуализации.",
    };
  }

  const batchParts = await fetchActualizationStateByUserIdsBatch(ids, roleQueryForTeamBatch(profile));
  const batchByUserId = new Map(batchParts.map((p) => [p.userId, p]));
  let failed = 0;
  let empty = 0;
  let sumManual = 0;
  const parts: { userId: string; state: ActualizationState }[] = [];

  for (const id of ids) {
    const r = batchByUserId.get(id);
    if (!r || r.syncStatus === "error" || !r.meta.success) {
      failed += 1;
      parts.push({ userId: id, state: createEmptyActualizationState() });
      continue;
    }
    const st = r.meta.state;
    const md = countManualDealersInState(st);
    sumManual += md;
    const mt = countManualTradePointsInState(st);
    if (md === 0 && mt === 0 && Object.keys(st.dealerOverridesById ?? {}).length === 0) {
      empty += 1;
    }
    parts.push({ userId: id, state: st });
  }

  const merged = mergeActualizationStatesForActivityDashboard(parts);
  const errorMessage =
    failed > 0 ? `Не удалось загрузить часть state (${failed} из ${ids.length}).` : undefined;

  return {
    merged,
    parts,
    diagnostics: {
      requestedUserIds: ids,
      loadedSnapshots: ids.length - failed,
      failedSnapshots: failed,
      emptySnapshots: empty,
      sumManualDealersAcrossSources: sumManual,
    },
    errorMessage,
  };
}

/**
 * Загружает state по всем userId в scope и объединяет в один снимок для списков/KPI.
 * Используется РОП/директором; менеджеру не нужен (см. {@link shouldUseTeamMergedActualizationPlane}).
 */
export async function fetchMergedTeamActualizationForManagement(
  profile: ReleaseDemoProfile,
  dashboardRopTeamId: string,
): Promise<TeamActualizationFetchResult> {
  const ids = resolveActualizationDashboardSourceUserIds(profile, dashboardRopTeamId);
  const key = getTeamActualizationCacheKey(dashboardRopTeamId, ids);
  return runWithTeamActualizationCache(key, () =>
    fetchMergedTeamActualizationForManagementUncached(profile, dashboardRopTeamId),
  );
}

/**
 * РОП и директор при включённой актуализации используют объединённый team plane.
 * Региональный менеджер (authRole === "regional_manager") ИСКЛЮЧЁН: у него
 * profile.role === "team_lead" (для Дистрибуции), но разделы Клиенты/ТТ он должен
 * видеть как обычный менеджер (плоский список), а не управленческий кокпит.
 */
export function shouldUseTeamMergedActualizationPlane(
  profile: ReleaseDemoProfile,
  authRole?: UserRole | null,
): boolean {
  if (authRole === "regional_manager") return false;
  return canActualizeClientBase(profile) && (profile.role === "team_lead" || profile.role === "sales_director");
}

export function buildManagementDealerBaseRows(
  mergedState: ActualizationState,
  profile: ReleaseDemoProfile,
): DealerRow[] {
  return buildDealerBaseRowsWithActualization(mergedState, profile);
}

/** KPI полосы «как на dealer-base» — один расчёт для совпадения цифр между блоками. */
export function computeManagementDealerPickerKpis(rows: DealerRow[]): {
  total: number;
  active: number;
  potential: number;
  attention: number;
  outlets: number;
  avgDist: number;
} {
  const total = rows.length;
  const active = rows.filter((r) => r.status === "активный").length;
  const potential = rows.filter((r) => r.status === "потенциальный").length;
  const attention = rows.filter((r) => r.status === "требует внимания" || r.hasProblem).length;
  const outlets = rows.reduce((a, r) => a + r.outlets, 0);
  const avgDist = total > 0 ? Math.round(rows.reduce((a, r) => a + r.distribution, 0) / total) : 0;
  return { total, active, potential, attention, outlets, avgDist };
}
