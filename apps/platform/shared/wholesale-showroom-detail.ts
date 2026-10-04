/**
 * Wholesale /1c/* detail pages by employeeGuid (not LK users/teams).
 */

import type { PoolLike } from "./responsibility-resolver.js";
import type { OneCTeamMemberRow, OneCUserCard } from "./one-c-showroom-handlers.js";
import { readWholesaleOrg } from "./wholesale-org-read.js";
import type { WholesaleOrgReadResult } from "./wholesale-org-types.js";
import {
  canViewWholesaleEmployeePage,
  resolveConfirmedEmployeeGuid,
} from "./wholesale-showroom-scope.js";
import type { OneCViewer } from "./one-c-showroom-scope.js";

const NO_ROP_GUID = "__no_rop__";

function employeeCard(
  org: WholesaleOrgReadResult,
  employeeGuid: string,
  kind: "rop" | "rm" | "manager",
): OneCUserCard | null {
  const emp = org.employees.find((e) => e.employeeGuid === employeeGuid);
  if (!emp && employeeGuid !== NO_ROP_GUID) return null;

  let storeCount = 0;
  let legalCount = 0;
  let ropName: string | null = null;
  let rmNames: string[] = [];

  if (kind === "rop") {
    const ropClients = org.clients.filter(
      (c) => (c.headOfSalesGuid ?? NO_ROP_GUID) === employeeGuid,
    );
    legalCount = ropClients.length;
    storeCount = new Set(ropClients.flatMap((c) => c.storeGuids)).size;
  } else if (kind === "rm") {
    const rmClients = org.clients.filter((c) => c.regionalManagerGuid === employeeGuid);
    legalCount = rmClients.length;
    storeCount = new Set(rmClients.flatMap((c) => c.storeGuids)).size;
    const ropGuids = new Set(
      rmClients.map((c) => c.headOfSalesGuid).filter(Boolean) as string[],
    );
    ropName =
      ropGuids.size === 1
        ? (org.employees.find((e) => e.employeeGuid === Array.from(ropGuids)[0])?.fullName ?? null)
        : null;
  } else {
    const mgrClients = org.clients.filter((c) => c.responsibleManagerGuid === employeeGuid);
    legalCount = mgrClients.length;
    storeCount = new Set(mgrClients.flatMap((c) => c.storeGuids)).size;
    const ropGuids = new Set(
      mgrClients.map((c) => c.headOfSalesGuid).filter(Boolean) as string[],
    );
    if (ropGuids.size === 1) {
      ropName =
        org.employees.find((e) => e.employeeGuid === Array.from(ropGuids)[0])?.fullName ?? null;
    }
    rmNames = uniqueNames(
      mgrClients
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
  filter: (c: WholesaleOrgReadResult["clients"][0]) => boolean,
): OneCTeamMemberRow {
  const matched = org.clients.filter(filter);
  return {
    userId: employeeGuid,
    idKind: "employee_1c" as const,
    fullName,
    phone: null,
    storeCount: new Set(matched.flatMap((c) => c.storeGuids)).size,
    legalCount: matched.length,
  };
}

export async function fetchWholesaleOneCRop(
  pool: PoolLike,
  employeeGuid: string,
  viewer?: OneCViewer,
) {
  const org = await readWholesaleOrg(pool);
  const confirmed =
    viewer && viewer.role !== "admin" && viewer.role !== "director"
      ? await resolveConfirmedEmployeeGuid(pool, viewer.id)
      : null;

  if (
    viewer &&
    !canViewWholesaleEmployeePage(viewer, employeeGuid, "rop", org, confirmed)
  ) {
    return null;
  }

  const ropNode = org.hierarchy.find((h) => h.employeeGuid === employeeGuid);
  if (!ropNode && employeeGuid !== NO_ROP_GUID) return null;

  const card = employeeCard(org, employeeGuid, "rop");
  if (!card) return null;

  const ropKey = employeeGuid;
  const rms: OneCTeamMemberRow[] = (ropNode?.rms ?? []).map((rm) =>
    memberRow(
      org,
      rm.employeeGuid,
      rm.fullName,
      (c) =>
        (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey &&
        c.regionalManagerGuid === rm.employeeGuid,
    ),
  );

  const managers: OneCTeamMemberRow[] = (ropNode?.managers ?? []).map((mgr) =>
    memberRow(
      org,
      mgr.employeeGuid,
      mgr.fullName,
      (c) =>
        (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey &&
        c.responsibleManagerGuid === mgr.employeeGuid,
    ),
  );

  return { user: card, rms, managers, idKind: "employee_1c" as const };
}

export async function fetchWholesaleOneCRm(
  pool: PoolLike,
  employeeGuid: string,
  q: string,
  limit: number,
  offset: number,
  viewer?: OneCViewer,
) {
  const org = await readWholesaleOrg(pool);
  const confirmed =
    viewer && viewer.role !== "admin" && viewer.role !== "director"
      ? await resolveConfirmedEmployeeGuid(pool, viewer.id)
      : null;

  if (
    viewer &&
    !canViewWholesaleEmployeePage(viewer, employeeGuid, "rm", org, confirmed)
  ) {
    return null;
  }

  const emp = org.employees.find((e) => e.employeeGuid === employeeGuid);
  const hasAssignment = org.clients.some((c) => c.regionalManagerGuid === employeeGuid);
  if (!emp && !hasAssignment) return null;

  const card = employeeCard(org, employeeGuid, "rm");
  if (!card) return null;

  const ropGuids = new Set(
    org.clients
      .filter((c) => c.regionalManagerGuid === employeeGuid)
      .map((c) => c.headOfSalesGuid ?? NO_ROP_GUID),
  );
  const teamName =
    ropGuids.size === 1
      ? (org.hierarchy.find((h) => h.employeeGuid === Array.from(ropGuids)[0])?.teamName ?? null)
      : null;

  const mgrGuids = new Set<string>();
  for (const c of org.clients) {
    if (c.regionalManagerGuid === employeeGuid && c.responsibleManagerGuid) {
      mgrGuids.add(c.responsibleManagerGuid);
    }
  }

  const managers: OneCTeamMemberRow[] = Array.from(mgrGuids)
    .map((guid) => {
      const e = org.employees.find((x) => x.employeeGuid === guid);
      const name =
        e?.fullName ??
        org.clients.find((c) => c.responsibleManagerGuid === guid)?.responsibleManagerName ??
        guid;
      return memberRow(org, guid, name, (c) => c.responsibleManagerGuid === guid);
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));

  const pattern = q.trim().toLowerCase();
  const rmClients = org.clients.filter((c) => {
    if (c.regionalManagerGuid !== employeeGuid) return false;
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
    items: slice.map((c) => ({
      id_1c: c.guidClient,
      address: c.city,
      legal_name: c.name,
      legal_inn: null,
      storeCount: c.storeGuids.length,
    })),
    idKind: "employee_1c" as const,
  };
}

export async function fetchWholesaleOneCManager(
  pool: PoolLike,
  employeeGuid: string,
  q: string,
  limit: number,
  offset: number,
  viewer?: OneCViewer,
) {
  const org = await readWholesaleOrg(pool);
  const confirmed =
    viewer && viewer.role !== "admin" && viewer.role !== "director"
      ? await resolveConfirmedEmployeeGuid(pool, viewer.id)
      : null;

  if (
    viewer &&
    !canViewWholesaleEmployeePage(viewer, employeeGuid, "manager", org, confirmed)
  ) {
    return null;
  }

  const emp = org.employees.find((e) => e.employeeGuid === employeeGuid);
  const hasAssignment = org.clients.some((c) => c.responsibleManagerGuid === employeeGuid);
  if (!emp && !hasAssignment) return null;

  const card = employeeCard(org, employeeGuid, "manager");
  if (!card) return null;

  const pattern = q.trim().toLowerCase();
  const mgrClients = org.clients.filter((c) => {
    if (c.responsibleManagerGuid !== employeeGuid) return false;
    if (!pattern) return true;
    return (
      c.name.toLowerCase().includes(pattern) ||
      c.externalKey.toLowerCase().includes(pattern)
    );
  });
  const total = mgrClients.length;
  const slice = mgrClients.slice(offset, offset + limit);

  return {
    user: card,
    total,
    items: slice.map((c) => ({
      id_1c: c.guidClient,
      address: c.city,
      legal_name: c.name,
      legal_inn: null,
      storeCount: c.storeGuids.length,
    })),
    idKind: "employee_1c" as const,
  };
}
