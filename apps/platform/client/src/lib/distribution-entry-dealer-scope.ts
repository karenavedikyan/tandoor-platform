/**
 * Скоуп дилеров для вкладки «Ввод» в дистрибуции: роль + дефолтный режим работы РОП/директора.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  defaultWorkViewForAccess,
  mapSalesRoleToDealerBaseAccess,
  type DealerBaseAccessRole,
} from "@/lib/dealer-base-role-views";
import { getRoleScopedDealerRowsAuto } from "@/hooks/use-role-scoped-dealer-rows-auto";
import { getEffectiveTeamLeadTeamId, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getRopOptions } from "@/lib/rop-manager-filters";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";

function teamIdsInOrg(): Set<string> {
  return new Set(getRopOptions().map((o) => o.teamId));
}

/**
 * Для РОП/директора — строки портфеля команд (дефолтный work view «Команды» / «Моя команда»),
 * без сужения до личного менеджерского списка.
 */
export function filterDealersForEntryLeadershipScope(
  rows: readonly DealerRow[],
  access: DealerBaseAccessRole,
  profile: ReleaseDemoProfile,
): DealerRow[] {
  if (access === "sales_manager") {
    return [...rows];
  }
  if (access === "team_lead") {
    const tid = getEffectiveTeamLeadTeamId(profile);
    return rows.filter((d) => d.releaseTeamId === tid);
  }
  if (access === "sales_director") {
    const teamIds = teamIdsInOrg();
    if (teamIds.size === 0) {
      return rows.filter((d) => Boolean(d.releaseTeamId?.trim()));
    }
    return rows.filter((d) => d.releaseTeamId && teamIds.has(d.releaseTeamId));
  }
  return [...rows];
}

/** Дилеры для мастера «Ввод» с учётом roleScoped и командного дефолта для РОП/директора. */
export function distributionEntryScopedDealerRows(
  workingRows: readonly DealerRow[],
  profile: ReleaseDemoProfile,
  realScope?: SidebarNavRealScope,
): DealerRow[] {
  const access = mapSalesRoleToDealerBaseAccess(profile.role);
  const scoped = getRoleScopedDealerRowsAuto([...workingRows], profile, realScope);
  void defaultWorkViewForAccess(access);

  if (realScope?.ready) {
    return scoped;
  }

  if (access === "sales_manager") {
    return scoped;
  }

  if (access === "team_lead" || access === "sales_director") {
    return filterDealersForEntryLeadershipScope(scoped, access, profile);
  }

  return scoped;
}
