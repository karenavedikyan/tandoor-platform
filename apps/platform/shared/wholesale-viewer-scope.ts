/**
 * Resolved read scope for wholesale viewer (ROP/RM/manager/admin+context).
 */

import type { OneCViewer } from "./one-c-showroom-scope.js";
import type { WholesaleClientAssignment, WholesaleOrgReadResult } from "./wholesale-org-types.js";
import { wholesaleHierarchyUnrestricted } from "./wholesale-showroom-scope.js";

const NO_ROP_GUID = "__no_rop__";

export type WholesaleViewerScope = {
  unrestricted: boolean;
  /** null = all clients; empty set = none */
  clientGuids: Set<string> | null;
  ropContextGuid: string | null;
};

export function buildWholesaleViewerScope(
  org: WholesaleOrgReadResult,
  viewer: OneCViewer,
  confirmedEmployeeGuid: string | null,
  ropContextGuid?: string | null,
): WholesaleViewerScope {
  const ropCtx = normRopContext(ropContextGuid);

  if (wholesaleHierarchyUnrestricted(viewer)) {
    if (ropCtx) {
      return {
        unrestricted: false,
        clientGuids: clientGuidsForRopBranch(org, ropCtx),
        ropContextGuid: ropCtx,
      };
    }
    return { unrestricted: true, clientGuids: null, ropContextGuid: null };
  }

  if (!confirmedEmployeeGuid) {
    return { unrestricted: false, clientGuids: new Set(), ropContextGuid: ropCtx };
  }

  const guids = new Set<string>();
  if (viewer.role === "rop") {
    for (const c of org.clients) {
      if ((c.headOfSalesGuid ?? NO_ROP_GUID) === confirmedEmployeeGuid) {
        guids.add(c.guidClient);
      }
    }
  } else if (viewer.role === "regional_manager" || viewer.role === "rm") {
    for (const c of org.clients) {
      if (c.regionalManagerGuid === confirmedEmployeeGuid) guids.add(c.guidClient);
    }
  } else if (viewer.role === "manager") {
    for (const c of org.clients) {
      if (c.responsibleManagerGuid === confirmedEmployeeGuid) guids.add(c.guidClient);
    }
  }

  if (ropCtx) {
    const intersected = new Set<string>();
    for (const guid of Array.from(guids)) {
      const c = org.clients.find((x) => x.guidClient === guid);
      if (c && (c.headOfSalesGuid ?? NO_ROP_GUID) === ropCtx) intersected.add(guid);
    }
    return { unrestricted: false, clientGuids: intersected, ropContextGuid: ropCtx };
  }

  return { unrestricted: false, clientGuids: guids, ropContextGuid: null };
}

function normRopContext(raw: string | null | undefined): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t || t === NO_ROP_GUID) return null;
  return t;
}

function clientGuidsForRopBranch(org: WholesaleOrgReadResult, ropGuid: string): Set<string> {
  const guids = new Set<string>();
  for (const c of org.clients) {
    if ((c.headOfSalesGuid ?? NO_ROP_GUID) === ropGuid) guids.add(c.guidClient);
  }
  return guids;
}

export function clientInViewerScope(
  client: WholesaleClientAssignment,
  scope: WholesaleViewerScope,
): boolean {
  if (scope.unrestricted && !scope.ropContextGuid) return true;
  const allowed = scope.clientGuids ?? new Set<string>();
  return allowed.has(client.guidClient);
}

export function filterClientsForViewerScope(
  clients: WholesaleClientAssignment[],
  scope: WholesaleViewerScope,
  extra?: (c: WholesaleClientAssignment) => boolean,
): WholesaleClientAssignment[] {
  return clients.filter((c) => clientInViewerScope(c, scope) && (extra ? extra(c) : true));
}

export function openStoreGuidsForClients(
  clients: WholesaleClientAssignment[],
  allowedStoreGuids?: Set<string> | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of clients) {
    for (const s of c.openStoreGuids) {
      if (allowedStoreGuids && !allowedStoreGuids.has(s)) continue;
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}
