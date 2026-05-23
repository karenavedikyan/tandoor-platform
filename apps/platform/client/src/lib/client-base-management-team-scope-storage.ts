/**
 * Общий выбор команды (РОП) для management plane: dealer-base, trade-points, сайдбар, team-fetch.
 * Директор: persist в localStorage + событие; РОП/менеджер: только нормализация id.
 */

import { getRopOptions } from "@/lib/rop-manager-filters";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";
import {
  initialRopManagerForProfile,
  mapSalesRoleToDealerBaseAccess,
  type DealerBaseAccessRole,
} from "@/lib/dealer-base-role-views";

export const MANAGEMENT_TEAM_SCOPE_LS_KEY = "tandoor-client-base-management-team-scope-v1";

/** Событие в window: смена scope команды (та же вкладка или кросс-таб). */
export const MANAGEMENT_TEAM_SCOPE_CHANGED_EVENT = "tandoor-management-team-scope-v1";

export type ManagementTeamScopeChangedDetail = { ropTeamId: string };

function isKnownRopTeamId(id: string): boolean {
  return getRopOptions().some((o) => o.teamId === id);
}

/** «Все команды» и legacy-синонимы → `all`. */
export function normalizeManagementDashboardRopTeamId(raw: string): string {
  const t = raw.trim();
  if (isRopOrManagerAllFilter(t)) return "all";
  return t;
}

export function readPersistedDirectorManagementRopTeamId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MANAGEMENT_TEAM_SCOPE_LS_KEY)?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ropTeamId?: string };
    const id = typeof parsed?.ropTeamId === "string" ? parsed.ropTeamId.trim() : "";
    if (!id) return null;
    const norm = normalizeManagementDashboardRopTeamId(id);
    if (norm === "all") return "all";
    return isKnownRopTeamId(norm) ? norm : null;
  } catch {
    return null;
  }
}

export function writePersistedDirectorManagementRopTeamId(ropTeamId: string): void {
  if (typeof window === "undefined") return;
  try {
    const norm = normalizeManagementDashboardRopTeamId(ropTeamId);
    window.localStorage.setItem(MANAGEMENT_TEAM_SCOPE_LS_KEY, JSON.stringify({ ropTeamId: norm }));
  } catch {
    /* ignore */
  }
}

export function dispatchManagementTeamScopeChanged(ropTeamId: string): void {
  if (typeof window === "undefined") return;
  const norm = normalizeManagementDashboardRopTeamId(ropTeamId);
  window.dispatchEvent(
    new CustomEvent<ManagementTeamScopeChangedDetail>(MANAGEMENT_TEAM_SCOPE_CHANGED_EVENT, {
      detail: { ropTeamId: norm },
    }),
  );
}

export function publishManagementDashboardRopTeamId(ropTeamId: string, profile: ReleaseDemoProfile): void {
  if (profile.role !== "sales_director") return;
  const norm = normalizeManagementDashboardRopTeamId(ropTeamId);
  writePersistedDirectorManagementRopTeamId(norm);
  dispatchManagementTeamScopeChanged(norm);
}

/**
 * Стартовый scope для provider: LS (директор), фиксированная команда РОП, URL (team) если hash = dealer-base | trade-points | client-base-activity.
 */
export function resolveInitialManagementDashboardRopTeamId(
  profile: ReleaseDemoProfile,
  access: DealerBaseAccessRole,
): string {
  if (profile.role === "team_lead") {
    return getEffectiveTeamLeadTeamId(profile);
  }
  if (profile.role === "sales_manager") {
    return initialRopManagerForProfile(profile, access).ropTeam;
  }
  if (profile.role === "sales_director") {
    const persisted = readPersistedDirectorManagementRopTeamId();
    if (persisted) return persisted;
    const fromUrl = readTeamIdFromLocationForManagementPages();
    if (fromUrl) return normalizeManagementDashboardRopTeamId(fromUrl);
    return "all";
  }
  return initialRopManagerForProfile(profile, access).ropTeam;
}

function readHashPath(): string {
  if (typeof window === "undefined") return "";
  const h = window.location.hash.replace(/^#/, "").trim();
  const path = h.split("?")[0] ?? "";
  return path.startsWith("/") ? path : `/${path}`;
}

function readTeamIdFromLocationForManagementPages(): string | null {
  if (typeof window === "undefined") return null;
  const path = readHashPath();
  if (path !== "/dealer-base" && path !== "/trade-points" && path !== "/client-base-activity") return null;
  try {
    const qs = new URLSearchParams(window.location.search);
    const raw = (qs.get("team") ?? qs.get("rop"))?.trim() ?? "";
    if (!raw || isRopOrManagerAllFilter(raw)) return "all";
    return isKnownRopTeamId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function readTeamQueryFromLocationForManagementPages(): string | null {
  return readTeamIdFromLocationForManagementPages();
}
