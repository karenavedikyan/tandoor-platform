/**
 * Wholesale /1c/* detail pages by employeeGuid (not LK users/teams).
 */

import type { PoolLike } from "./responsibility-resolver.js";
import type { OneCTeamMemberRow, OneCUserCard } from "./one-c-showroom-handlers.js";
import { readWholesaleOrg } from "./wholesale-org-read.js";
import type { WholesaleClientAssignment, WholesaleOrgReadResult } from "./wholesale-org-types.js";
import { buildAssignmentListItems } from "./wholesale-list-items.js";
import {
  buildWholesaleViewerScope,
  filterClientsForViewerScope,
  openStoreGuidsForClients,
  type WholesaleViewerScope,
} from "./wholesale-viewer-scope.js";
import {
  canViewWholesaleEmployeePage,
  resolveConfirmedEmployeeGuid,
} from "./wholesale-showroom-scope.js";
import type { OneCViewer } from "./one-c-showroom-scope.js";
import {
  filterClientsForReadContext,
  type OneCReadContext,
} from "./one-c-read-context.js";

const NO_ROP_GUID = "__no_rop__";

function parseRopContext(raw: string | null | undefined): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  return t || null;
}

function employeeCard(
  org: WholesaleOrgReadResult,
  employeeGuid: string,
  kind: "rop" | "rm" | "manager",
  scopedClients: WholesaleClientAssignment[],
): OneCUserCard | null {
  const emp = org.employees.find((e) => e.employeeGuid === employeeGuid);
  if (!emp && employeeGuid !== NO_ROP_GUID) return null;

  const storeCount = new Set(scopedClients.flatMap((c) => c.storeGuids)).size;
  const legalCount = scopedClients.length;

  let ropName: string | null = null;
  let rmNames: string[] = [];
  if (kind === "rm" || kind === "manager") {
    const ropGuids = new Set(
      scopedClients.map((c) => c.headOfSalesGuid).filter(Boolean) as string[],
    );
    if (ropGuids.size === 1) {
      const ropGuid = Array.from(ropGuids)[0]!;
      ropName = org.employees.find((e) => e.employeeGuid === ropGuid)?.fullName ?? null;
    }
  }
  if (kind === "manager") {
    rmNames = uniqueNames(
      scopedClients
        .map((c) => c.regionalManagerName)
        .filter((n): n is string => Boolean(n?.trim())),
    );
  }

  const ropNode = org.hierarchy.find((h) => h.employeeGuid === employeeGuid);

  return {
    userId: employeeGuid,
    idKind: "employee_1c" as const,
    fullName: emp?.fullName ?? ropNode?.fullName ?? employeeGuid,
    phone: null,
    email: null,
    teamName: ropNode?.teamName ?? null,
    ropName,
    rmNames,
    storeCount,
    legalCount,
  };
}

function uniqueNames(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const t = n.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

function memberRow(
  org: WholesaleOrgReadResult,
  employeeGuid: string,
  fullName: string,
  clients: WholesaleClientAssignment[],
): OneCTeamMemberRow {
  return {
    userId: employeeGuid,
    idKind: "employee_1c" as const,
    fullName,
    phone: null,
    storeCount: new Set(clients.flatMap((c) => c.storeGuids)).size,
    legalCount: clients.length,
  };
}

function clientsForManager(
  org: WholesaleOrgReadResult,
  managerGuid: string,
  scope: WholesaleViewerScope,
  ropKey?: string | null,
): WholesaleClientAssignment[] {
  return filterClientsForViewerScope(
    org.clients,
    scope,
    (c) =>
      c.responsibleManagerGuid === managerGuid &&
      (ropKey == null || (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey),
  );
}

function clientsForRm(
  org: WholesaleOrgReadResult,
  rmGuid: string,
  scope: WholesaleViewerScope,
  ropKey?: string | null,
): WholesaleClientAssignment[] {
  return filterClientsForViewerScope(
    org.clients,
    scope,
    (c) =>
      c.regionalManagerGuid === rmGuid &&
      (ropKey == null || (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey),
  );
}

export async function fetchWholesaleOneCRop(
  pool: PoolLike,
  employeeGuid: string,
  viewer?: OneCViewer,
  ropContextGuid?: string | null,
) {
  const org = await readWholesaleOrg(pool);
  const confirmed =
    viewer && viewer.role !== "admin" && viewer.role !== "director"
      ? await resolveConfirmedEmployeeGuid(pool, viewer.id)
      : null;
  const scope = buildWholesaleViewerScope(org, viewer ?? { id: "", role: "admin" }, confirmed, ropContextGuid);

  if (
    viewer &&
    !canViewWholesaleEmployeePage(viewer, employeeGuid, "rop", org, confirmed, ropContextGuid)
  ) {
    return null;
  }

  const ropNode = org.hierarchy.find((h) => h.employeeGuid === employeeGuid);
  if (!ropNode && employeeGuid !== NO_ROP_GUID) return null;

  const ropKey = employeeGuid;
  const ropClients = filterClientsForViewerScope(
    org.clients,
    scope,
    (c) => (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey,
  );

  const card = employeeCard(org, employeeGuid, "rop", ropClients);
  if (!card) return null;

  const rms: OneCTeamMemberRow[] = (ropNode?.rms ?? [])
    .map((rm) => {
      const rmClients = clientsForRm(org, rm.employeeGuid, scope, ropKey);
      if (rmClients.length === 0) return null;
      return memberRow(org, rm.employeeGuid, rm.fullName, rmClients);
    })
    .filter(Boolean) as OneCTeamMemberRow[];

  const managers: OneCTeamMemberRow[] = (ropNode?.managers ?? [])
    .map((mgr) => {
      const mgrClients = clientsForManager(org, mgr.employeeGuid, scope, ropKey);
      if (mgrClients.length === 0) return null;
      return memberRow(org, mgr.employeeGuid, mgr.fullName, mgrClients);
    })
    .filter(Boolean) as OneCTeamMemberRow[];

  return { user: card, rms, managers, idKind: "employee_1c" as const, ropContextGuid: ropKey };
}

export async function fetchWholesaleOneCRm(
  pool: PoolLike,
  employeeGuid: string,
  q: string,
  limit: number,
  offset: number,
  viewer?: OneCViewer,
  ropContextGuid?: string | null,
) {
  const org = await readWholesaleOrg(pool);
  const confirmed =
    viewer && viewer.role !== "admin" && viewer.role !== "director"
      ? await resolveConfirmedEmployeeGuid(pool, viewer.id)
      : null;
  const scope = buildWholesaleViewerScope(org, viewer ?? { id: "", role: "admin" }, confirmed, ropContextGuid);

  if (
    viewer &&
    !canViewWholesaleEmployeePage(viewer, employeeGuid, "rm", org, confirmed, ropContextGuid)
  ) {
    return null;
  }

  const rmClientsAll = clientsForRm(org, employeeGuid, scope, parseRopContext(ropContextGuid));
  const emp = org.employees.find((e) => e.employeeGuid === employeeGuid);
  if (!emp && rmClientsAll.length === 0) return null;

  const card = employeeCard(org, employeeGuid, "rm", rmClientsAll);
  if (!card) return null;

  const ropGuids = new Set(rmClientsAll.map((c) => c.headOfSalesGuid ?? NO_ROP_GUID));
  const teamName =
    ropGuids.size === 1
      ? (org.hierarchy.find((h) => h.employeeGuid === Array.from(ropGuids)[0])?.teamName ?? null)
      : null;

  const mgrGuids = new Set(
    rmClientsAll.map((c) => c.responsibleManagerGuid).filter(Boolean) as string[],
  );
  const managers: OneCTeamMemberRow[] = Array.from(mgrGuids)
    .map((guid) => {
      const mgrClients = rmClientsAll.filter((c) => c.responsibleManagerGuid === guid);
      const e = org.employees.find((x) => x.employeeGuid === guid);
      const name = e?.fullName ?? mgrClients[0]?.responsibleManagerName ?? guid;
      return memberRow(org, guid, name, mgrClients);
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));

  const pattern = q.trim().toLowerCase();
  const rmClients = rmClientsAll.filter((c) => {
    if (!pattern) return true;
    return (
      c.name.toLowerCase().includes(pattern) ||
      c.externalKey.toLowerCase().includes(pattern)
    );
  });
  const total = rmClients.length;
  const slice = rmClients.slice(offset, offset + limit);

  return {
    user: card,
    teamName,
    ropName: card.ropName,
    managers,
    total,
    items: buildAssignmentListItems(slice, org),
    listEntityKind: "mixed" as const,
    idKind: "employee_1c" as const,
    ropContextGuid: parseRopContext(ropContextGuid),
  };
}

export async function fetchWholesaleOneCManager(
  pool: PoolLike,
  employeeGuid: string,
  q: string,
  limit: number,
  offset: number,
  viewer?: OneCViewer,
  ropContextGuid?: string | null,
  readContext?: OneCReadContext,
) {
  const org = await readWholesaleOrg(pool);
  const confirmed =
    viewer && viewer.role !== "admin" && viewer.role !== "director"
      ? await resolveConfirmedEmployeeGuid(pool, viewer.id)
      : null;
  const scope = buildWholesaleViewerScope(org, viewer ?? { id: "", role: "admin" }, confirmed, ropContextGuid);

  if (
    viewer &&
    !canViewWholesaleEmployeePage(viewer, employeeGuid, "manager", org, confirmed, ropContextGuid)
  ) {
    return null;
  }

  let mgrClientsAll = clientsForManager(org, employeeGuid, scope, parseRopContext(ropContextGuid));
  if (readContext) {
    mgrClientsAll = filterClientsForReadContext(mgrClientsAll, readContext);
  }
  const emp = org.employees.find((e) => e.employeeGuid === employeeGuid);
  if (!emp && mgrClientsAll.length === 0) return null;

  const card = employeeCard(org, employeeGuid, "manager", mgrClientsAll);
  if (!card) return null;

  const allowedStores = readContext?.previewRestricts ? readContext.allowedStoreGuids : null;
  const pattern = q.trim().toLowerCase();
  let allItems = buildAssignmentListItems(mgrClientsAll, org, allowedStores);
  if (pattern) {
    allItems = allItems.filter(
      (item) =>
        (item.legal_name ?? "").toLowerCase().includes(pattern) ||
        (item.address ?? "").toLowerCase().includes(pattern) ||
        item.id_1c.toLowerCase().includes(pattern),
    );
  }
  const total = allItems.length;
  const items = allItems.slice(offset, offset + limit);

  return {
    user: card,
    total,
    items,
    listEntityKind: "mixed" as const,
    idKind: "employee_1c" as const,
    ropContextGuid: parseRopContext(ropContextGuid),
  };
}
