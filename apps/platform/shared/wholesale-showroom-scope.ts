/**
 * Viewer scope for wholesale /1c/* showroom (employeeGuid-based, not LK teams).
 */

import type { PoolLike } from "./responsibility-resolver.js";
import type { OneCRopNode } from "./one-c-showroom-context.js";
import type { OneCViewer } from "./one-c-showroom-scope.js";
import type { WholesaleOrgReadResult } from "./wholesale-org-types.js";

export type WholesaleEntityRef = {
  /** Route id — for wholesale this is employeeGuid, not users.id. */
  entityId: string;
  idKind: "employee_1c" | "lk_user";
};

export async function resolveConfirmedEmployeeGuid(
  pool: PoolLike,
  userId: string,
): Promise<string | null> {
  try {
    const r = await pool.query<{ employee_guid: string }>(
      `SELECT employee_guid::text
         FROM employee_account_links
        WHERE user_id = $1::uuid
        LIMIT 1`,
      [userId],
    );
    const guid = r.rows[0]?.employee_guid?.trim();
    return guid || null;
  } catch {
    return null;
  }
}

export function wholesaleHierarchyUnrestricted(viewer: OneCViewer): boolean {
  return viewer.role === "admin" || viewer.role === "director";
}

export function filterWholesaleHierarchyForViewer(
  items: OneCRopNode[],
  viewer: OneCViewer,
  confirmedEmployeeGuid: string | null,
): OneCRopNode[] {
  if (wholesaleHierarchyUnrestricted(viewer)) return items;
  if (!confirmedEmployeeGuid) return [];

  if (viewer.role === "rop") {
    return items.filter((n) => n.userId === confirmedEmployeeGuid);
  }

  if (viewer.role === "regional_manager" || viewer.role === "rm") {
    return items
      .map((n) => ({
        ...n,
        rms: n.rms.filter((rm) => rm.userId === confirmedEmployeeGuid),
        managers: n.managers,
      }))
      .filter((n) => n.rms.length > 0 || n.userId === confirmedEmployeeGuid);
  }

  return [];
}

export function canViewWholesaleEmployeePage(
  viewer: OneCViewer,
  targetEmployeeGuid: string,
  pageKind: "rop" | "rm" | "manager",
  org: WholesaleOrgReadResult,
  confirmedEmployeeGuid: string | null,
): boolean {
  if (wholesaleHierarchyUnrestricted(viewer)) return true;
  if (!confirmedEmployeeGuid) return false;

  if (viewer.role === "manager") {
    return pageKind === "manager" && targetEmployeeGuid === confirmedEmployeeGuid;
  }

  if (viewer.role === "regional_manager" || viewer.role === "rm") {
    if (pageKind === "rm" && targetEmployeeGuid === confirmedEmployeeGuid) return true;
    if (pageKind === "manager") {
      return org.clients.some(
        (c) =>
          c.responsibleManagerGuid === targetEmployeeGuid &&
          c.regionalManagerGuid === confirmedEmployeeGuid,
      );
    }
    return false;
  }

  if (viewer.role === "rop") {
    if (targetEmployeeGuid !== confirmedEmployeeGuid && pageKind === "rop") return false;
    if (pageKind === "rop") return targetEmployeeGuid === confirmedEmployeeGuid;
    const ropClients = org.clients.filter((c) => c.headOfSalesGuid === confirmedEmployeeGuid);
    if (pageKind === "rm") {
      return ropClients.some((c) => c.regionalManagerGuid === targetEmployeeGuid);
    }
    if (pageKind === "manager") {
      return ropClients.some((c) => c.responsibleManagerGuid === targetEmployeeGuid);
    }
  }

  return false;
}

export function wholesaleEntityRef(employeeGuid: string): WholesaleEntityRef {
  return { entityId: employeeGuid, idKind: "employee_1c" };
}
