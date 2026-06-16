/**
 * Real-режим для сайдбарных счётчиков: тот же релиз-сид + org scope, что на /dealer-base и /trade-points.
 */

import type { UserRole } from "@shared/auth";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getCatalogDealerRows, getVisibleDealerRows } from "@/lib/dealer-base-source";
import { mapUserRoleToDealerBaseAccess } from "@/lib/auth-user-dealer-access";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import { assignmentsScopeIsActive, type AssignmentsScope } from "@/lib/dealer-base-real-scope";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import type { MyVisibleCodesResult } from "@/lib/use-my-visible-client-codes";

export type SidebarNavRealScope = {
  isRealUser: boolean;
  loading: boolean;
  ready: boolean;
  releaseDealerRows?: DealerRow[];
  orgScope?: { snap: OrgSnapshot; access: DealerBaseAccessRole };
  assignmentsScope?: AssignmentsScope;
};

export type BuildSidebarNavRealScopeInput = {
  isRealUser: boolean;
  authLoading: boolean;
  authError: boolean;
  role: UserRole | null | undefined;
  snap: OrgSnapshot | null | undefined;
  visPayload: MyVisibleCodesResult | null | undefined;
  orgSnapError: boolean;
  visCodesError: boolean;
  orgSnapLoading: boolean;
  visCodesLoading: boolean;
  assignmentsScope: AssignmentsScope | undefined;
  /** Каталог из API или seed (Промт 376). */
  catalogRows?: DealerRow[];
};

export function buildSidebarNavRealScope(input: BuildSidebarNavRealScopeInput): SidebarNavRealScope {
  const {
    isRealUser,
    authLoading,
    authError,
    role,
    snap,
    visPayload,
    orgSnapError,
    visCodesError,
    orgSnapLoading,
    visCodesLoading,
    assignmentsScope,
  } = input;

  const catalog = input.catalogRows?.length ? input.catalogRows : getCatalogDealerRows();

  if (!isRealUser) {
    return { isRealUser: false, loading: false, ready: false };
  }

  const loading = authLoading || orgSnapLoading || visCodesLoading;
  const ready = Boolean(
    !authLoading &&
      !authError &&
      snap &&
      visPayload &&
      !orgSnapError &&
      !visCodesError,
  );

  if (!ready) {
    return { isRealUser: true, loading, ready: false };
  }

  const releaseDealerRows = getVisibleDealerRows(catalog, visPayload!.all, visPayload!.codes);
  const access = role ? mapUserRoleToDealerBaseAccess(role) : ("sales_manager" as DealerBaseAccessRole);

  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows,
    orgScope: { snap: snap!, access },
    assignmentsScope: assignmentsScopeIsActive(assignmentsScope) ? assignmentsScope : undefined,
  };
}
