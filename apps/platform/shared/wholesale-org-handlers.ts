/**
 * HTTP handlers for wholesale org read APIs.
 */

import type { PoolLike } from "./responsibility-resolver.js";
import type { UserRole } from "./auth.js";
import {
  buildWholesaleHierarchy,
  hasLkTeams,
  hasWholesaleOrgData,
  readWholesaleOrg,
  resolveWholesaleEmployeePreviewScope,
  wholesaleHierarchyToOneCRopNodes,
} from "./wholesale-org-read.js";
import type { WholesaleAssignmentType } from "./wholesale-org-types.js";

const ADMIN_ROLES = new Set<UserRole>(["admin", "director"]);

export function canAccessWholesaleOrgRead(role: UserRole): boolean {
  return ADMIN_ROLES.has(role);
}

export async function fetchWholesaleOrgOverview(pool: PoolLike) {
  const org = await readWholesaleOrg(pool);
  return {
    success: true as const,
    source: org.source,
    rosterAvailable: org.rosterAvailable,
    rosterError: org.rosterError,
    importedAt: org.importedAt,
    totals: org.totals,
    employeeCount: org.employees.length,
    needsReviewCount: org.needsReviewClients.length,
  };
}

export async function fetchWholesaleOrgHierarchy(pool: PoolLike, searchQ = "") {
  const org = await readWholesaleOrg(pool);
  const items = wholesaleHierarchyToOneCRopNodes(buildWholesaleHierarchy(org.clients, org.employees, searchQ));
  return {
    success: true as const,
    source: "wholesale_metadata" as const,
    items,
    rosterAvailable: org.rosterAvailable,
    rosterError: org.rosterError,
  };
}

export async function fetchWholesaleEmployees(pool: PoolLike) {
  const org = await readWholesaleOrg(pool);
  return {
    success: true as const,
    employees: org.employees.map((e) => ({
      employeeGuid: e.employeeGuid,
      fullName: e.fullName,
      position: e.position,
      inRoster: e.inRoster,
      accountLinkState: e.accountLinkState,
      accountUserId: e.accountUserId,
      clientCount: org.clients.filter(
        (c) =>
          c.responsibleManagerGuid === e.employeeGuid ||
          c.regionalManagerGuid === e.employeeGuid ||
          c.headOfSalesGuid === e.employeeGuid ||
          c.hardwareManagerGuid === e.employeeGuid,
      ).length,
      assignmentTypes: assignmentTypesForEmployee(org, e.employeeGuid),
    })),
    rosterAvailable: org.rosterAvailable,
    rosterError: org.rosterError,
  };
}

function assignmentTypesForEmployee(
  org: Awaited<ReturnType<typeof readWholesaleOrg>>,
  guid: string,
): WholesaleAssignmentType[] {
  const types = new Set<WholesaleAssignmentType>();
  for (const c of org.clients) {
    if (c.headOfSalesGuid === guid) types.add("head_of_sales");
    if (c.responsibleManagerGuid === guid) types.add("responsible_manager");
    if (c.regionalManagerGuid === guid) types.add("regional_manager");
    if (c.hardwareManagerGuid === guid) types.add("hardware_manager");
  }
  return Array.from(types);
}

export async function fetchWholesaleNeedsReview(pool: PoolLike, limit = 100, offset = 0) {
  const org = await readWholesaleOrg(pool);
  const slice = org.needsReviewClients.slice(offset, offset + limit);
  return {
    success: true as const,
    total: org.needsReviewClients.length,
    items: slice.map((c) => ({
      guidClient: c.guidClient,
      externalKey: c.externalKey,
      name: c.name,
      reviewFlags: c.reviewFlags,
      headOfSalesName: c.headOfSalesName,
      responsibleManagerName: c.responsibleManagerName,
      holdingLinkState: c.holdingLinkState,
      pendingHoldingGuid: c.pendingHoldingGuid,
    })),
  };
}

export async function resolveWholesalePreviewScope(
  pool: PoolLike,
  employeeGuid: string,
  assignmentType: WholesaleAssignmentType,
) {
  const org = await readWholesaleOrg(pool);
  return resolveWholesaleEmployeePreviewScope(org, employeeGuid, assignmentType);
}

/** Prefer wholesale metadata whenever imported — do not hide it after first LK team appears. */
export async function shouldUseWholesaleOrgHierarchy(pool: PoolLike): Promise<boolean> {
  return hasWholesaleOrgData(pool);
}
