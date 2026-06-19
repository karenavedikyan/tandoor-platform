import type { AssignmentDto } from "../showcase-assignments-api.js";
import type { DealerRow } from "../dealer-base-mock-data.js";
import { getCatalogDealerRows, getVisibleDealerRows } from "../dealer-base-source.js";
import { buildDealerBaseRowsWithActualization } from "../client-base-actualization-data-merge.js";
import { createEmptyActualizationState } from "../client-base-actualization-state.js";
import { mapUserRoleToDealerBaseAccess } from "../auth-user-dealer-access.js";
import {
  assignmentsScopeIsActive,
  roleScopedDealerRowsForReal,
  type AssignmentsScope,
} from "../dealer-base-real-scope.js";
import { mapSalesRoleToDealerBaseAccess, roleScopedDealerRows } from "../dealer-base-role-views.js";
import { buildTradePointListForActualization } from "../trade-point-list-for-actualization.js";
import {
  buildCatalogProductSearchHaystack,
  catalogSearchQueryMatchesHaystack,
  searchCatalog,
} from "../catalog-data.js";
import type { ReleaseDemoProfile } from "../release-demo-profile.js";
import type { OrgSnapshot } from "../use-org-snapshot.js";
import type { MyVisibleCodesResult } from "../use-my-visible-client-codes.js";
import type { GlobalSearchResult } from "@shared/search-handlers";
import {
  GLOBAL_SEARCH_LIMIT_PER_TYPE,
  multiWordSearchMatches,
  normalizeSearchHaystack,
} from "../search/search-query-utils.js";
import type { ActualizationState } from "../client-base-actualization-state.js";
import type { UserRole } from "@shared/auth";

export type LocalGlobalSearchContext = {
  role: UserRole | null | undefined;
  profile: ReleaseDemoProfile;
  isRealUser: boolean;
  snap: OrgSnapshot | null;
  visPayload: MyVisibleCodesResult | null;
  assignmentsScope: AssignmentsScope | undefined;
  actState: ActualizationState;
  actEnabled: boolean;
  incomingAssignments: AssignmentDto[];
  outgoingAssignments: AssignmentDto[];
};

function buildScopedDealerRows(ctx: LocalGlobalSearchContext): DealerRow[] {
  const access = ctx.role ? mapUserRoleToDealerBaseAccess(ctx.role) : mapSalesRoleToDealerBaseAccess(ctx.profile.role);

  let rows: DealerRow[];
  if (ctx.isRealUser && ctx.snap && ctx.visPayload) {
    const releaseRows = getVisibleDealerRows(
      getCatalogDealerRows(),
      ctx.visPayload.all,
      ctx.visPayload.codes,
    );
    rows = ctx.actEnabled
      ? buildDealerBaseRowsWithActualization(ctx.actState, ctx.profile, {
                    releaseDealerRows: releaseRows,
        })
      : releaseRows;
    return roleScopedDealerRowsForReal(
      rows,
      ctx.snap,
      access,
      undefined,
      assignmentsScopeIsActive(ctx.assignmentsScope) ? ctx.assignmentsScope : undefined,
    );
  }

  rows = ctx.actEnabled
    ? buildDealerBaseRowsWithActualization(ctx.actState, ctx.profile)
    : getCatalogDealerRows();
  return roleScopedDealerRows(rows, ctx.profile);
}

function dealerHaystack(row: DealerRow): string {
  return normalizeSearchHaystack([
    row.name,
    row.city,
    row.region,
    row.releaseCode,
    row.actualizationInn,
    row.releaseAddress,
    row.manager,
    row.regionalManager,
    row.ropName,
    row.external1cCode,
  ]);
}

function searchLocalClients(rows: DealerRow[], query: string, limit: number): GlobalSearchResult["clients"] {
  const matched: GlobalSearchResult["clients"] = [];
  for (const row of rows) {
    if (!multiWordSearchMatches(dealerHaystack(row), query)) continue;
    matched.push({
      id: row.id,
      label: row.name,
      sublabel: row.city?.trim() || row.releaseCode || undefined,
      href: `/dealers/${encodeURIComponent(row.id)}`,
    });
    if (matched.length >= limit) break;
  }
  return matched;
}

function searchLocalTradePoints(
  ctx: LocalGlobalSearchContext,
  scopedRows: DealerRow[],
  query: string,
  limit: number,
): GlobalSearchResult["tradePoints"] {
  const tpListRealOpts =
    ctx.isRealUser && ctx.snap && ctx.visPayload
      ? {
          releaseDealerRows: getVisibleDealerRows(
            getCatalogDealerRows(),
            ctx.visPayload.all,
            ctx.visPayload.codes,
          ),
          orgScope: { snap: ctx.snap, access: mapUserRoleToDealerBaseAccess(ctx.role!) },
        }
      : undefined;

  const list = buildTradePointListForActualization(ctx.actState, ctx.profile, {
    includeArchivedTradePoints: false,
    ...(tpListRealOpts ?? {}),
  });

  const scopedDealerIds = new Set(scopedRows.map((r) => r.id));
  const matched: GlobalSearchResult["tradePoints"] = [];
  for (const row of list) {
    if (!scopedDealerIds.has(row.dealerId)) continue;
    if (!multiWordSearchMatches(row.searchHaystack, query)) continue;
    matched.push({
      id: row.tradePointId,
      dealerId: row.dealerId,
      label: row.tradePointName,
      sublabel: [row.dealerName, row.city !== "—" ? row.city : null].filter(Boolean).join(" · ") || undefined,
      href: `/dealers/${encodeURIComponent(row.dealerId)}/trade-points/${encodeURIComponent(row.tradePointId)}`,
    });
    if (matched.length >= limit) break;
  }
  return matched;
}

function searchLocalProducts(query: string, limit: number): GlobalSearchResult["products"] {
  const products = searchCatalog(query, limit * 2);
  const matched: GlobalSearchResult["products"] = [];
  for (const p of products) {
    const haystack = buildCatalogProductSearchHaystack(p);
    if (!catalogSearchQueryMatchesHaystack(query, haystack)) continue;
    matched.push({
      id: p.id,
      label: p.name,
      sublabel: p.article || undefined,
      href: `/catalog/${encodeURIComponent(p.id)}`,
    });
    if (matched.length >= limit) break;
  }
  return matched;
}

function assignmentHaystack(a: AssignmentDto): string {
  return normalizeSearchHaystack([a.title, a.assigneeName, a.tradePointId, a.dealerId, a.createdByName]);
}

function searchLocalAssignments(
  incoming: AssignmentDto[],
  outgoing: AssignmentDto[],
  query: string,
  limit: number,
): GlobalSearchResult["assignments"] {
  const seen = new Set<string>();
  const matched: GlobalSearchResult["assignments"] = [];
  for (const a of [...incoming, ...outgoing]) {
    if (seen.has(a.id)) continue;
    if (!multiWordSearchMatches(assignmentHaystack(a), query)) continue;
    seen.add(a.id);
    matched.push({
      id: a.id,
      label: a.title,
      sublabel: a.assigneeName ?? undefined,
      href: `/assignment/${encodeURIComponent(a.id)}`,
    });
    if (matched.length >= limit) break;
  }
  return matched;
}

export function buildLocalGlobalSearch(ctx: LocalGlobalSearchContext, query: string): GlobalSearchResult {
  const limit = GLOBAL_SEARCH_LIMIT_PER_TYPE;
  const scopedRows = buildScopedDealerRows(ctx);

  return {
    clients: searchLocalClients(scopedRows, query, limit),
    tradePoints: searchLocalTradePoints(ctx, scopedRows, query, limit),
    products: searchLocalProducts(query, limit),
    assignments: searchLocalAssignments(ctx.incomingAssignments, ctx.outgoingAssignments, query, limit),
  };
}

export function emptyGlobalSearchResult(): GlobalSearchResult {
  return { clients: [], tradePoints: [], products: [], assignments: [] };
}

export function buildDefaultLocalSearchContext(profile: ReleaseDemoProfile): LocalGlobalSearchContext {
  return {
    role: null,
    profile,
    isRealUser: false,
    snap: null,
    visPayload: null,
    assignmentsScope: undefined,
    actState: createEmptyActualizationState(),
    actEnabled: false,
    incomingAssignments: [],
    outgoingAssignments: [],
  };
}
