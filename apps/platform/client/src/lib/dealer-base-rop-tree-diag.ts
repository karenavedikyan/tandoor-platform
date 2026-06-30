import type { TeamScopeMember } from "@shared/dealers-scope-types";
import type { OrgSnapshot } from "./use-org-snapshot.js";
import {
  catalogManagerIdFromUserRef,
  managersCatalogForTeam,
  resolveManagementCatalogTeamId,
  type ManagerRowModel,
  type RopGroupModel,
} from "./dealer-base-management-view-model.js";
import type { MemberTotals } from "@shared/dealers-scope-types";

const DIAG_FLAG_KEY = "tandoor-diag-rop-tree-v1";

export function isRopTreeDiagEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.location.hash.includes("diag-rop-tree")) {
      sessionStorage.setItem(DIAG_FLAG_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(DIAG_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export type RopTeamTreeDiagLine = {
  name: string;
  role: string;
  inCatalog: boolean;
  dbActive: number | null;
  dbOutlets: number | null;
  finalActive: number;
  finalOutlets: number;
  path: "catalog-dbTotals" | "catalog-rows-fallback" | "external" | "orphan" | "missing";
};

export function buildRopTeamTreeDiagLines(input: {
  teamId: string;
  orgSnap: OrgSnapshot;
  members: TeamScopeMember[];
  membersTotalsById?: Map<string, MemberTotals>;
  ropGroup?: RopGroupModel;
}): RopTeamTreeDiagLine[] {
  const catalogTeamId = resolveManagementCatalogTeamId(input.teamId, input.orgSnap);
  const catalogManagers = managersCatalogForTeam(catalogTeamId, input.orgSnap);
  const catalogIds = new Set(catalogManagers.map((m) => m.id));

  const finalByUserId = new Map<string, ManagerRowModel>();
  for (const m of input.ropGroup?.managers ?? []) {
    finalByUserId.set(m.managerId, m);
    for (const u of input.orgSnap.users) {
      if (catalogManagerIdFromUserRef(u.id) === m.managerId) {
        finalByUserId.set(u.id, m);
      }
    }
  }

  return input.members.map((member) => {
    const userId = member.user.id;
    const inCatalog = catalogIds.has(userId);
    const dbTotals = input.membersTotalsById?.get(userId);
    const final =
      finalByUserId.get(userId) ??
      finalByUserId.get(catalogManagerIdFromUserRef(userId));
    const finalActive = final?.active ?? 0;
    const finalOutlets = final?.outlets ?? 0;

    let path: RopTeamTreeDiagLine["path"] = "missing";
    if (final) {
      if (final.isExternal) path = "external";
      else if (final.countsFromServerTotals) path = "catalog-dbTotals";
      else if (inCatalog) path = "catalog-rows-fallback";
      else path = "orphan";
    }

    return {
      name: member.user.name,
      role: member.user.role,
      inCatalog,
      dbActive: dbTotals?.active_dealers ?? null,
      dbOutlets: dbTotals?.active_trade_points ?? null,
      finalActive,
      finalOutlets,
      path,
    };
  });
}
