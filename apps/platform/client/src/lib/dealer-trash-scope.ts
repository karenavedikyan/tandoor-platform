/**
 * Скоуп корзины и архива — RBAC по ролям (Промт 336, 396, 398).
 */

import type { UserRole } from "@shared/auth";
import {
  archiveMetaFromRecord,
  buildArchiveScopeFilterRbac,
  buildTrashScopeFilterRbac,
  EMPTY_TEAM_CONTEXT,
  trashMetaFromRecord,
  type TeamContext,
  type TrashArchiveScopeFilter,
} from "@shared/trash-archive-rbac";
import type {
  ArchivedDealerInfo,
  TrashedDealerInfo,
  TrashedTradePointInfo,
} from "./client-base-actualization-state.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import type { SidebarNavRealScope } from "./sidebar-nav-real-scope.js";
import type { AssignmentsScope } from "./dealer-base-real-scope.js";
import type { OrgSnapshot } from "./use-org-snapshot.js";

export type TrashMeta = import("@shared/trash-archive-rbac").TrashMeta;
export type ArchiveMeta = import("@shared/trash-archive-rbac").ArchiveMeta;
export type { TeamContext };

export type TrashScopeFilter = TrashArchiveScopeFilter;

const FULL_VIEW_FILTER: TrashScopeFilter = {
  isDealerInScope: () => true,
  isTradePointInScope: () => true,
  fullView: true,
};

const EMPTY_FILTER: TrashScopeFilter = {
  isDealerInScope: () => false,
  isTradePointInScope: () => false,
  fullView: false,
};

function isRealScopeReadyForTrash(realScope: SidebarNavRealScope | undefined): boolean {
  return Boolean(realScope?.ready && realScope.orgScope);
}

function isFullViewRole(role: UserRole | null): boolean {
  return role === "admin" || role === "director";
}

export function teamContextFromOrgSnapshot(
  snap: OrgSnapshot | undefined,
  assignmentsScope?: AssignmentsScope,
): TeamContext {
  if (!snap) return EMPTY_TEAM_CONTEXT;
  const teamId = snap.me.teamId;
  const memberIds = new Set<string>([snap.me.id]);
  for (const u of snap.users) {
    if (teamId && u.teamId === teamId) memberIds.add(u.id);
  }
  const teamCodes = new Set<string>();
  if (assignmentsScope) {
    for (const c of assignmentsScope.teamCodes) teamCodes.add(c);
    for (const c of assignmentsScope.ownCodes) teamCodes.add(c);
    if (assignmentsScope.grantedCodes) {
      for (const c of assignmentsScope.grantedCodes) teamCodes.add(c);
    }
  }
  return {
    teamId,
    teamMemberIds: [...memberIds],
    teamCodes: [...teamCodes],
  };
}

function resolveTeamContext(
  realScope: SidebarNavRealScope | undefined,
  teamContext?: TeamContext,
): TeamContext {
  if (teamContext) return teamContext;
  return teamContextFromOrgSnapshot(realScope?.orgScope?.snap, realScope?.assignmentsScope);
}

export function buildTrashScopeFilter(opts: {
  role: UserRole | null;
  profile: ReleaseDemoProfile;
  realScope: SidebarNavRealScope | undefined;
  userId?: string | null;
  teamContext?: TeamContext;
}): TrashScopeFilter {
  const { role, profile, realScope, userId, teamContext } = opts;

  if (isFullViewRole(role)) {
    return FULL_VIEW_FILTER;
  }
  if (!isRealScopeReadyForTrash(realScope)) {
    return EMPTY_FILTER;
  }

  const uid = userId ?? realScope?.orgScope?.snap.me.id ?? null;
  return buildTrashScopeFilterRbac({
    role,
    userId: uid,
    userSlug: profile.personaUserId.trim() || null,
    teamContext: resolveTeamContext(realScope, teamContext),
  });
}

export function buildArchiveScopeFilter(opts: {
  role: UserRole | null;
  profile: ReleaseDemoProfile;
  realScope: SidebarNavRealScope | undefined;
  teamContext?: TeamContext;
}): TrashScopeFilter {
  const { role, realScope, teamContext } = opts;

  if (isFullViewRole(role)) {
    return FULL_VIEW_FILTER;
  }
  if (!isRealScopeReadyForTrash(realScope)) {
    return EMPTY_FILTER;
  }

  const assignments = realScope?.assignmentsScope;
  return buildArchiveScopeFilterRbac({
    role,
    assignmentsScope: assignments
      ? {
          ownCodes: assignments.ownCodes,
          teamCodes: assignments.teamCodes,
          grantedCodes: assignments.grantedCodes,
        }
      : undefined,
    teamContext: resolveTeamContext(realScope, teamContext),
  });
}

export function trashMetaFromDealerInfo(info: TrashedDealerInfo): TrashMeta {
  return trashMetaFromRecord(info);
}

export function trashMetaFromTradePointInfo(info: TrashedTradePointInfo): TrashMeta {
  return trashMetaFromRecord(info);
}

export function archiveMetaFromDealerInfo(info: ArchivedDealerInfo): ArchiveMeta {
  return archiveMetaFromRecord(info);
}

export function archiveMetaFromTradePointInfo(info: {
  archivedBy?: string;
  ownerTeamAtArchive?: string | null;
  ownerCode?: string | null;
  dealerId?: string;
}): ArchiveMeta {
  return archiveMetaFromRecord({
    archivedBy: info.archivedBy,
    ownerTeamAtArchive: info.ownerTeamAtArchive,
    ownerCode: info.ownerCode ?? info.dealerId?.replace(/^client-/i, "").toUpperCase() ?? null,
  });
}

export function countScopedTrashItems(
  dealers: Record<string, TrashedDealerInfo>,
  tps: Record<string, TrashedTradePointInfo>,
  filter: TrashScopeFilter,
): number {
  if (filter.fullView) {
    return Object.keys(dealers).length + Object.keys(tps).length;
  }
  let n = 0;
  for (const id of Object.keys(dealers)) {
    const info = dealers[id];
    if (info && filter.isDealerInScope(id, trashMetaFromDealerInfo(info))) n++;
  }
  for (const tpId of Object.keys(tps)) {
    const info = tps[tpId];
    if (!info) continue;
    const dealerId = info.dealerId ?? null;
    if (filter.isTradePointInScope(tpId, dealerId, trashMetaFromTradePointInfo(info))) n++;
  }
  return n;
}
