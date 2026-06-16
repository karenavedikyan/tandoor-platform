import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import { managerDisplayMatchesCatalogName } from "@/lib/rop-manager-filters";
import type { OrgSnapshot, OrgSnapshotUser } from "@/lib/use-org-snapshot";
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
  /** UUID РОПа — портфель команды (drilldown директора на /main/rop/:id). */
  ropUserId?: string;
};

/** Закрепления из `client_assignments` (Промт 70). */
export type AssignmentsScope = {
  ownCodes: Set<string>;
  teamCodes: Set<string>;
  /** Клиенты, выданные ропу через rop_client_grants — read-scope поверх own/team. */
  grantedCodes?: Set<string>;
};

export function assignmentsScopeIsActive(scope: AssignmentsScope | undefined): boolean {
  if (!scope) return false;
  return scope.ownCodes.size > 0 || scope.teamCodes.size > 0 || (scope.grantedCodes?.size ?? 0) > 0;
}

function rowMatchesAssignmentCodes(r: DealerRow, codes: Set<string>): boolean {
  const catalog = r.releaseCode?.trim();
  if (catalog && codes.has(catalog)) return true;
  const external = r.external1cCode?.trim();
  if (external && codes.has(external)) return true;
  return codes.has(r.id);
}

export function rowInAssignmentsScope(r: DealerRow, scope: AssignmentsScope | undefined): boolean {
  if (!assignmentsScopeIsActive(scope)) return false;
  const catalog = r.releaseCode?.trim();
  const external = r.external1cCode?.trim();
  const granted = scope!.grantedCodes;
  if (catalog && (scope!.ownCodes.has(catalog) || scope!.teamCodes.has(catalog) || (granted?.has(catalog) ?? false)))
    return true;
  if (external && (scope!.ownCodes.has(external) || scope!.teamCodes.has(external) || (granted?.has(external) ?? false)))
    return true;
  return (
    scope!.ownCodes.has(r.id) ||
    scope!.teamCodes.has(r.id) ||
    (granted?.has(r.id) ?? false)
  );
}

function rowsForAssignmentsScope(
  rows: DealerRow[],
  access: DealerBaseAccessRole,
  scope: AssignmentsScope,
): DealerRow[] {
  if (access === "sales_director") return rows;
  const matchesOwn = (r: DealerRow) => rowMatchesAssignmentCodes(r, scope.ownCodes);
  const matchesTeam = (r: DealerRow) => rowMatchesAssignmentCodes(r, scope.teamCodes);
  const matchesGranted = (r: DealerRow) =>
    scope.grantedCodes ? rowMatchesAssignmentCodes(r, scope.grantedCodes) : false;
  if (access === "team_lead") {
    return rows.filter((r) => matchesTeam(r) || matchesOwn(r) || matchesGranted(r));
  }
  return rows.filter((r) => matchesOwn(r) || matchesGranted(r));
}

export function realEffectiveTeamLeadTeamIdFromSnap(snap: OrgSnapshot): string {
  const t = snap.teams.find((tt) => tt.ropUserId === snap.me.id);
  return t?.id ?? "";
}

/** UUID команды для team-scope: РОП — через teams.rop_user_id, регионал — через user_team_memberships.teamId. */
export function realEffectiveTeamUuidFromSnap(snap: OrgSnapshot): string {
  if (snap.me.role === "regional_manager") {
    const fromUsers = snap.users.find((u) => u.id === snap.me.id)?.teamId;
    const fromMe = snap.me.teamId;
    if (typeof console !== "undefined" && console.debug) {
      console.debug("[rm-scope]", {
        meId: snap.me.id,
        fromUsers,
        fromMe,
        snapUsersCount: snap.users.length,
      });
    }
    return fromUsers ?? fromMe ?? "";
  }
  return realEffectiveTeamLeadTeamIdFromSnap(snap);
}

/** Catalog teamId (`team-kupiansky`) для команды по UUID. */
export function catalogTeamIdForTeamUuid(snap: OrgSnapshot, teamUuid: string): string | null {
  const team = snap.teams.find((t) => t.id === teamUuid);
  if (team?.ropUserId) {
    const mapped = ROP_UUID_TO_CATALOG_TEAM[team.ropUserId];
    if (mapped) return mapped;
  }
  if (teamUuid.startsWith("team-")) return teamUuid;
  return null;
}

/** UUID команды по UUID РОПа (для drilldown директора). */
export function teamUuidForRopUserId(snap: OrgSnapshot, ropUserId: string): string | null {
  const team = snap.teams.find((t) => t.ropUserId === ropUserId);
  return team?.id ?? null;
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

/** Catalog teamId для команды конкретного РОПа (drilldown директора). */
export function catalogTeamIdForRopUserId(snap: OrgSnapshot, ropUserId: string): string | null {
  const mapped = ROP_UUID_TO_CATALOG_TEAM[ropUserId];
  if (mapped) return mapped;
  const teamUuid = teamUuidForRopUserId(snap, ropUserId);
  if (teamUuid?.startsWith("team-")) return teamUuid;
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

/** Строки клиентской базы команды РОПа (по UUID РОПа). */
export function realRowsForRopTeam(rows: DealerRow[], snap: OrgSnapshot, ropUserId: string): DealerRow[] {
  const teamUuid = teamUuidForRopUserId(snap, ropUserId);
  if (!teamUuid) return [];
  const catalogTeam = catalogTeamIdForRopUserId(snap, ropUserId);
  return rows.filter((r) => rowBelongsToRealTeam(r, snap, teamUuid, catalogTeam));
}

/** @alias realRowsForRopTeam */
export const realRowsForTeam = realRowsForRopTeam;

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

export function managersForRopTeam(snap: OrgSnapshot, ropUserId: string): OrgSnapshotUser[] {
  const teamUuid = teamUuidForRopUserId(snap, ropUserId);
  if (!teamUuid) return [];
  return snap.users
    .filter((u) => u.teamId === teamUuid && (u.role === "manager" || u.role === "regional_manager"))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
}

export function ropUserForManager(snap: OrgSnapshot, managerUserId: string): OrgSnapshotUser | null {
  const manager = snap.users.find((u) => u.id === managerUserId);
  if (!manager?.teamId) return null;
  const team = snap.teams.find((t) => t.id === manager.teamId);
  if (!team?.ropUserId) return null;
  return snap.users.find((u) => u.id === team.ropUserId) ?? null;
}

export function managerBelongsToRopTeam(snap: OrgSnapshot, managerUserId: string): boolean {
  const teamUuid = realEffectiveTeamLeadTeamIdFromSnap(snap);
  if (!teamUuid) return false;
  const manager = snap.users.find((u) => u.id === managerUserId);
  if (!manager) return false;
  if (manager.teamId !== teamUuid) return false;
  return manager.role === "manager" || manager.role === "regional_manager";
}

export function isRopUserInSnapshot(snap: OrgSnapshot, ropUserId: string): boolean {
  const user = snap.users.find((u) => u.id === ropUserId);
  return user?.role === "rop";
}

export function roleScopedDealerRowsForReal(
  rows: DealerRow[],
  snap: OrgSnapshot,
  access: DealerBaseAccessRole,
  options?: RoleScopedDealerRowsForRealOptions,
  assignmentsScope?: AssignmentsScope,
): DealerRow[] {
  if (options?.managerUserId) {
    return realRowsForManagerByUUID(rows, snap, options.managerUserId);
  }
  if (options?.ropUserId) {
    return realRowsForRopTeam(rows, snap, options.ropUserId);
  }
  if (snap.me.role === "regional_manager") {
    // [prompt-354] личный scope по dealer_overrides.regional_manager_id (выдаётся сервером в assignmentsScope.ownCodes)
    if (assignmentsScopeIsActive(assignmentsScope)) {
      const ownCodesUpper = new Set(
        Array.from(assignmentsScope!.ownCodes).map((c) => c.toUpperCase().trim()),
      );
      if (ownCodesUpper.size === 0) {
        console.warn("[rm-scope] regional_manager: ownCodes пуст — возвращаем []", { meId: snap.me.id });
        return [];
      }
      return rows.filter((r) => {
        const code = (r.releaseCode ?? "").toUpperCase().trim();
        return code.length > 0 && ownCodesUpper.has(code);
      });
    }
    console.warn("[rm-scope] regional_manager: assignmentsScope не готов — []", { meId: snap.me.id });
    return [];
  }
  if (assignmentsScopeIsActive(assignmentsScope)) {
    return rowsForAssignmentsScope(rows, access, assignmentsScope!);
  }
  if (access === "sales_director") return rows;
  if (access === "team_lead") {
    const teamUuid = realEffectiveTeamUuidFromSnap(snap);
    if (!teamUuid) return [];
    const catalogTeam = catalogTeamIdForRealTeamLead(snap) ?? catalogTeamIdForTeamUuid(snap, teamUuid);
    return rows.filter((r) => rowBelongsToRealTeam(r, snap, teamUuid, catalogTeam));
  }
  const selfName = snap.users.find((u) => u.id === snap.me.id)?.fullName?.trim() ?? "";
  return rows.filter((r) => {
    if (r.releaseManagerId === snap.me.id) return true;
    if (selfName) return managerDisplayMatchesCatalogName(r.manager, selfName);
    return false;
  });
}
