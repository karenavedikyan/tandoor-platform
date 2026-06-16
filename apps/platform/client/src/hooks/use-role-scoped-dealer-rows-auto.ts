import { useMemo } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import { roleScopedDealerRowsForReal } from "@/lib/dealer-base-real-scope";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";

export function getRoleScopedDealerRowsAuto(
  rows: DealerRow[],
  profile: ReleaseDemoProfile,
  realScope?: SidebarNavRealScope,
): DealerRow[] {
  if (realScope?.ready && realScope.orgScope) {
    return roleScopedDealerRowsForReal(
      rows,
      realScope.orgScope.snap,
      realScope.orgScope.access,
      undefined,
      realScope.assignmentsScope,
    );
  }
  return roleScopedDealerRows(rows, profile);
}

export function useRoleScopedDealerRowsAuto(
  rows: DealerRow[],
  profile: ReleaseDemoProfile,
): DealerRow[] {
  const realScope = useSidebarNavRealScope();
  return useMemo(
    () => getRoleScopedDealerRowsAuto(rows, profile, realScope),
    [rows, profile, realScope],
  );
}
