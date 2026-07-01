/**
 * Рабочие строки клиентской базы для счётчиков — тот же источник, что `pickerFiltered` / KPI «Всего» на /dealer-base.
 */

import { buildDealerBaseRowsWithActualization } from "./client-base-actualization-data-merge.js";
import { createEmptyActualizationState, type ActualizationState } from "./client-base-actualization-state.js";
import { getCatalogDealerRows } from "./dealer-base-source.js";
import { applyDealerBasePickerFilters, type DealerBasePickerArgs } from "./dealer-base-picker-filters.js";
import {
  initialRopManagerForProfile,
  mapSalesRoleToDealerBaseAccess,
  roleScopedDealerRows,
  type DealerBaseAccessRole,
} from "./dealer-base-role-views.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import {
  assignmentsScopeIsActive,
  roleScopedDealerRowsForReal,
  safeRoleScopedDealerRowsForReal,
} from "./dealer-base-real-scope.js";
import {
  dealerExternalKeysFromOrgScope,
  dealerExternalKeysFromTeamScope,
} from "./dealer-scope-external-keys.js";
import { getManagersForRopTeam } from "./rop-manager-filters.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import type { SidebarNavRealScope } from "./sidebar-nav-real-scope.js";

function scopeDealerRowsForRealCount(rows: DealerRow[], realScope: SidebarNavRealScope): DealerRow[] {
  const { orgScope, assignmentsScope } = realScope;
  if (!orgScope) return rows;

  const access = orgScope.access;
  if (realScope.platformRole === "rop" && access === "team_lead") {
    if (!realScope.teamScope) return [];
    const keys = dealerExternalKeysFromTeamScope(realScope.teamScope);
    return rows.filter((r) => keys.has(r.id));
  }
  if (realScope.platformRole === "director" && access === "sales_director") {
    if (!realScope.orgScopeData) return [];
    const keys = dealerExternalKeysFromOrgScope(realScope.orgScopeData);
    return rows.filter((r) => keys.has(r.id));
  }
  if (access === "team_lead" || access === "sales_director") {
    return safeRoleScopedDealerRowsForReal(
      rows,
      orgScope.snap,
      access,
      undefined,
      assignmentsScopeIsActive(assignmentsScope) ? assignmentsScope : undefined,
    );
  }

  return roleScopedDealerRowsForReal(
    rows,
    orgScope.snap,
    access,
    undefined,
    assignmentsScopeIsActive(assignmentsScope) ? assignmentsScope : undefined,
  );
}

export type BuildDealerBaseWorkingRowsInput = {
  profile: ReleaseDemoProfile;
  actEnabled: boolean;
  actState: ActualizationState;
  realScope?: SidebarNavRealScope;
};

export function defaultDealerBasePickerArgsForCount(
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
  isRealScopeReady = false,
): DealerBasePickerArgs {
  // В real-режиме строки уже отфильтрованы roleScopedDealerRowsForReal
  // (по DB-кодам из client_assignments + assignmentsScope). Дополнительный
  // profile-based ropTeam/manager фильтр применять НЕ нужно — он опирается
  // на demo-persona, которая для реальных руководителей может не совпадать
  // с реальной командой (см. промт 334).
  if (isRealScopeReady) {
    return {
      search: "",
      quick: "all",
      cities: [],
      categories: [],
      ropTeam: "all",
      manager: "all",
      managerCatalogForRop: [],
      geoRegion: "",
      geoDistrict: "",
      geoLocality: "",
    };
  }
  const init = initialRopManagerForProfile(profile, access);
  return {
    search: "",
    quick: "all",
    cities: [],
    categories: [],
    ropTeam: init.ropTeam,
    manager: init.manager,
    managerCatalogForRop: getManagersForRopTeam(init.ropTeam),
    geoRegion: "",
    geoDistrict: "",
    geoLocality: "",
  };
}

export function buildDealerBaseWorkingRowsForCount(input: BuildDealerBaseWorkingRowsInput) {
  const { profile, actEnabled, actState, realScope } = input;

  if (realScope?.isRealUser && realScope.loading) return null;

  if (realScope?.isRealUser && !realScope.ready) {
    return [];
  }

  if (!actEnabled) {
    if (realScope?.ready && realScope.releaseDealerRows && realScope.orgScope) {
      return scopeDealerRowsForRealCount(realScope.releaseDealerRows, realScope);
    }
    if (realScope?.isRealUser) {
      return [];
    }
    return getCatalogDealerRows();
  }

  const merged = buildDealerBaseRowsWithActualization(actState, profile, {
    releaseDealerRows: realScope?.ready ? realScope.releaseDealerRows : undefined,
  });

  if (realScope?.ready && realScope.orgScope) {
    return scopeDealerRowsForRealCount(merged, realScope);
  }

  return roleScopedDealerRows(merged, profile);
}

export function countDealerBaseHeaderTotal(input: BuildDealerBaseWorkingRowsInput): number | null {
  const scoped = buildDealerBaseWorkingRowsForCount(input);
  if (scoped === null) return null;

  const access =
    input.realScope?.ready && input.realScope.orgScope
      ? input.realScope.orgScope.access
      : mapSalesRoleToDealerBaseAccess(input.profile.role);

  const isRealScopeReady = Boolean(input.realScope?.ready && input.realScope.orgScope);
  const pickerArgs = defaultDealerBasePickerArgsForCount(input.profile, access, isRealScopeReady);
  return applyDealerBasePickerFilters(scoped, pickerArgs).length;
}

/** Для тестов: пустой state без актуализации. */
export function emptyDealerBaseCountInput(profile: ReleaseDemoProfile): BuildDealerBaseWorkingRowsInput {
  return {
    profile,
    actEnabled: false,
    actState: createEmptyActualizationState(),
  };
}
