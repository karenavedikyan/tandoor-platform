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
  /**
   * Для РОП/директора: объединённый team state (как на /dealer-base).
   * Если не передан, для расчёта используется только `state` (слой текущего пользователя).
   */
  managementDisplayState?: ActualizationState;
  /** Пока тянем state менеджеров команды — не показываем частичный счётчик в навигации. */
  managementTeamFetchLoading?: boolean;
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
    geoRegion: "",
    geoDistrict: "",
    geoLocality: "",
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
  if (ctx.enabled && ctx.managementTeamFetchLoading) return null;
  const actForRows = ctx.managementDisplayState ?? ctx.state;
  const merged = !ctx.enabled
    ? DEALER_BASE_ROWS
    : buildDealerBaseRowsWithActualization(actForRows, profile, { includeArchivedDealers: false });
  const access = mapSalesRoleToDealerBaseAccess(profile.role);
  const scoped = roleScopedDealerRows(merged, profile);
  const pickerArgs = defaultPickerArgsForNav(profile, access);
  return applyDealerBasePickerFilters(scoped, pickerArgs).length;
}

/**
 * Промт 46: счётчик содержимого Корзины для бейджа nav-item «Корзина».
 * Видимость:
 *   - если есть `managementDisplayState` (rop/director/admin) — считаем по нему;
 *   - иначе (manager) — по `ctx.state` (свой scope).
 *
 * Возвращает `null` пока актуализация / team merge ещё грузятся (как и обычный счётчик).
 */
export function resolveSidebarTrashCount(
  _profile: ReleaseDemoProfile,
  ctx: SidebarDealerClientCountContext,
): number | null {
  if (!ctx.enabled) return null;
  if (ctx.loading) return null;
  if (ctx.managementTeamFetchLoading) return null;
  const act = ctx.managementDisplayState ?? ctx.state;
  const dealers = act.trashedDealersById ?? {};
  const tps = act.trashedTradePointsById ?? {};
  return Object.keys(dealers).length + Object.keys(tps).length;
}
