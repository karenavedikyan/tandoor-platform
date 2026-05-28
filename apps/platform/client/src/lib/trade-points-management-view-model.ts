/**
 * Агрегаты для управленческого экрана «Торговые точки» (директор / РОП) на team actualization plane.
 * Источник строк: `buildTradePointListForActualization(act, profile, { includeArchivedTradePoints: false })`
 * — те же правила, что и список /trade-points без архива и без архивных клиентов.
 */

import {
  managersCatalogForTeam,
  resolveDealerRowTeamId,
  resolveManagementCatalogTeamId,
  teamsForManagementView,
} from "@/lib/dealer-base-management-view-model";
import { getDealerManagerDisplay, type DealerRow } from "@/lib/dealer-base-mock-data";
import { managerDisplayMatchesCatalogName } from "@/lib/rop-manager-filters";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import { normalizeTerritoryCityName } from "@/lib/territory-city-normalize";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";

export type TradePointsManagementMode = "overview" | "by_rop" | "cities";

/** Рабочие ТТ для KPI: не архив, не виртуальная заглушка. */
export function isManagementTradePointRow(r: TradePointListRow): boolean {
  return !r.isArchived && !r.isVirtual;
}

export function tradePointHasPhoto(r: TradePointListRow): boolean {
  const p = r.point;
  return Boolean(p.coverPhotoUrl?.trim() || p.coverPhotoThumbnailUrl?.trim() || p.photos?.attached);
}

export function tradePointShowcaseUnfilled(r: TradePointListRow): boolean {
  return r.showcaseBucket === "not_filled" || r.showcaseBucket === "partial" || r.showcaseBucket === "needs_attention";
}

export type TradePointDetailFilter = "all" | "no_photo" | "unfilled" | "with_photo";

export function tradePointMatchesDetailFilter(r: TradePointListRow, f: TradePointDetailFilter): boolean {
  if (f === "all") return true;
  if (f === "no_photo") return !tradePointHasPhoto(r);
  if (f === "with_photo") return tradePointHasPhoto(r);
  if (f === "unfilled") return tradePointShowcaseUnfilled(r);
  return true;
}

export type CityTpAgg = {
  cityKey: string;
  displayName: string;
  tpCount: number;
  dealerIds: Set<string>;
  noPhoto: number;
  unfilled: number;
  rows: TradePointListRow[];
};

export type ManagerTpAgg = {
  managerId: string;
  name: string;
  teamId: string;
  tpCount: number;
  dealerIds: Set<string>;
  cityIds: Set<string>;
  noPhoto: number;
  unfilled: number;
  rows: TradePointListRow[];
};

export type RopTpGroup = {
  teamId: string;
  ropName: string;
  tpCount: number;
  dealerCount: number;
  cityCount: number;
  noPhoto: number;
  unfilled: number;
  managerCatalogCount: number;
  topManagerName: string;
  managers: ManagerTpAgg[];
  rows: TradePointListRow[];
};

export type TradePointsStructureSummary = {
  totalTp: number;
  dealersWithTp: number;
  citiesCount: number;
  noPhoto: number;
  withPhoto: number;
  unfilled: number;
  avgTpPerDealer: string;
  clientsNoTp: number;
  clientsWithTp: number;
};

export function buildTradePointsStructureSummary(
  rows: TradePointListRow[],
  activeDealers: DealerRow[],
): TradePointsStructureSummary {
  const work = rows.filter(isManagementTradePointRow);
  const dealerIds = new Set(work.map((r) => r.dealerId));
  const cities = new Set<string>();
  for (const r of work) {
    cities.add(normalizeTerritoryCityName(r.city, r.address).replace(/^—$/, "Без города"));
  }
  let noPhoto = 0;
  let withPhoto = 0;
  let unfilled = 0;
  for (const r of work) {
    if (tradePointHasPhoto(r)) withPhoto += 1;
    else noPhoto += 1;
    if (tradePointShowcaseUnfilled(r)) unfilled += 1;
  }
  const activeScoped = activeDealers.filter((d) => d.status === "активный");
  const withTpDealers = activeScoped.filter((d) => d.outlets > 0).length;
  const noTpDealers = activeScoped.filter((d) => d.outlets === 0).length;
  const avg =
    dealerIds.size > 0 ? (work.length / dealerIds.size).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
  return {
    totalTp: work.length,
    dealersWithTp: dealerIds.size,
    citiesCount: cities.size,
    noPhoto,
    withPhoto,
    unfilled,
    avgTpPerDealer: avg,
    clientsNoTp: noTpDealers,
    clientsWithTp: withTpDealers,
  };
}

export function buildCityTpAggs(rows: TradePointListRow[]): CityTpAgg[] {
  const work = rows.filter(isManagementTradePointRow);
  const map = new Map<string, CityTpAgg>();
  for (const r of work) {
    const display = normalizeTerritoryCityName(r.city, r.address);
    const cityKey = display === "Без города" ? "__no_city__" : display;
    let cur = map.get(cityKey);
    if (!cur) {
      cur = {
        cityKey,
        displayName: display,
        tpCount: 0,
        dealerIds: new Set(),
        noPhoto: 0,
        unfilled: 0,
        rows: [],
      };
      map.set(cityKey, cur);
    }
    cur.rows.push(r);
    cur.tpCount += 1;
    cur.dealerIds.add(r.dealerId);
    if (!tradePointHasPhoto(r)) cur.noPhoto += 1;
    if (tradePointShowcaseUnfilled(r)) cur.unfilled += 1;
  }
  return Array.from(map.values());
}

export function topCitiesForTpChart(cities: CityTpAgg[], topN: number): {
  top: CityTpAgg[];
  maxTp: number;
  noCity: CityTpAgg | null;
} {
  const named = cities
    .filter((c) => c.displayName !== "Без города" && c.tpCount > 0)
    .sort((a, b) => b.tpCount - a.tpCount || a.displayName.localeCompare(b.displayName, "ru"));
  const top = named.slice(0, topN);
  const maxTp = top.reduce((m, c) => Math.max(m, c.tpCount), 0) || 1;
  const noCity = cities.find((c) => c.displayName === "Без города" && c.tpCount > 0) ?? null;
  return { top, maxTp, noCity };
}

function aggregateManagersTp(teamId: string, teamRows: TradePointListRow[], orgSnap?: OrgSnapshot | null): ManagerTpAgg[] {
  const managers = managersCatalogForTeam(teamId, orgSnap);
  return managers.map((m) => {
    const rows = teamRows.filter(
      (r) =>
        r.dealer.releaseManagerId === m.id || managerDisplayMatchesCatalogName(getDealerManagerDisplay(r.dealer), m.name),
    );
    const dealerIds = new Set(rows.map((r) => r.dealerId));
    const cityKeys = new Set(rows.map((r) => normalizeTerritoryCityName(r.city, r.address)));
    let noPhoto = 0;
    let unfilled = 0;
    for (const r of rows) {
      if (!tradePointHasPhoto(r)) noPhoto += 1;
      if (tradePointShowcaseUnfilled(r)) unfilled += 1;
    }
    return {
      managerId: m.id,
      name: m.name,
      teamId,
      tpCount: rows.length,
      dealerIds,
      cityIds: cityKeys,
      noPhoto,
      unfilled,
      rows,
    };
  });
}

function pickTopManagerByTp(managers: ManagerTpAgg[]): string {
  const sorted = [...managers].filter((m) => m.tpCount > 0).sort((a, b) => b.tpCount - a.tpCount || a.name.localeCompare(b.name, "ru"));
  return sorted[0]?.name ?? "—";
}

export function buildRopTpGroups(
  rows: TradePointListRow[],
  teams: { teamId: string; ropName: string }[],
  orgSnap?: OrgSnapshot | null,
): RopTpGroup[] {
  const work = rows.filter(isManagementTradePointRow);
  return teams.map((t) => {
    const catalogTeamId = resolveManagementCatalogTeamId(t.teamId, orgSnap);
    const teamRows = work.filter((r) => resolveDealerRowTeamId(r.dealer) === catalogTeamId);
    const managers = aggregateManagersTp(catalogTeamId, teamRows, orgSnap);
    const dealerIds = new Set(teamRows.map((r) => r.dealerId));
    const cityKeys = new Set(teamRows.map((r) => normalizeTerritoryCityName(r.city, r.address)));
    let noPhoto = 0;
    let unfilled = 0;
    for (const r of teamRows) {
      if (!tradePointHasPhoto(r)) noPhoto += 1;
      if (tradePointShowcaseUnfilled(r)) unfilled += 1;
    }
    const mgrCatalog = managersCatalogForTeam(t.teamId, orgSnap);
    return {
      teamId: t.teamId,
      ropName: t.ropName,
      tpCount: teamRows.length,
      dealerCount: dealerIds.size,
      cityCount: cityKeys.size,
      noPhoto,
      unfilled,
      managerCatalogCount: mgrCatalog.length,
      topManagerName: pickTopManagerByTp(managers),
      managers,
      rows: teamRows,
    };
  });
}

export function topRopTeamsByTp(groups: RopTpGroup[], limit: number): RopTpGroup[] {
  return [...groups]
    .filter((g) => g.tpCount > 0)
    .sort((a, b) => b.tpCount - a.tpCount || a.ropName.localeCompare(b.ropName, "ru"))
    .slice(0, limit);
}

export type ClientSummaryRow = {
  dealerId: string;
  name: string;
  city: string;
  manager: string;
  tpCount: number;
};

export function buildClientSummariesFromDealers(dealers: DealerRow[]): ClientSummaryRow[] {
  return dealers
    .filter((d) => d.status === "активный")
    .map((d) => ({
      dealerId: d.id,
      name: d.name,
      city: d.city,
      manager: getDealerManagerDisplay(d),
      tpCount: d.outlets,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}
