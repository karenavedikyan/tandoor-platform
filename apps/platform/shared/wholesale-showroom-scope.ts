/**
 * Viewer scope for wholesale /1c/* showroom (employeeGuid-based, not LK teams).
 */

import type { PoolLike } from "./responsibility-resolver.js";
import type { OneCRopNode } from "./one-c-showroom-context.js";
import type { OneCViewer } from "./one-c-showroom-scope.js";
import type { WholesaleOrgReadResult } from "./wholesale-org-types.js";
import {
  buildWholesaleViewerScope,
  clientInViewerScope,
  type WholesaleViewerScope,
} from "./wholesale-viewer-scope.js";

export type WholesaleEntityRef = {
  entityId: string;
  idKind: "employee_1c" | "lk_user";
};

const NO_ROP_GUID = "__no_rop__";

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

function countStoresForClients(org: WholesaleOrgReadResult, clientGuids: Set<string>): number {
  const stores = new Set<string>();
  for (const c of org.clients) {
    if (!clientGuids.has(c.guidClient)) continue;
    for (const s of c.storeGuids) stores.add(s);
  }
  return stores.size;
}

function filterNodeForScope(
  node: OneCRopNode,
  org: WholesaleOrgReadResult,
  scope: WholesaleViewerScope,
): OneCRopNode | null {
  const ropKey = node.userId;
  const ropClients = org.clients.filter(
    (c) => (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey && clientInViewerScope(c, scope),
  );
  if (ropClients.length === 0 && scope.ropContextGuid !== ropKey) return null;

  const allowedMgrGuids = new Set(
    ropClients.map((c) => c.responsibleManagerGuid).filter(Boolean) as string[],
  );
  const allowedRmGuids = new Set(
    ropClients.map((c) => c.regionalManagerGuid).filter(Boolean) as string[],
  );

  const managers = node.managers
    .filter((m) => allowedMgrGuids.has(m.userId))
    .map((m) => {
      const mgrClients = ropClients.filter((c) => c.responsibleManagerGuid === m.userId);
      const storeSet = new Set(mgrClients.flatMap((c) => c.storeGuids));
      return {
        ...m,
        legalCount: mgrClients.length,
        storeCount: storeSet.size,
      };
    });

  const rms = node.rms
    .filter((rm) => allowedRmGuids.has(rm.userId))
    .map((rm) => {
      const rmClients = ropClients.filter((c) => c.regionalManagerGuid === rm.userId);
      const storeSet = new Set(rmClients.flatMap((c) => c.storeGuids));
      return {
        ...rm,
        legalCount: rmClients.length,
        storeCount: storeSet.size,
      };
    });

  const storeSet = new Set(ropClients.flatMap((c) => c.storeGuids));
  return {
    ...node,
    managers,
    rms,
    managerCount: managers.length,
    rmCount: rms.length,
    legalCount: ropClients.length,
    storeCount: storeSet.size,
  };
}

export function filterWholesaleHierarchyForViewer(
  items: OneCRopNode[],
  viewer: OneCViewer,
  confirmedEmployeeGuid: string | null,
  org: WholesaleOrgReadResult,
  ropContextGuid?: string | null,
): OneCRopNode[] {
  const scope = buildWholesaleViewerScope(org, viewer, confirmedEmployeeGuid, ropContextGuid);
  if (scope.unrestricted && !scope.ropContextGuid) return items;

  if (!scope.unrestricted && (scope.clientGuids?.size ?? 0) === 0) return [];

  return items
    .map((n) => filterNodeForScope(n, org, scope))
    .filter(Boolean) as OneCRopNode[];
}

export function canViewWholesaleEmployeePage(
  viewer: OneCViewer,
  targetEmployeeGuid: string,
  pageKind: "rop" | "rm" | "manager",
  org: WholesaleOrgReadResult,
  confirmedEmployeeGuid: string | null,
  ropContextGuid?: string | null,
): boolean {
  const scope = buildWholesaleViewerScope(org, viewer, confirmedEmployeeGuid, ropContextGuid);
  if (scope.unrestricted && !scope.ropContextGuid) return true;
  if (!scope.unrestricted && (scope.clientGuids?.size ?? 0) === 0) return false;

  if (pageKind === "rop") {
    return org.clients.some(
      (c) =>
        (c.headOfSalesGuid ?? NO_ROP_GUID) === targetEmployeeGuid && clientInViewerScope(c, scope),
    );
  }
  if (pageKind === "rm") {
    return org.clients.some(
      (c) => c.regionalManagerGuid === targetEmployeeGuid && clientInViewerScope(c, scope),
    );
  }
  if (pageKind === "manager") {
    return org.clients.some(
      (c) => c.responsibleManagerGuid === targetEmployeeGuid && clientInViewerScope(c, scope),
    );
  }
  return false;
}

export function wholesaleEntityRef(employeeGuid: string): WholesaleEntityRef {
  return { entityId: employeeGuid, idKind: "employee_1c" };
}

export { buildWholesaleViewerScope, type WholesaleViewerScope };
