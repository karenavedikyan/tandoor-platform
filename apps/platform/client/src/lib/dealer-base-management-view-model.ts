/**
 * Агрегаты для управленческого экрана «Клиентская база» (директор / РОП) на team actualization plane.
 * Только рабочие строки без архивных клиентов/ТТ — см. buildDealerBaseRowsWithActualization(..., includeArchivedDealers: false).
 */

import { computeManagementDealerPickerKpis } from "@/lib/client-base-management-scope";
import {
  CLIENT_CATEGORY_META,
  getClientCategoryLabel,
  isClientTopTier,
  type ClientCategoryId,
} from "@/lib/client-category";
import { dealerNeedsAttention, mapSalesRoleToDealerBaseAccess, type DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import { getDealerManagerDisplay, getDealerRopDisplay, type DealerRow } from "@/lib/dealer-base-mock-data";
import { getRopOptions, managerDisplayMatchesCatalogName, resolveTeamIdFromRopDisplayName } from "@/lib/rop-manager-filters";
import { getTeamLeadForTeam, getTeamManagers, type SalesUser } from "@/lib/sales-control-data";
import { normalizeTerritoryCityName } from "@/lib/territory-city-normalize";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import { realEffectiveTeamLeadTeamId, realRopOptions, realTeamManagers } from "@/lib/real-org-adapter";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";




export function managersCatalogForTeam(teamId: string, orgSnap?: OrgSnapshot | null): SalesUser[] {
  if (orgSnap) return realTeamManagers(orgSnap, teamId);
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

/**
 * Сопоставление клиента менеджеру: при наличии записи в `responsibleByCode` — только БД (без fallback на seed).
 */
export function buildDbAwareManagerMatcher(
  managerCatalogId: string,
  managerCatalogName: string,
  teamId: string,
  responsibleByCode?: Map<string, string>,
  userIdToCatalogMgrId?: Map<string, string>,
): (r: DealerRow) => boolean {
  return (r: DealerRow) => {
    if (resolveDealerRowTeamId(r) !== teamId) return false;
    if (responsibleByCode && userIdToCatalogMgrId) {
      const code = dealerRowClientCodeForAssignments(r);
      if (responsibleByCode.has(code)) {
        const dbUid = responsibleByCode.get(code);
        if (!dbUid) return false;
        const catId = userIdToCatalogMgrId.get(dbUid);
        return catId === managerCatalogId;
      }
    }
    return (
      r.releaseManagerId === managerCatalogId ||
      managerDisplayMatchesCatalogName(getDealerManagerDisplay(r), managerCatalogName)
    );
  };
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

export function aggregateManagersForTeam(
  teamId: string,
  teamRows: DealerRow[],
  orgSnap?: OrgSnapshot | null,
  responsibleByCode?: Map<string, string>,
  userIdToCatalogMgrId?: Map<string, string>,
): ManagerRowModel[] {
  const managers = managersCatalogForTeam(teamId, orgSnap);
  return managers.map((m) => {
    const match = buildDbAwareManagerMatcher(m.id, m.name, teamId, responsibleByCode, userIdToCatalogMgrId);
    const rows = teamRows.filter(match);
    const active = rows.filter((r) => r.status === "активный").length;
    const potential = rows.filter((r) => r.status === "потенциальный").length;
    const attention = rows.filter((r) => dealerNeedsAttention(r)).length;
    const outlets = rows.reduce((a, r) => a + r.outlets, 0);
    return {
      managerId: m.id,
      name: m.name,
      teamId,
      active,
      potential,
      attention,
      outlets,
      topSegmentLabel: bestTopSegmentLabel(rows),
      rows,
    };
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
  const set = new Set<string>();
  for (const tid of teamIds) {
    for (const m of getTeamManagers(tid)) {
      const has = rows.some(
        (r) =>
          (r.releaseManagerId === m.id || managerDisplayMatchesCatalogName(getDealerManagerDisplay(r), m.name)) &&
          r.status === "активный" &&
          r.outlets === 0,
      );
      if (has) set.add(m.id);
    }
  }
  return set.size;
}

export function countCitiesWithActiveNoTp(cities: CityRowModel[]): number {
  return cities.filter((c) => c.dealerRows.some((r) => r.status === "активный" && r.outlets === 0)).length;
}

export function topLeaderManagers(rows: DealerRow[], teamIds: string[], limit: number): { id: string; name: string; active: number }[] {
  const list: { id: string; name: string; active: number }[] = [];
  for (const tid of teamIds) {
    for (const m of getTeamManagers(tid)) {
      const active = rows.filter(
        (r) =>
          resolveDealerRowTeamId(r) === tid &&
          (r.releaseManagerId === m.id || managerDisplayMatchesCatalogName(getDealerManagerDisplay(r), m.name)) &&
          r.status === "активный",
      ).length;
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
  responsibleByCode?: Map<string, string>,
  userIdToCatalogMgrId?: Map<string, string>,
): RopGroupModel[] {
  const teamActiveCounts = teams.map((t) => ({
    teamId: t.teamId,
    n: rows.filter((r) => resolveDealerRowTeamId(r) === t.teamId && r.status === "активный").length,
  }));
  const maxTeamActive = teamActiveCounts.reduce((m, x) => Math.max(m, x.n), 0);

  return teams.map((t) => {
    const teamRows = rows.filter((r) => resolveDealerRowTeamId(r) === t.teamId);
    const managers = aggregateManagersForTeam(t.teamId, teamRows, orgSnap, responsibleByCode, userIdToCatalogMgrId);
    const active = teamRows.filter((r) => r.status === "активный").length;
    const potential = teamRows.filter((r) => r.status === "потенциальный").length;
    const attention = teamRows.filter((r) => dealerNeedsAttention(r)).length;
    const outlets = teamRows.reduce((a, r) => a + r.outlets, 0);
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
      active,
      potential,
      attention,
      outlets,
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

export type ClientListFilter = "all" | "active" | "potential" | "attention" | "noTp";

export function dealerMatchesClientListFilter(row: DealerRow, f: ClientListFilter): boolean {
  if (f === "all") return true;
  if (f === "active") return row.status === "активный";
  if (f === "potential") return row.status === "потенциальный";
  if (f === "attention") return dealerNeedsAttention(row);
  if (f === "noTp") return row.status === "активный" && row.outlets === 0;
  return true;
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
