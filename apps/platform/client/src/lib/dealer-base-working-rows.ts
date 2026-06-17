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
import { roleScopedDealerRowsForReal } from "./dealer-base-real-scope.js";
import { getManagersForRopTeam } from "./rop-manager-filters.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import type { SidebarNavRealScope } from "./sidebar-nav-real-scope.js";

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
      return roleScopedDealerRowsForReal(
        realScope.releaseDealerRows,
        realScope.orgScope.snap,
        realScope.orgScope.access,
        undefined,
        realScope.assignmentsScope,
      );
    }
    if (realScope?.isRealUser) {
      return [];
    }
    return getCatalogDealerRows();
  }

  const merged = buildDealerBaseRowsWithActualization(actState, profile, {
    includeArchivedDealers: false,
    releaseDealerRows: realScope?.ready ? realScope.releaseDealerRows : undefined,
  });

  if (realScope?.ready && realScope.orgScope) {
    return roleScopedDealerRowsForReal(
      merged,
      realScope.orgScope.snap,
      realScope.orgScope.access,
      undefined,
      realScope.assignmentsScope,
    );
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
