/**
 * Агрегаты для управленческого экрана «Клиентская база» (директор / РОП) на team actualization plane.
 * Только рабочие строки без архивных клиентов/ТТ — см. buildDealerBaseRowsWithActualization(...).
 */

import { computeManagementDealerPickerKpis } from "./client-base-management-scope.js";
import {
  CLIENT_CATEGORY_META,
  getClientCategoryLabel,
  isClientTopTier,
  type ClientCategoryId,
} from "./client-category.js";
import { dealerNeedsAttention, mapSalesRoleToDealerBaseAccess, type DealerBaseAccessRole } from "./dealer-base-role-views.js";
import { getDealerManagerDisplay, getDealerRopDisplay, type DealerRow } from "./dealer-base-mock-data.js";
import { getRopOptions, managerDisplayMatchesCatalogName, resolveTeamIdFromRopDisplayName } from "./rop-manager-filters.js";
import { getTeamLeadForTeam, getTeamManagers, type SalesUser } from "./sales-control-data.js";
import { normalizeTerritoryCityName } from "./territory-city-normalize.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import { getEffectiveTeamLeadTeamId } from "./release-demo-profile.js";
import { realEffectiveTeamLeadTeamId, realRopOptions, realTeamManagers } from "./real-org-adapter.js";
import { catalogTeamIdForRopUserId } from "./dealer-base-real-scope.js";
import type { OrgSnapshot } from "./use-org-snapshot.js";
import { UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE } from "@shared/admin/actualization-dedupe";
import type { MemberTotals, TeamTotals } from "@shared/dealers-scope-types";
import type { ClientBaseOverview } from "./client-base-overview-api.js";

export type ResponsibleByCodeMap = Record<string, string> | Map<string, string>;

function lookupResponsibleByCode(map: ResponsibleByCodeMap | undefined, code: string): string | undefined {
  if (!map || !code) return undefined;
  if (map instanceof Map) return map.get(code);
  return map[code];
}

function hasResponsibleByCode(map: ResponsibleByCodeMap | undefined, code: string): boolean {
  if (!map || !code) return false;
  if (map instanceof Map) return map.has(code);
  return Object.prototype.hasOwnProperty.call(map, code);
}

/** Catalog managerId (`mgr-*`) из UUID org snapshot или уже catalog id. */
export function catalogManagerIdFromUserRef(userRef: string): string {
  return UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE[userRef] ?? userRef;
}




/**
 * Catalog teamId (`team-kupiansky`) для фильтрации DealerRow.releaseTeamId.
 * В org snapshot `teamsForManagementView` часто отдаёт UUID команды — без маппинга teamRows = [].
 */
export function resolveManagementCatalogTeamId(teamId: string, orgSnap?: OrgSnapshot | null): string {
  if (!orgSnap) return teamId;
  if (teamId.startsWith("team-")) return teamId;
  const team = orgSnap.teams.find((t) => t.id === teamId);
  if (!team) return teamId;
  if (team.ropUserId) {
    const fromRop = catalogTeamIdForRopUserId(orgSnap, team.ropUserId);
    if (fromRop) return fromRop;
  }
  return teamId;
}

/** UUID команды в org snapshot для `realTeamManagers` (менеджеры из БД). */
export function resolveManagementOrgTeamUuid(teamId: string, orgSnap?: OrgSnapshot | null): string {
  if (!orgSnap) return teamId;
  if (!teamId.startsWith("team-")) return teamId;
  for (const t of orgSnap.teams) {
    if (t.id === teamId) return t.id;
    if (t.ropUserId) {
      const cat = catalogTeamIdForRopUserId(orgSnap, t.ropUserId);
      if (cat === teamId) return t.id;
    }
  }
  return teamId;
}

export function managersCatalogForTeam(teamId: string, orgSnap?: OrgSnapshot | null): SalesUser[] {
  if (orgSnap) {
    const orgUuid = resolveManagementOrgTeamUuid(teamId, orgSnap);
    return realTeamManagers(orgSnap, orgUuid);
  }
  return getTeamManagers(teamId);
}

export type DirectorClientBaseMode = "overview" | "by_rop" | "cities";

export type CityRowModel = {
  cityKey: string;
  displayName: string;
  activeClients: number;
  tradePoints: number;
  dealerRows: DealerRow[];
};

export type ManagerRowModel = {
  managerId: string;
  name: string;
  teamId: string;
  active: number;
  potential: number;
  attention: number;
  outlets: number;
  topSegmentLabel: string;
  rows: DealerRow[];
  isExternal: boolean;
  externalTeamName?: string | null;
};

export type RopGroupModel = {
  teamId: string;
  ropName: string;
  managers: ManagerRowModel[];
  active: number;
  potential: number;
  attention: number;
  outlets: number;
  managerCatalogCount: number;
  statusLine: string;
  rows: DealerRow[];
};

export function resolveDealerRowTeamId(row: DealerRow): string | undefined {
  if (row.releaseTeamId) return row.releaseTeamId;
  const fromRop = resolveTeamIdFromRopDisplayName(getDealerRopDisplay(row));
  return fromRop;
}

export function dealerRowClientCodeForAssignments(row: DealerRow): string {
  return row.releaseCode?.trim() || row.id;
}

/** Кандидаты client_code для lookup в `responsibleByCode` (БД / my-codes). */
export function clientAssignmentCodeCandidates(row: DealerRow): string[] {
  const out: string[] = [];
  const release = row.releaseCode?.trim();
  if (release) out.push(release);
  const id = row.id?.trim();
  if (id && !out.includes(id)) out.push(id);
  return out;
}

function lookupResponsibleForDealerRow(map: ResponsibleByCodeMap, row: DealerRow): string | undefined {
  for (const code of clientAssignmentCodeCandidates(row)) {
    const hit = lookupResponsibleByCode(map, code);
    if (hit) return hit;
  }
  return undefined;
}

function hasResponsibleEntryForDealerRow(map: ResponsibleByCodeMap, row: DealerRow): boolean {
  for (const code of clientAssignmentCodeCandidates(row)) {
    if (hasResponsibleByCode(map, code)) return true;
  }
  return false;
}

/**
 * Сопоставление клиента менеджеру: при наличии записи в `responsibleByCode` — только БД (без fallback на seed).
 */
export function buildDbAwareManagerMatcher(
  managerCatalogId: string,
  managerCatalogName: string,
  teamId: string,
  responsibleByCode?: ResponsibleByCodeMap,
  userIdToCatalogMgrId?: Map<string, string>,
): (r: DealerRow) => boolean {
  void userIdToCatalogMgrId;
  const catalogMgrId = catalogManagerIdFromUserRef(managerCatalogId);
  return (r: DealerRow) => {
    if (resolveDealerRowTeamId(r) !== teamId) return false;
    return matchesManagerForDealerRow(r, catalogMgrId, managerCatalogName, responsibleByCode);
  };
}

/** Для строк, уже сгруппированных по catalogTeamId — без повторного resolveDealerRowTeamId. */
function buildDbAwareManagerMatcherForPreGroupedTeamRows(
  managerCatalogId: string,
  managerCatalogName: string,
  responsibleByCode?: ResponsibleByCodeMap,
): (r: DealerRow) => boolean {
  const catalogMgrId = catalogManagerIdFromUserRef(managerCatalogId);
  return (r: DealerRow) => matchesManagerForDealerRow(r, catalogMgrId, managerCatalogName, responsibleByCode);
}

function matchesManagerForDealerRow(
  r: DealerRow,
  catalogMgrId: string,
  managerCatalogName: string,
  responsibleByCode?: ResponsibleByCodeMap,
): boolean {
  if (responsibleByCode) {
    if (hasResponsibleEntryForDealerRow(responsibleByCode, r)) {
      const uuid = lookupResponsibleForDealerRow(responsibleByCode, r);
      if (uuid) {
        const catalogMgr = UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE[uuid] ?? uuid;
        return catalogMgr === catalogMgrId;
      }
      return false;
    }
  }
  return (
    r.releaseManagerId === catalogMgrId ||
    managerDisplayMatchesCatalogName(getDealerManagerDisplay(r), managerCatalogName)
  );
}

function groupRowsByResolvedTeamId(rows: DealerRow[]): Map<string, DealerRow[]> {
  const map = new Map<string, DealerRow[]>();
  for (const r of rows) {
    const teamId = resolveDealerRowTeamId(r);
    if (!teamId) continue;
    const bucket = map.get(teamId);
    if (bucket) bucket.push(r);
    else map.set(teamId, [r]);
  }
  return map;
}

function summarizeTeamRows(teamRows: DealerRow[]): {
  active: number;
  potential: number;
  attention: number;
  outlets: number;
} {
  let active = 0;
  let potential = 0;
  let attention = 0;
  let outlets = 0;
  for (const r of teamRows) {
    if (r.status === "активный") active += 1;
    if (r.status === "потенциальный") potential += 1;
    if (dealerNeedsAttention(r)) attention += 1;
    outlets += r.outlets;
  }
  return { active, potential, attention, outlets };
}

function categoryOrder(id: ClientCategoryId): number {
  return CLIENT_CATEGORY_META.find((m) => m.id === id)?.order ?? 999;
}

function bestTopSegmentLabel(rows: DealerRow[]): string {
  let best: ClientCategoryId | null = null;
  let bestOrder = 9999;
  for (const r of rows) {
    if (!isClientTopTier(r.clientCategory)) continue;
    const o = categoryOrder(r.clientCategory);
    if (o < bestOrder) {
      bestOrder = o;
      best = r.clientCategory;
    }
  }
  if (best) return getClientCategoryLabel(best);
  const active = rows.filter((r) => r.status === "активный");
  if (active.length === 0) return "—";
  const pick = active.reduce((a, b) => {
    const oa = categoryOrder(a.clientCategory);
    const ob = categoryOrder(b.clientCategory);
    return oa <= ob ? a : b;
  });
  return getClientCategoryLabel(pick.clientCategory);
}

function managerKeyForDealerRow(row: DealerRow): string {
  const mgrId = row.releaseManagerId?.trim();
  if (mgrId) return mgrId;
  const display = getDealerManagerDisplay(row).trim();
  return display || row.id;
}

function resolveExternalTeamName(userKey: string, orgSnap?: OrgSnapshot | null): string | null {
  if (!orgSnap) return null;
  const catalogKey = catalogManagerIdFromUserRef(userKey);
  const user =
    orgSnap.users.find((u) => u.id === userKey) ??
    orgSnap.users.find((u) => catalogManagerIdFromUserRef(u.id) === catalogKey);
  const userTeamId = user?.teamId?.trim();
  if (!userTeamId) return null;
  const team = orgSnap.teams.find((t) => t.id === userTeamId);
  return team?.name?.trim() || null;
}

function buildExternalManagerModelsFromRows(
  teamRows: DealerRow[],
  matchedRowIds: Set<string>,
  teamId: string,
  orgSnap?: OrgSnapshot | null,
): ManagerRowModel[] {
  const unmatched = teamRows.filter((r) => !matchedRowIds.has(r.id));
  if (unmatched.length === 0) return [];

  const byKey = new Map<string, DealerRow[]>();
  for (const r of unmatched) {
    const key = managerKeyForDealerRow(r);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(r);
    else byKey.set(key, [r]);
  }

  const out: ManagerRowModel[] = [];
  for (const [key, rows] of Array.from(byKey.entries())) {
    const mgrCatalogId = catalogManagerIdFromUserRef(key);
    const fromSnap = orgSnap?.users.find((u) => u.id === key)?.fullName?.trim();
    const name = fromSnap || getDealerManagerDisplay(rows[0]!) || key;
    out.push({
      managerId: mgrCatalogId,
      name,
      teamId,
      active: rows.filter((r) => r.status === "активный").length,
      potential: rows.filter((r) => r.status === "потенциальный").length,
      attention: rows.filter((r) => dealerNeedsAttention(r)).length,
      outlets: rows.reduce((a, r) => a + r.outlets, 0),
      topSegmentLabel: bestTopSegmentLabel(rows),
      rows,
      isExternal: true,
      externalTeamName: resolveExternalTeamName(key, orgSnap),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function aggregateManagersForTeam(
  teamId: string,
  teamRows: DealerRow[],
  orgSnap?: OrgSnapshot | null,
  responsibleByCode?: ResponsibleByCodeMap,
  _userIdToCatalogMgrId?: Map<string, string>,
  membersTotalsById?: Map<string, MemberTotals>,
): ManagerRowModel[] {
  void _userIdToCatalogMgrId;
  const catalogTeamId = resolveManagementCatalogTeamId(teamId, orgSnap);
  const managers = managersCatalogForTeam(catalogTeamId, orgSnap);
  const catalogResults = managers.map((m) => {
    const mgrCatalogId = catalogManagerIdFromUserRef(m.id);
    const match = buildDbAwareManagerMatcherForPreGroupedTeamRows(mgrCatalogId, m.name, responsibleByCode);
    const rows = teamRows.filter(match);
    const dbTotals = membersTotalsById?.get(m.id) ?? membersTotalsById?.get(mgrCatalogId);
    if (dbTotals) {
      return {
        managerId: mgrCatalogId,
        name: m.name,
        teamId,
        active: dbTotals.active_dealers,
        potential: 0,
        attention: 0,
        outlets: dbTotals.active_trade_points,
        topSegmentLabel: bestTopSegmentLabel(rows),
        rows,
        isExternal: false,
        externalTeamName: null,
      };
    }
    const active = rows.filter((r) => r.status === "активный").length;
    const potential = rows.filter((r) => r.status === "потенциальный").length;
    const attention = rows.filter((r) => dealerNeedsAttention(r)).length;
    const outlets = rows.reduce((a, r) => a + r.outlets, 0);
    return {
      managerId: mgrCatalogId,
      name: m.name,
      teamId,
      active,
      potential,
      attention,
      outlets,
      topSegmentLabel: bestTopSegmentLabel(rows),
      rows,
      isExternal: false,
      externalTeamName: null,
    };
  });

  const matchedRowIds = new Set<string>();
  for (const m of catalogResults) {
    for (const r of m.rows) matchedRowIds.add(r.id);
  }
  const external = buildExternalManagerModelsFromRows(teamRows, matchedRowIds, teamId, orgSnap);
  return [...catalogResults, ...external];
}

function collectGrantedOrphanRows(
  rows: DealerRow[],
  teams: { teamId: string }[],
  orgSnap: OrgSnapshot | null | undefined,
  grantedCodes?: Set<string>,
): DealerRow[] {
  if (!grantedCodes?.size) return [];
  const teamCatalogIds = new Set(teams.map((t) => resolveManagementCatalogTeamId(t.teamId, orgSnap)));
  return rows.filter((r) => {
    const code = dealerRowClientCodeForAssignments(r);
    if (!grantedCodes.has(code) && !grantedCodes.has(r.id)) return false;
    const tid = resolveDealerRowTeamId(r);
    if (!tid) return true;
    const catalogTid = resolveManagementCatalogTeamId(tid, orgSnap);
    return !teamCatalogIds.has(catalogTid);
  });
}

function buildRopStatusLine(teamRows: DealerRow[], managers: ManagerRowModel[], maxTeamActive: number): string {
  const active = teamRows.filter((r) => r.status === "активный").length;
  const parts: string[] = [];
  if (maxTeamActive > 0 && active === maxTeamActive) parts.push("лидер по активным");
  const emptyMgr = managers.filter((m) => m.active === 0 && m.potential === 0 && m.attention === 0);
  if (emptyMgr.length > 0 && managers.length > 1) parts.push("есть менеджеры без базы");
  const noTp = teamRows.some((r) => r.status === "активный" && r.outlets === 0);
  if (noTp) parts.push("есть клиенты без ТТ");
  if (parts.length === 0) return "база распределена";
  return parts.join(" · ");
}

export function buildCityModels(rows: DealerRow[]): CityRowModel[] {
  const map = new Map<string, CityRowModel>();
  for (const r of rows) {
    const display = normalizeTerritoryCityName(r.city, r.releaseAddress);
    const cityKey = display === "Без города" ? "__no_city__" : display;
    let cur = map.get(cityKey);
    if (!cur) {
      cur = { cityKey, displayName: display, activeClients: 0, tradePoints: 0, dealerRows: [] };
      map.set(cityKey, cur);
    }
    cur.dealerRows.push(r);
    if (r.status === "активный") cur.activeClients += 1;
    cur.tradePoints += r.outlets;
  }
  return Array.from(map.values());
}

export function topCitiesForChart(cities: CityRowModel[], topN: number): {
  top: CityRowModel[];
  maxActive: number;
  noCity: CityRowModel | null;
} {
  const named = cities
    .filter((c) => c.displayName !== "Без города" && c.activeClients > 0)
    .sort((a, b) => b.activeClients - a.activeClients || a.displayName.localeCompare(b.displayName, "ru"));
  const top = named.slice(0, topN);
  const maxActive = top.reduce((m, c) => Math.max(m, c.activeClients), 0) || 1;
  const noCity = cities.find((c) => c.displayName === "Без города" && c.activeClients > 0) ?? null;
  return { top, maxActive, noCity };
}

export function countManagersWithActiveNoTp(rows: DealerRow[], teamIds: string[]): number {
  const managers = teamIds.flatMap((tid) => getTeamManagers(tid));
  const matched = new Set<string>();
  for (const r of rows) {
    if (r.status !== "активный" || r.outlets !== 0) continue;
    const mgrDisplay = getDealerManagerDisplay(r);
    for (const m of managers) {
      if (r.releaseManagerId === m.id || managerDisplayMatchesCatalogName(mgrDisplay, m.name)) {
        matched.add(m.id);
      }
    }
  }
  return matched.size;
}

export function countCitiesWithActiveNoTp(cities: CityRowModel[]): number {
  return cities.filter((c) => c.dealerRows.some((r) => r.status === "активный" && r.outlets === 0)).length;
}

export function topLeaderManagers(rows: DealerRow[], teamIds: string[], limit: number): { id: string; name: string; active: number }[] {
  const rowsByTeam = groupRowsByResolvedTeamId(rows);
  const list: { id: string; name: string; active: number }[] = [];
  for (const tid of teamIds) {
    const teamRows = rowsByTeam.get(tid) ?? [];
    for (const m of getTeamManagers(tid)) {
      let active = 0;
      for (const r of teamRows) {
        if (r.status !== "активный") continue;
        if (
          r.releaseManagerId === m.id ||
          managerDisplayMatchesCatalogName(getDealerManagerDisplay(r), m.name)
        ) {
          active += 1;
        }
      }
      list.push({ id: m.id, name: m.name, active });
    }
  }
  return list
    .filter((x) => x.active > 0)
    .sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, "ru"))
    .slice(0, limit);
}

export function teamsForManagementView(
  profile: ReleaseDemoProfile,
  dashboardRopTeamId: string,
  org?: { snap: OrgSnapshot; access: DealerBaseAccessRole } | null,
): { teamId: string; ropName: string }[] {
  if (org) {
    const { snap, access } = org;
    if (access === "team_lead") {
      const tid = realEffectiveTeamLeadTeamId(snap);
      const t = snap.teams.find((x) => x.id === tid);
      const ropName = t?.ropName?.trim() ? t.ropName.trim() : (t?.name ?? tid);
      return [{ teamId: tid, ropName }];
    }
    if (access === "sales_manager") {
      const self = snap.users.find((u) => u.id === snap.me.id);
      const tid = self?.teamId ?? "";
      if (!tid) return [];
      const t = snap.teams.find((x) => x.id === tid);
      const ropName = t?.ropName?.trim() ? t.ropName.trim() : (t?.name ?? tid);
      return [{ teamId: tid, ropName }];
    }
    const all = realRopOptions(snap).map((o) => ({ teamId: o.teamId, ropName: o.label }));
    if (dashboardRopTeamId === "all" || !dashboardRopTeamId) return all;
    const opt = all.find((o) => o.teamId === dashboardRopTeamId);
    return [{ teamId: dashboardRopTeamId, ropName: opt?.ropName ?? dashboardRopTeamId }];
  }

  const access = mapSalesRoleToDealerBaseAccess(profile.role);
  if (access === "team_lead") {
    const tid = getEffectiveTeamLeadTeamId(profile);
    const lead = getTeamLeadForTeam(tid);
    return [{ teamId: tid, ropName: lead?.name ?? tid }];
  }
  if (dashboardRopTeamId === "all" || !dashboardRopTeamId) {
    return getRopOptions().map((o) => ({ teamId: o.teamId, ropName: o.label }));
  }
  const opt = getRopOptions().find((o) => o.teamId === dashboardRopTeamId);
  return [{ teamId: dashboardRopTeamId, ropName: opt?.label ?? dashboardRopTeamId }];
}

export function buildRopGroups(
  rows: DealerRow[],
  teams: { teamId: string; ropName: string }[],
  orgSnap?: OrgSnapshot | null,
  responsibleByCode?: ResponsibleByCodeMap,
  userIdToCatalogMgrId?: Map<string, string>,
  grantedCodes?: Set<string>,
  teamTotalsById?: Map<string, TeamTotals>,
  membersTotalsByTeamId?: Map<string, Map<string, MemberTotals>>,
): RopGroupModel[] {
  void userIdToCatalogMgrId;
  const rowsByCatalogTeamId = groupRowsByResolvedTeamId(rows);
  const orphanGranted = collectGrantedOrphanRows(rows, teams, orgSnap, grantedCodes);

  const teamBundles = teams.map((t, index) => {
    const catalogTeamId = resolveManagementCatalogTeamId(t.teamId, orgSnap);
    let teamRows = rowsByCatalogTeamId.get(catalogTeamId) ?? [];
    if (index === 0 && orphanGranted.length > 0) {
      teamRows = [...teamRows, ...orphanGranted];
    }
    const teamDbTotals = teamTotalsById?.get(t.teamId);
    const stats = summarizeTeamRows(teamRows);
    return {
      t,
      catalogTeamId,
      teamRows,
      stats: teamDbTotals
        ? {
            active: teamDbTotals.active_dealers,
            potential: 0,
            attention: 0,
            outlets: teamDbTotals.active_trade_points,
          }
        : stats,
    };
  });
  const maxTeamActive = teamBundles.reduce((m, x) => Math.max(m, x.stats.active), 0);

  return teamBundles.map(({ t, catalogTeamId, teamRows, stats }) => {
    const membersTotals = membersTotalsByTeamId?.get(t.teamId);
    const managers = aggregateManagersForTeam(
      catalogTeamId,
      teamRows,
      orgSnap,
      responsibleByCode,
      userIdToCatalogMgrId,
      membersTotals,
    );
    const mgrCatalog = managersCatalogForTeam(t.teamId, orgSnap);
    const statusLine = buildRopStatusLine(
      teamRows,
      managers,
      maxTeamActive,
    );
    return {
      teamId: t.teamId,
      ropName: t.ropName,
      managers,
      active: stats.active,
      potential: stats.potential,
      attention: stats.attention,
      outlets: stats.outlets,
      managerCatalogCount: mgrCatalog.length,
      statusLine,
      rows: teamRows,
    };
  });
}

export type StructureInfographic = ReturnType<typeof computeManagementDealerPickerKpis> & {
  ratioTpPerClient: string;
  managersWithActiveNoTp: number;
  citiesWithActiveNoTp: number;
  topLeaders: { id: string; name: string; active: number }[];
};

export function buildStructureInfographic(rows: DealerRow[], teamIds: string[]): StructureInfographic {
  const kpis = computeManagementDealerPickerKpis(rows);
  const activeClients = kpis.active;
  const ratio =
    activeClients > 0 ? (kpis.outlets / activeClients).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
  const cities = buildCityModels(rows);
  return {
    ...kpis,
    ratioTpPerClient: ratio,
    managersWithActiveNoTp: countManagersWithActiveNoTp(rows, teamIds),
    citiesWithActiveNoTp: countCitiesWithActiveNoTp(cities),
    topLeaders: topLeaderManagers(rows, teamIds, 5),
  };
}

export type ClientListFilter = "all" | "active" | "potential" | "attention" | "noTp" | "no_status";

export function dealerMatchesClientListFilter(row: DealerRow, f: ClientListFilter): boolean {
  if (f === "all") return true;
  if (f === "active") return row.status === "активный";
  if (f === "potential") return row.status === "потенциальный";
  if (f === "attention") return dealerNeedsAttention(row);
  if (f === "noTp") return row.status === "активный" && row.outlets === 0;
  if (f === "no_status") return row.status !== "активный" && row.status !== "потенциальный";
  return true;
}

export type KpiDealerRow = DealerRow & { inCatalog?: boolean };

export function dealerMatchesKpiClientListFilter(row: KpiDealerRow, f: ClientListFilter): boolean {
  if (f === "all") return row.inCatalog === true;
  return dealerMatchesClientListFilter(row, f);
}

export function mapClientsListItemToDealerRow(
  item: import("./client-base-overview-api.js").ClientBaseClientsListClient,
): KpiDealerRow {
  const status: DealerRow["status"] =
    item.status === "active"
      ? "активный"
      : item.status === "potential"
        ? "потенциальный"
        : item.status === "attention"
          ? "требует внимания"
          : ("" as DealerRow["status"]);
  return {
    id: item.id,
    name: item.fullName,
    city: item.city ?? "",
    manager: item.managerFullName ?? "",
    status,
    outlets: item.tradePointsCount,
    distribution: 0,
    hasProblem: item.status === "attention",
    hasRecentActivity: true,
    clientCategory: "top350",
    tradePoints: item.tradePointIds.map((tpId) => ({
      id: tpId,
      name: tpId,
      city: item.city ?? "",
      address: "",
      format: "",
      isPrimary: false,
      importanceTier: null,
    })),
    inCatalog: item.inCatalog,
  } as unknown as KpiDealerRow;
}

export function mapClientsListTradePointsToListRows(
  tradePoints: import("./client-base-overview-api.js").ClientBaseClientsList["tradePoints"],
  clientsById: Map<string, KpiDealerRow>,
): TradePointListRow[] {
  return tradePoints.map((tp) => {
    const owner = clientsById.get(tp.clientId);
    return {
      tpId: tp.id,
      name: tp.name,
      city: tp.city,
      dealerId: tp.clientId,
      dealerName: owner?.name ?? tp.clientId,
      manager: owner ? getDealerManagerDisplay(owner) : "—",
    };
  });
}

export type TradePointListRow = {
  tpId: string;
  name: string;
  city: string;
  dealerId: string;
  dealerName: string;
  manager: string;
};

export function flattenTradePointsForRows(rows: DealerRow[]): TradePointListRow[] {
  const out: TradePointListRow[] = [];
  for (const r of rows) {
    const mgr = getDealerManagerDisplay(r);
    for (const tp of r.tradePoints) {
      out.push({
        tpId: tp.id,
        name: tp.name,
        city: tp.city?.trim() || r.city,
        dealerId: r.id,
        dealerName: r.name,
        manager: mgr,
      });
    }
  }
  return out;
}

/** Строка клиента для модалки manager_overview на /clients (из DealerRow + db-aware matcher). */
export type ManagerOverviewClientRow = {
  id: string;
  fullName: string;
  inn: string | null;
  city: string | null;
  legalEntity: boolean;
  status: "active" | "potential" | "attention";
  tradePointsCount: number;
  dealerProfileId: string;
};

export function dealerRowToManagerOverviewClient(row: DealerRow): ManagerOverviewClientRow {
  const inn = row.actualizationInn?.trim();
  const le = row.legalEntity?.trim();
  let status: ManagerOverviewClientRow["status"] = "active";
  if (row.status === "потенциальный") status = "potential";
  else if (dealerNeedsAttention(row)) status = "attention";
  return {
    id: row.id,
    fullName: row.name,
    inn: inn || null,
    city: row.city?.trim() || null,
    legalEntity: Boolean(le && le !== "—"),
    status,
    tradePointsCount: row.outlets,
    dealerProfileId: row.id,
  };
}

export function mapManagerOverviewClients(rows: DealerRow[]): ManagerOverviewClientRow[] {
  return [...rows]
    .map(dealerRowToManagerOverviewClient)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
}

/** Найти менеджера в ropGroups по catalog managerId (и опционально teamId). */
export function findManagerInRopGroups(
  ropGroups: RopGroupModel[],
  opts: { managerCatalogId: string; teamId?: string },
): { manager: ManagerRowModel; group: RopGroupModel } | null {
  const { managerCatalogId, teamId } = opts;
  if (teamId) {
    const group = ropGroups.find((g) => g.teamId === teamId);
    const manager = group?.managers.find((m) => m.managerId === managerCatalogId);
    if (group && manager) return { manager, group };
  }
  for (const group of ropGroups) {
    const manager = group.managers.find((m) => m.managerId === managerCatalogId);
    if (manager) return { manager, group };
  }
  return null;
}

export type ClientBaseClientKpis = {
  active: number;
  potential: number;
  attention: number;
};

export type OverviewCityCardModel = {
  cityKey: string;
  displayName: string;
  activeClients: number;
  tradePoints: number;
};

export function resolveClientKpisFromOverview(
  overview: ClientBaseOverview | null | undefined,
  structure: ClientBaseClientKpis,
): ClientBaseClientKpis {
  if (overview) {
    return {
      active: overview.structure.activeClients,
      potential: overview.structure.potentialClients,
      attention: overview.structure.attentionClients,
    };
  }
  return structure;
}

export function computeUnstatusedCatalogClients(
  totalCatalog: number,
  active: number,
  potential: number,
): number {
  return Math.max(0, totalCatalog - active - potential);
}

export function buildOverviewCityCardsFromDb(overview: ClientBaseOverview): OverviewCityCardModel[] {
  return overview.cities
    .filter((c) => c.city != null && c.clients > 0)
    .map((c) => ({
      cityKey: c.city!,
      displayName: c.city!,
      activeClients: c.clients,
      tradePoints: c.tradePoints,
    }))
    .sort((a, b) => b.activeClients - a.activeClients || a.displayName.localeCompare(b.displayName, "ru"));
}

function collectOverviewTeamLookupKeys(
  g: ClientBaseOverview["ropGroups"][number],
  orgSnap?: OrgSnapshot | null,
): string[] {
  const keys = new Set<string>();
  if (g.teamId) keys.add(String(g.teamId));
  if (g.ropUserId) keys.add(String(g.ropUserId));
  keys.add(String(g.teamId ?? g.ropUserId ?? "__no_rop__"));
  if (g.teamId && orgSnap) {
    keys.add(resolveManagementCatalogTeamId(g.teamId, orgSnap));
    keys.add(resolveManagementOrgTeamUuid(g.teamId, orgSnap));
  }
  if (g.ropUserId && orgSnap) {
    const fromRop = catalogTeamIdForRopUserId(orgSnap, g.ropUserId);
    if (fromRop) keys.add(fromRop);
  }
  return Array.from(keys);
}

function collectCatalogTeamLookupKeys(teamId: string, orgSnap?: OrgSnapshot | null): string[] {
  const keys = new Set<string>([teamId, String(teamId ?? "__no_rop__")]);
  if (orgSnap) {
    keys.add(resolveManagementCatalogTeamId(teamId, orgSnap));
    keys.add(resolveManagementOrgTeamUuid(teamId, orgSnap));
  }
  return Array.from(keys);
}

export function mergeOverviewClientCountsIntoRopGroups(
  ropGroups: RopGroupModel[],
  overviewRopGroups: ClientBaseOverview["ropGroups"],
  orgSnap?: OrgSnapshot | null,
  userIdToCatalogMgrId?: Map<string, string>,
): RopGroupModel[] {
  const overviewByTeamKey = new Map<string, ClientBaseOverview["ropGroups"][number]>();
  for (const g of overviewRopGroups) {
    for (const key of collectOverviewTeamLookupKeys(g, orgSnap)) {
      overviewByTeamKey.set(key, g);
    }
  }

  const overviewMgrByCatalogId = new Map<
    string,
    ClientBaseOverview["ropGroups"][number]["managers"][number]
  >();
  for (const g of overviewRopGroups) {
    for (const m of g.managers) {
      overviewMgrByCatalogId.set(m.userId, m);
      const catalogId = userIdToCatalogMgrId?.get(m.userId);
      if (catalogId) overviewMgrByCatalogId.set(catalogId, m);
    }
  }

  return ropGroups.map((group) => {
    let overviewGroup: ClientBaseOverview["ropGroups"][number] | undefined;
    for (const key of collectCatalogTeamLookupKeys(group.teamId, orgSnap)) {
      overviewGroup = overviewByTeamKey.get(key);
      if (overviewGroup) break;
    }

    const managers = group.managers.map((manager) => {
      const overviewManager = overviewMgrByCatalogId.get(manager.managerId);
      if (!overviewManager) return manager;
      return {
        ...manager,
        active: overviewManager.active,
        potential: overviewManager.potential,
        attention: overviewManager.attention,
      };
    });

    if (!overviewGroup) {
      return { ...group, managers };
    }

    return {
      ...group,
      managers,
      active: overviewGroup.clients,
      potential: overviewGroup.potential,
      attention: overviewGroup.attention,
    };
  });
}
