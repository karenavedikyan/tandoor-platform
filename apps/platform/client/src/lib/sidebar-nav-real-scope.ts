/**
 * Real-режим для сайдбарных счётчиков: тот же релиз-сид + org scope, что на /dealer-base и /trade-points.
 */

import type { UserRole } from "@shared/auth";
import type { OrgScopePayload, TeamScopePayload } from "@shared/dealers-scope-types";
import type { DealerRow } from "./dealer-base-mock-data.js";
import { getCatalogDealerRows, getVisibleDealerRows } from "./dealer-base-source.js";
import { mapUserRoleToDealerBaseAccess } from "./auth-user-dealer-access.js";
import type { DealerBaseAccessRole } from "./dealer-base-role-views.js";
import { assignmentsScopeIsActive, type AssignmentsScope } from "./dealer-base-real-scope.js";
import type { OrgSnapshot } from "./use-org-snapshot.js";
import type { MyVisibleCodesResult } from "./use-my-visible-client-codes.js";

export type SidebarNavRealScope = {
  isRealUser: boolean;
  loading: boolean;
  ready: boolean;
  releaseDealerRows?: DealerRow[];
  orgScope?: { snap: OrgSnapshot; access: DealerBaseAccessRole };
  assignmentsScope?: AssignmentsScope;
  /** Промт 410: releaseDealerRows уже отфильтрованы по my-scope; не применять roleScopedDealerRowsForReal. */
  dbScopeDirect?: boolean;
  /** Платформенная роль — для выбора team/org DB scope (director, rop). */
  platformRole?: UserRole;
  teamScope?: TeamScopePayload | null;
  orgScopeData?: OrgScopePayload | null;
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
  /** Промт 384: фильтр каталога по external_key из /api/dealers/my-scope. */
  dbScopedExternalKeys?: Set<string>;
  /** Промт 441-fix5: scope_explanation.full_catalog — у admin/sales_director весь каталог. */
  dbFullCatalog?: boolean;
  teamScope?: TeamScopePayload | null;
  orgScopeData?: OrgScopePayload | null;
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

  let releaseDealerRows: DealerRow[];
  // Промт 441-fix5: единый источник истины.
  //  - full_catalog (admin/sales_director): ВСЕГДА весь каталог, фильтрация по external_keys запрещена.
  //  - иначе: фильтр по external_keys из БД (если переданы), fallback на visible-codes.
  const dbFullCatalog = Boolean(input.dbFullCatalog ?? visPayload!.all);
  const dbScopeDirect = !dbFullCatalog && Boolean(input.dbScopedExternalKeys);
  if (dbFullCatalog) {
    releaseDealerRows = getVisibleDealerRows(catalog, true, null);
  } else if (input.dbScopedExternalKeys) {
    releaseDealerRows = catalog.filter((r) => input.dbScopedExternalKeys!.has(r.id));
  } else {
    releaseDealerRows = getVisibleDealerRows(catalog, visPayload!.all, visPayload!.codes);
  }
  const access = role ? mapUserRoleToDealerBaseAccess(role) : ("sales_manager" as DealerBaseAccessRole);

  return {
    isRealUser: true,
    loading: false,
    ready: true,
    releaseDealerRows,
    orgScope: { snap: snap!, access },
    assignmentsScope: assignmentsScopeIsActive(assignmentsScope) ? assignmentsScope : undefined,
    dbScopeDirect,
    platformRole: role ?? undefined,
    teamScope: input.teamScope ?? null,
    orgScopeData: input.orgScopeData ?? null,
  };
}
