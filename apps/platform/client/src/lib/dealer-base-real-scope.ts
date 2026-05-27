import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import { managerDisplayMatchesCatalogName } from "@/lib/rop-manager-filters";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import { UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE } from "@shared/admin/actualization-dedupe";

/** РОП (UUID) → catalog teamId в release-сиде. */
const ROP_UUID_TO_CATALOG_TEAM: Record<string, string> = {
  "ccffcf6e-2505-4eee-b257-ac65b60bb779": "team-kupiansky",
  "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa": "team-skalaban",
  "c36f625f-730e-4ae3-b118-bdb005d10b81": "team-sapozhkov",
};

export type RoleScopedDealerRowsForRealOptions = {
  /** UUID менеджера — портфель менеджера (drilldown РОПа на /main/manager/:id). */
  managerUserId?: string;
};

export function realEffectiveTeamLeadTeamIdFromSnap(snap: OrgSnapshot): string {
  const t = snap.teams.find((tt) => tt.ropUserId === snap.me.id);
  return t?.id ?? "";
}

/** Catalog teamId (`team-kupiansky`) для РОПа в real-режиме. */
export function catalogTeamIdForRealTeamLead(snap: OrgSnapshot): string | null {
  const teamUuid = realEffectiveTeamLeadTeamIdFromSnap(snap);
  if (!teamUuid) return null;
  const team = snap.teams.find((t) => t.id === teamUuid);
  if (team?.ropUserId) {
    const mapped = ROP_UUID_TO_CATALOG_TEAM[team.ropUserId];
    if (mapped) return mapped;
  }
  if (teamUuid.startsWith("team-")) return teamUuid;
  return null;
}

function catalogManagerIdsForTeamUuid(snap: OrgSnapshot, teamUuid: string): Set<string> {
  const ids = new Set<string>();
  for (const u of snap.users) {
    if (u.teamId !== teamUuid) continue;
    if (u.role !== "manager" && u.role !== "regional_manager") continue;
    const cat = UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE[u.id];
    if (cat) ids.add(cat);
  }
  return ids;
}

function rowBelongsToRealTeam(row: DealerRow, snap: OrgSnapshot, teamUuid: string, catalogTeam: string | null): boolean {
  if (catalogTeam && row.releaseTeamId === catalogTeam) return true;
  const mgrIds = catalogManagerIdsForTeamUuid(snap, teamUuid);
  if (mgrIds.size > 0 && row.releaseManagerId && mgrIds.has(row.releaseManagerId)) return true;
  return false;
}

/** Строки клиентской базы, закреплённые за менеджером по UUID (catalog id + ФИО). */
export function realRowsForManagerByUUID(rows: DealerRow[], snap: OrgSnapshot, managerUserId: string): DealerRow[] {
  const catalogMgr = UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE[managerUserId];
  const managerName = snap.users.find((u) => u.id === managerUserId)?.fullName?.trim() ?? "";
  return rows.filter((r) => {
    if (catalogMgr && r.releaseManagerId === catalogMgr) return true;
    if (r.releaseManagerId === managerUserId) return true;
    if (managerName) return managerDisplayMatchesCatalogName(r.manager, managerName);
    return false;
  });
}

export function managerBelongsToRopTeam(snap: OrgSnapshot, managerUserId: string): boolean {
  const teamUuid = realEffectiveTeamLeadTeamIdFromSnap(snap);
  if (!teamUuid) return false;
  const manager = snap.users.find((u) => u.id === managerUserId);
  if (!manager) return false;
  if (manager.teamId !== teamUuid) return false;
  return manager.role === "manager" || manager.role === "regional_manager";
}

export function roleScopedDealerRowsForReal(
  rows: DealerRow[],
  snap: OrgSnapshot,
  access: DealerBaseAccessRole,
  options?: RoleScopedDealerRowsForRealOptions,
): DealerRow[] {
  if (options?.managerUserId) {
    return realRowsForManagerByUUID(rows, snap, options.managerUserId);
  }
  if (access === "sales_director") return rows;
  if (access === "team_lead") {
    const teamUuid = realEffectiveTeamLeadTeamIdFromSnap(snap);
    if (!teamUuid) return [];
    const catalogTeam = catalogTeamIdForRealTeamLead(snap);
    return rows.filter((r) => rowBelongsToRealTeam(r, snap, teamUuid, catalogTeam));
  }
  const selfName = snap.users.find((u) => u.id === snap.me.id)?.fullName?.trim() ?? "";
  return rows.filter((r) => {
    if (r.releaseManagerId === snap.me.id) return true;
    if (selfName) return managerDisplayMatchesCatalogName(r.manager, selfName);
    return false;
  });
}
