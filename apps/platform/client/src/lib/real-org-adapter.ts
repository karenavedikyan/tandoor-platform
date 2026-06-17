import type { OrgSnapshot } from "./use-org-snapshot.js";
import type { SalesUser } from "./sales-control-data.js";
import type { DealerBaseAccessRole } from "./dealer-base-role-views.js";

export function realRopOptions(snap: OrgSnapshot): Array<{ teamId: string; label: string }> {
  return snap.teams.map((t) => ({ teamId: t.id, label: t.ropName?.trim() ? t.ropName.trim() : t.name }));
}

export function realTeamManagers(snap: OrgSnapshot, teamId: string): SalesUser[] {
  return snap.users
    .filter((u) => u.teamId === teamId && (u.role === "manager" || u.role === "regional_manager"))
    .map(toSalesUser);
}

export function realAllSalesManagers(snap: OrgSnapshot): SalesUser[] {
  return snap.users
    .filter((u) => u.role === "manager" || u.role === "regional_manager")
    .map(toSalesUser);
}

export function realSalesUserById(snap: OrgSnapshot, id: string): SalesUser | null {
  const u = snap.users.find((x) => x.id === id);
  return u ? toSalesUser(u) : null;
}

export function realEffectiveTeamLeadTeamId(snap: OrgSnapshot): string {
  const t = snap.teams.find((tt) => tt.ropUserId === snap.me.id);
  return t?.id ?? "";
}

export function realGetTeamById(snap: OrgSnapshot, teamId: string) {
  const t = snap.teams.find((x) => x.id === teamId);
  if (!t) return null;
  return { id: t.id, name: t.name, ropName: t.ropName?.trim() ? t.ropName.trim() : t.name };
}

function toSalesUser(u: OrgSnapshot["users"][number]): SalesUser {
  const role: SalesUser["role"] =
    u.role === "rop"
      ? "team_lead"
      : u.role === "manager" || u.role === "regional_manager"
        ? "sales_manager"
        : u.role === "marketer"
          ? "marketer"
          : u.role === "analyst"
            ? "analyst"
            : "sales_director";
  return {
    id: u.id,
    name: u.fullName?.trim() ? u.fullName.trim() : u.id,
    role,
    teamId: u.teamId ?? "",
  };
}

/** Аналог `ropOptionsForProfile` для реального org snapshot. */
export function realRopOptionsForAccess(snap: OrgSnapshot, access: DealerBaseAccessRole): Array<{ teamId: string; label: string }> {
  const all = realRopOptions(snap);
  if (access === "sales_director") return all;
  if (access === "team_lead") {
    const tid = realEffectiveTeamLeadTeamId(snap);
    return all.filter((o) => o.teamId === tid);
  }
  const self = snap.users.find((x) => x.id === snap.me.id);
  if (self?.teamId) return all.filter((o) => o.teamId === self.teamId);
  return all;
}

/** Аналог `managerOptionsForProfile`. */
export function realManagerOptionsForAccess(
  snap: OrgSnapshot,
  access: DealerBaseAccessRole,
  ropTeamId: string,
): SalesUser[] {
  if (access === "sales_manager") {
    const u = snap.users.find((x) => x.id === snap.me.id);
    if (u && (u.role === "manager" || u.role === "regional_manager")) return [toSalesUser(u)];
    return realTeamManagers(snap, ropTeamId);
  }
  if (access === "team_lead") {
    return realTeamManagers(snap, realEffectiveTeamLeadTeamId(snap));
  }
  if (ropTeamId === "all" || ropTeamId === "__all__" || !ropTeamId) return realAllSalesManagers(snap);
  return realTeamManagers(snap, ropTeamId);
}

export function realInitialRopManagerDefaults(
  _snap: OrgSnapshot,
  access: DealerBaseAccessRole,
): { ropTeam: string; manager: string } {
  if (access === "sales_director") return { ropTeam: "all", manager: "all" };
  // Real-режим: scope уже сужен в roleScopedDealerRowsForReal; picker сравнивает
  // catalog team/mgr-id, а не UUID из org snapshot — дефолт «all», иначе 0 строк.
  if (access === "team_lead") return { ropTeam: "all", manager: "all" };
  if (access === "sales_manager") return { ropTeam: "all", manager: "all" };
  return { ropTeam: "all", manager: "all" };
}
