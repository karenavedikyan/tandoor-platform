import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import { managerDisplayMatchesCatalogName } from "@/lib/rop-manager-filters";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";

function realEffectiveTeamLeadTeamIdFromSnap(snap: OrgSnapshot): string {
  const t = snap.teams.find((tt) => tt.ropUserId === snap.me.id);
  return t?.id ?? "";
}

export function roleScopedDealerRowsForReal(rows: DealerRow[], snap: OrgSnapshot, access: DealerBaseAccessRole): DealerRow[] {
  if (access === "sales_director") return rows;
  if (access === "team_lead") {
    const tid = realEffectiveTeamLeadTeamIdFromSnap(snap);
    return rows.filter((r) => r.releaseTeamId === tid);
  }
  const selfName = snap.users.find((u) => u.id === snap.me.id)?.fullName?.trim() ?? "";
  return rows.filter((r) => {
    if (r.releaseManagerId === snap.me.id) return true;
    if (selfName) return managerDisplayMatchesCatalogName(r.manager, selfName);
    return false;
  });
}
