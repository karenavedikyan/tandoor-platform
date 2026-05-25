/**
 * Демо-профиль Release 1: роль и персона без backend (sessionStorage).
 * При выключенном demo-bypass персона выводится из роли серверного пользователя (UserRole → SalesRole).
 */

import type { UserRole } from "@shared/auth";
import type { SalesRole } from "@/lib/sales-control-data";
import {
  getAllSalesManagers,
  getSalesUserById,
  getTeamManagers,
  SALES_USERS,
} from "@/lib/sales-control-data";
import { isDemoAuthBypassEnabled } from "@/lib/release-demo-bypass";
import { userRoleToSalesRole } from "@/lib/role-mapping";

export const RELEASE_DEMO_PROFILE_KEY = "tandoor-release-demo-profile-v1";
export const RELEASE_DEMO_PROFILE_EVENT = "release-demo-profile-changed";

export type ReleaseDemoProfile = {
  role: SalesRole;
  /** id пользователя из SALES_USERS, соответствующий выбранной роли */
  personaUserId: string;
};

const DEFAULT: ReleaseDemoProfile = {
  role: "sales_manager",
  personaUserId: "mgr-boyko-em",
};

const SALES_CONTROL_MANAGER_KEY = "sales-control-demo-manager-id";

export function defaultPersonaForRole(role: SalesRole): string {
  if (role === "sales_director") return "user-dir-goncharenko";
  if (role === "team_lead") return "user-tl-kupiansky";
  if (role === "sales_manager") return "mgr-boyko-em";
  if (role === "marketer") return "user-mkt-morozova";
  return "user-anl-ivanets";
}

export function listPersonasForRole(role: SalesRole): { id: string; name: string }[] {
  return SALES_USERS.filter((u) => u.role === role).map((u) => ({ id: u.id, name: u.name }));
}

export function loadReleaseDemoProfile(serverUserRole?: UserRole | null): ReleaseDemoProfile {
  if (typeof window === "undefined") return { ...DEFAULT };

  if (serverUserRole) {
    const sr = userRoleToSalesRole(serverUserRole);
    return { role: sr, personaUserId: defaultPersonaForRole(sr) };
  }

  if (isDemoAuthBypassEnabled() && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(RELEASE_DEMO_PROFILE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<ReleaseDemoProfile>;
        const role = (p.role ?? DEFAULT.role) as SalesRole;
        let personaUserId = p.personaUserId ?? defaultPersonaForRole(role);
        const allowed = listPersonasForRole(role).some((x) => x.id === personaUserId);
        if (!allowed) personaUserId = defaultPersonaForRole(role);
        return { role, personaUserId };
      }
    } catch {
      return { ...DEFAULT };
    }
  }

  return { ...DEFAULT };
}

export function saveReleaseDemoProfile(next: ReleaseDemoProfile, hasActiveServerUser = false): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  if (hasActiveServerUser) return;
  if (!isDemoAuthBypassEnabled()) return;
  window.sessionStorage.setItem(RELEASE_DEMO_PROFILE_KEY, JSON.stringify(next));
  if (next.role === "sales_manager") {
    const u = getSalesUserById(next.personaUserId);
    if (u?.role === "sales_manager") {
      window.sessionStorage.setItem(SALES_CONTROL_MANAGER_KEY, next.personaUserId);
    }
  }
  window.dispatchEvent(new Event(RELEASE_DEMO_PROFILE_EVENT));
}

/** Менеджер для панели план-факта: персона-менеджер или первый менеджер команды руководителя. */
export function getEffectiveSalesManagerId(profile: ReleaseDemoProfile): string {
  const u = getSalesUserById(profile.personaUserId);
  if (u?.role === "sales_manager") return u.id;
  if (profile.role === "team_lead" && u?.role === "team_lead" && u.teamId) {
    const mgrs = getTeamManagers(u.teamId);
    return mgrs[0]?.id ?? defaultPersonaForRole("sales_manager");
  }
  if (profile.role === "sales_director" || profile.role === "marketer" || profile.role === "analyst") {
    return getAllSalesManagers()[0]?.id ?? "mgr-boyko-em";
  }
  return defaultPersonaForRole("sales_manager");
}

/** Команда для панели руководителя команды. */
export function getEffectiveTeamLeadTeamId(profile: ReleaseDemoProfile): string {
  const u = getSalesUserById(profile.personaUserId);
  if (u?.role === "team_lead" && u.teamId) return u.teamId;
  if (u?.role === "sales_manager" && u.teamId) return u.teamId;
  return "team-kupiansky";
}

export function releaseDemoRoleLabel(role: SalesRole): string {
  switch (role) {
    case "sales_director":
      return "Руководитель продаж";
    case "team_lead":
      return "Руководитель команды";
    case "sales_manager":
      return "Менеджер";
    case "marketer":
      return "Маркетолог";
    case "analyst":
      return "Аналитик";
    default:
      return role;
  }
}
