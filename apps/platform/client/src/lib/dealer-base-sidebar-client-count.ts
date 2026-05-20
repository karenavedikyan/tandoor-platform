/**
 * Число клиентов в рабочей базе для бейджа навигации — та же логика, что у KPI «Всего»
 * на /dealer-base при фильтрах по умолчанию (без архива, с учётом актуализации).
 */

import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { applyDealerBasePickerFilters, type DealerBasePickerArgs } from "@/lib/dealer-base-picker-filters";
import {
  initialRopManagerForProfile,
  mapSalesRoleToDealerBaseAccess,
  roleScopedDealerRows,
  type DealerBaseAccessRole,
} from "@/lib/dealer-base-role-views";
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { getManagersForRopTeam } from "@/lib/rop-manager-filters";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

export type SidebarDealerClientCountContext = {
  /** Как в ClientBaseActualizationProvider: false для маркетолога/аналитика и при выключенной фиче. */
  enabled: boolean;
  /** Первичная загрузка / refresh актуализации — не показываем устаревшее число. */
  loading: boolean;
  state: ActualizationState;
};

function defaultPickerArgsForNav(profile: ReleaseDemoProfile, access: DealerBaseAccessRole): DealerBasePickerArgs {
  const init = initialRopManagerForProfile(profile, access);
  return {
    search: "",
    quick: "all",
    cities: [],
    categories: [],
    ropTeam: init.ropTeam,
    manager: init.manager,
    managerCatalogForRop: getManagersForRopTeam(init.ropTeam),
  };
}

/**
 * @returns количество клиентов в рабочей базе или `null`, пока актуализация загружается (enabled && loading).
 */
export function resolveSidebarWorkingDealerClientCount(
  profile: ReleaseDemoProfile,
  ctx: SidebarDealerClientCountContext,
): number | null {
  if (ctx.enabled && ctx.loading) return null;
  const merged = !ctx.enabled
    ? DEALER_BASE_ROWS
    : buildDealerBaseRowsWithActualization(ctx.state, profile, { includeArchivedDealers: false });
  const access = mapSalesRoleToDealerBaseAccess(profile.role);
  const scoped = roleScopedDealerRows(merged, profile);
  const pickerArgs = defaultPickerArgsForNav(profile, access);
  return applyDealerBasePickerFilters(scoped, pickerArgs).length;
}
