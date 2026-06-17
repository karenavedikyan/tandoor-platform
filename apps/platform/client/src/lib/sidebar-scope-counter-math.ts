/**
 * Единый расчёт счётчиков сайдбара (Промт 383).
 *
 * @deprecated Промт 384: прод-счётчики из GET /api/dealers/my-scope (`useMyScopeFromDB`).
 * Функции ниже сохранены для unit-тестов legacy pipeline.
 */

import type { UserRole } from "@shared/auth";
import {
  createEmptyActualizationState,
  type ActualizationState,
} from "@/lib/client-base-actualization-state";
import {
  resolveSidebarTrashCount,
  resolveSidebarWorkingDealerClientCount,
  type SidebarDealerClientCountContext,
} from "@/lib/dealer-base-sidebar-client-count";
import { resolveSidebarTradePointsCount } from "@/lib/sidebar-trade-points-count";
import type { AssignmentsScope } from "@/lib/dealer-base-real-scope";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { userRoleToSalesRole } from "@/lib/role-mapping";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { buildSidebarNavRealScope, type SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import type { MyVisibleCodesResult } from "@/lib/use-my-visible-client-codes";

export type SidebarScopeCounterResult = {
  visibleDealerCount: number;
  visibleTradePointCount: number;
  trashedInScopeCount: number;
};

export function profileForScopeCounters(userId: string, role: UserRole): ReleaseDemoProfile {
  return { role: userRoleToSalesRole(role), personaUserId: userId };
}

export function buildRealScopeForSidebarCounters(input: {
  role: UserRole;
  snap: OrgSnapshot;
  visPayload: MyVisibleCodesResult;
  assignmentsScope?: AssignmentsScope;
  catalogRows: DealerRow[];
}): SidebarNavRealScope {
  return buildSidebarNavRealScope({
    isRealUser: true,
    authLoading: false,
    authError: false,
    role: input.role,
    snap: input.snap,
    visPayload: input.visPayload,
    orgSnapError: false,
    visCodesError: false,
    orgSnapLoading: false,
    visCodesLoading: false,
    assignmentsScope: input.assignmentsScope,
    catalogRows: input.catalogRows,
  });
}

export function computeSidebarScopeCountersFromRealScope(
  profile: ReleaseDemoProfile,
  platformRole: UserRole,
  realScope: SidebarNavRealScope,
  actState: ActualizationState = createEmptyActualizationState(),
  actEnabled = true,
): SidebarScopeCounterResult {
  const ctx: SidebarDealerClientCountContext = {
    enabled: actEnabled,
    loading: false,
    state: actState,
    realScope,
    role: platformRole,
  };
  return {
    visibleDealerCount: resolveSidebarWorkingDealerClientCount(profile, ctx) ?? 0,
    visibleTradePointCount: resolveSidebarTradePointsCount(profile, ctx) ?? 0,
    trashedInScopeCount: resolveSidebarTrashCount(profile, ctx) ?? 0,
  };
}

export function visiblePayloadFromCodes(payload: {
  all: boolean;
  codes: string[] | null;
}): MyVisibleCodesResult {
  if (payload.all) return { all: true, codes: null, assignments: null };
  return { all: false, codes: payload.codes ?? [], assignments: [] };
}

export function assignmentsScopeFromCodes(input: {
  ownCodes: string[];
  teamCodes: string[];
  grantedCodes?: string[];
}): AssignmentsScope {
  return {
    ownCodes: new Set(input.ownCodes),
    teamCodes: new Set(input.teamCodes),
    grantedCodes: new Set(input.grantedCodes ?? []),
  };
}
