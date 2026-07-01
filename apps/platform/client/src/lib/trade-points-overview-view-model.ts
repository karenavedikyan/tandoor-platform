/**
 * View-model для управленческого обзора торговых точек (API + карточки менеджеров).
 */

import { UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE } from "@shared/admin/actualization-dedupe";
import { buildHashPath } from "./hash-route-utils.js";
import type { ManagerHeatLevel } from "./manager-load-heat.js";
import type {
  TradePointsOverview,
  TradePointsOverviewRopGroup,
  TradePointsOverviewRopManager,
} from "./trade-points-overview-api.js";
import { catalogTeamIdForRopUserId } from "./dealer-base-real-scope.js";
import {
  resolveManagementCatalogTeamId,
  resolveManagementOrgTeamUuid,
  type ManagerRowModel,
} from "./dealer-base-management-view-model.js";
import type { OrgSnapshot } from "./use-org-snapshot.js";

export type TpStateSegmentKey = "with_photo" | "no_photo" | "unfilled";

export type TpStateSegmentRow = {
  key: TpStateSegmentKey;
  label: string;
  count: number;
};

const TP_SEGMENT_ORDER: TpStateSegmentKey[] = ["with_photo", "no_photo", "unfilled"];

const TP_SEGMENT_LABEL: Record<TpStateSegmentKey, string> = {
  with_photo: "С фото",
  no_photo: "Без фото",
  unfilled: "Не заполнены",
};

export function tpStateSegmentBarClass(key: TpStateSegmentKey): string {
  switch (key) {
    case "with_photo":
      return "bg-emerald-500/80";
    case "no_photo":
      return "bg-amber-400/75";
    case "unfilled":
      return "bg-rose-400/75";
  }
}

export function buildTpStateSegments(
  withPhoto: number,
  withoutPhoto: number,
  notFilled: number,
): TpStateSegmentRow[] {
  const map: Record<TpStateSegmentKey, number> = {
    with_photo: Math.max(0, withPhoto),
    no_photo: Math.max(0, withoutPhoto),
    unfilled: Math.max(0, notFilled),
  };
  return TP_SEGMENT_ORDER.filter((k) => map[k] > 0).map((key) => ({
    key,
    label: TP_SEGMENT_LABEL[key],
    count: map[key],
  }));
}

export type ManagerTpLoadEntry = {
  id: string;
  tradePoints: number;
};

export function computeManagerTpHeatMap(managers: ManagerTpLoadEntry[]): Record<string, ManagerHeatLevel> {
  const result: Record<string, ManagerHeatLevel> = {};
  const n = managers.length;
  if (n === 0) return result;
  const sorted = [...managers].sort((a, b) => b.tradePoints - a.tradePoints);
  if (n === 1) {
    result[sorted[0]!.id] = "medium";
    return result;
  }
  if (n === 2) {
    result[sorted[0]!.id] = "high";
    result[sorted[1]!.id] = "low";
    return result;
  }
  const highCount = Math.max(1, Math.floor(n / 3));
  const lowCount = Math.max(1, Math.floor(n / 3));
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    result[row.id] = i < highCount ? "high" : i >= n - lowCount ? "low" : "medium";
  }
  return result;
}

const HEAT_SORT_ORDER: Record<ManagerHeatLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortManagersByTpLoad<T extends { userId: string; fullName: string; tradePoints: number }>(
  managers: T[],
  heatMap: Record<string, ManagerHeatLevel>,
): T[] {
  return [...managers].sort((a, b) => {
    const ha = heatMap[a.userId] ?? "medium";
    const hb = heatMap[b.userId] ?? "medium";
    const tier = HEAT_SORT_ORDER[ha] - HEAT_SORT_ORDER[hb];
    if (tier !== 0) return tier;
    const load = b.tradePoints - a.tradePoints;
    if (load !== 0) return load;
    return a.fullName.localeCompare(b.fullName, "ru");
  });
}

export function managerCatalogIdFromUserId(userId: string): string {
  return UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE[userId] ?? userId;
}

export function managerShellHref(userId: string): string {
  return buildHashPath(`/dealer-base/manager/${encodeURIComponent(managerCatalogIdFromUserId(userId))}`);
}

export function resolveManagerApiUserId(catalogOrUserId: string): string {
  for (const [uuid, mgr] of Object.entries(UUID_TO_MGR_FOR_ACTUALIZATION_DEDUPE)) {
    if (mgr === catalogOrUserId) return uuid;
  }
  return catalogOrUserId;
}

export function overviewCityCards(overview: TradePointsOverview) {
  return [...overview.cities]
    .filter((c) => c.tradePointsCount > 0)
    .sort((a, b) => b.tradePointsCount - a.tradePointsCount || a.cityName.localeCompare(b.cityName, "ru"));
}

export function managerCardFromOverview(m: TradePointsOverviewRopManager) {
  const withPhoto = Math.max(0, m.tradePoints - m.withoutPhoto);
  return {
    userId: m.userId,
    fullName: m.fullName,
    tradePoints: m.tradePoints,
    clientsWithTp: m.clientsWithTp,
    cities: m.cities,
    withoutPhoto: m.withoutPhoto,
    notFilled: m.notFilled,
    withPhoto,
    isRegional: m.isRegional === true,
    segments: buildTpStateSegments(withPhoto, m.withoutPhoto, m.notFilled),
    shellHref: managerShellHref(m.userId),
  };
}

export function collectTradePointsOverviewTeamLookupKeys(
  g: Pick<TradePointsOverviewRopGroup, "teamId" | "ropUserId">,
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

export type OverviewManagerCard = ReturnType<typeof managerCardFromOverview>;

export type TradePointsOverviewDisplayIndex = {
  tradePointsByManagerId: Map<string, number>;
  clientsByManagerId: Map<string, number>;
  tradePointsByTeamKey: Map<string, number>;
  clientsByTeamKey: Map<string, number>;
  managerCountByTeamKey: Map<string, number>;
  managerIdsByTeamKey: Map<string, Set<string>>;
  managerCardsByTeamKey: Map<string, OverviewManagerCard[]>;
};

export function buildTradePointsOverviewDisplayIndex(
  ropGroups: TradePointsOverviewRopGroup[],
  orgSnap: OrgSnapshot | null | undefined,
  managerCatalogIdForUserId: (userId: string) => string | undefined,
): TradePointsOverviewDisplayIndex {
  const tradePointsByManagerId = new Map<string, number>();
  const clientsByManagerId = new Map<string, number>();
  const tradePointsByTeamKey = new Map<string, number>();
  const clientsByTeamKey = new Map<string, number>();
  const managerCountByTeamKey = new Map<string, number>();
  const managerIdsByTeamKey = new Map<string, Set<string>>();
  const managerCardsByTeamKey = new Map<string, OverviewManagerCard[]>();

  for (const g of ropGroups) {
    const managerIds = new Set<string>();
    const cards = g.managers.map((m) => managerCardFromOverview(m));
    for (const m of g.managers) {
      managerIds.add(m.userId);
      tradePointsByManagerId.set(m.userId, m.tradePoints);
      clientsByManagerId.set(m.userId, m.clientsWithTp);
      const catalogId = managerCatalogIdForUserId(m.userId);
      if (catalogId) {
        managerIds.add(catalogId);
        tradePointsByManagerId.set(catalogId, m.tradePoints);
        clientsByManagerId.set(catalogId, m.clientsWithTp);
      }
    }
    for (const key of collectTradePointsOverviewTeamLookupKeys(g, orgSnap)) {
      tradePointsByTeamKey.set(key, g.tradePoints);
      clientsByTeamKey.set(key, g.clientsWithTp);
      managerCountByTeamKey.set(key, g.managers.length);
      managerIdsByTeamKey.set(key, managerIds);
      managerCardsByTeamKey.set(key, cards);
    }
  }

  return {
    tradePointsByManagerId,
    clientsByManagerId,
    tradePointsByTeamKey,
    clientsByTeamKey,
    managerCountByTeamKey,
    managerIdsByTeamKey,
    managerCardsByTeamKey,
  };
}

export function filterManagersToTradePointsOverview<T extends { managerId: string }>(
  managers: T[],
  overviewManagerIds: Set<string> | undefined,
  overviewReady: boolean,
): T[] {
  if (!overviewReady || !overviewManagerIds) return managers;
  return managers.filter((m) => overviewManagerIds.has(m.managerId));
}

/** Разбить карточки менеджеров на продажников и региональных (для секций кокпита). */
export function splitManagersByRegionalRole<T extends { isRegional?: boolean }>(
  managers: T[],
): { salesManagers: T[]; regionalManagers: T[] } {
  const salesManagers: T[] = [];
  const regionalManagers: T[] = [];
  for (const m of managers) {
    if (m.isRegional) regionalManagers.push(m);
    else salesManagers.push(m);
  }
  return { salesManagers, regionalManagers };
}

function managerIdentityKeys(managerId: string): Set<string> {
  const keys = new Set<string>();
  keys.add(managerId);
  keys.add(resolveManagerApiUserId(managerId));
  keys.add(managerCatalogIdFromUserId(managerId));
  return keys;
}

function managersShareIdentity(a: string, b: string): boolean {
  const keysA = managerIdentityKeys(a);
  for (const k of Array.from(managerIdentityKeys(b))) {
    if (keysA.has(k)) return true;
  }
  return false;
}

export function lookupOverviewManagerCardsForTeam(
  managerCardsByTeamKey: Map<string, OverviewManagerCard[]>,
  teamId: string,
  orgSnap?: OrgSnapshot | null,
): OverviewManagerCard[] | undefined {
  const candidates = [teamId, String(teamId ?? "__no_rop__")];
  if (orgSnap) {
    candidates.push(resolveManagementCatalogTeamId(teamId, orgSnap));
    candidates.push(resolveManagementOrgTeamUuid(teamId, orgSnap));
  }
  for (const key of candidates) {
    const cards = managerCardsByTeamKey.get(key);
    if (cards) return cards;
  }
  return undefined;
}

/** Каталожные менеджеры ∪ overview-менеджеры по грантам (которых нет в каталоге команды). */
export function unionCatalogManagersWithOverviewCards(
  managers: ManagerRowModel[],
  teamId: string,
  opts: {
    overviewReady: boolean;
    overviewManagerIds: Set<string> | undefined;
    managerCardsByTeamKey: Map<string, OverviewManagerCard[]>;
    orgSnap?: OrgSnapshot | null;
  },
): ManagerRowModel[] {
  const base = filterManagersToTradePointsOverview(managers, opts.overviewManagerIds, opts.overviewReady);
  if (!opts.overviewReady) return base;

  const overviewCards = lookupOverviewManagerCardsForTeam(opts.managerCardsByTeamKey, teamId, opts.orgSnap);
  if (!overviewCards?.length) return base;

  const added: ManagerRowModel[] = [];
  for (const card of overviewCards) {
    if (base.some((m) => managersShareIdentity(m.managerId, card.userId))) continue;
    if (added.some((m) => managersShareIdentity(m.managerId, card.userId))) continue;
    added.push({
      managerId: card.userId,
      name: card.fullName,
      teamId,
      active: card.clientsWithTp,
      outlets: card.tradePoints,
      potential: 0,
      attention: 0,
      topSegmentLabel: "—",
      rows: [],
      isExternal: true,
      externalTeamName: null,
      countsFromServerTotals: true,
      isRegional: card.isRegional,
    });
  }
  return [...base, ...added];
}

export function formatOverviewScopedCount(
  value: number | null,
  opts: { loading: boolean; ready: boolean; fallback?: number },
): string {
  if (opts.loading) return "…";
  if (!opts.ready) return String(opts.fallback ?? "—");
  return String(value ?? 0);
}
