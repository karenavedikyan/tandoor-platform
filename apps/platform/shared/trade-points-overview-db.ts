/**
 * Промт 393 — trade-points-overview из реальной БД (trade_points + assignments).
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";
import { computeDbScopeForUser } from "./db-scope-formula.js";
import {
  fetchScopedTradePointsRows,
  mapScopedTradePointRow,
  type ScopedTradePointDto,
} from "./trade-points-list-scoped-handlers.js";

export type TradePointsOverviewDbStructure = {
  activeTradePoints: number;
  clientsWithTp: number;
  cities: number;
  withoutPhoto: number;
  notFilled: number;
  withPhoto: number;
  clientsWithoutTp: number;
  totalActiveClients: number;
};

export type TradePointsOverviewDbCity = {
  cityKey: string;
  cityName: string;
  tradePointsCount: number;
  clientsCount: number;
};

export type TradePointsOverviewDbManager = {
  userId: string;
  fullName: string;
  tradePoints: number;
  clientsWithTp: number;
  cities: number;
  withoutPhoto: number;
  notFilled: number;
};

export type TradePointsOverviewDbRopGroup = {
  teamId: string | null;
  teamName: string;
  ropUserId: string | null;
  ropFullName: string;
  managerCount: number;
  tradePoints: number;
  clientsWithTp: number;
  cities: number;
  withoutPhoto: number;
  notFilled: number;
  managers: TradePointsOverviewDbManager[];
};

export type TradePointsOverviewDbPayload = {
  success: true;
  structure: TradePointsOverviewDbStructure;
  cities: TradePointsOverviewDbCity[];
  ropGroups: TradePointsOverviewDbRopGroup[];
  topRopTeams: {
    teamId: string | null;
    teamName: string;
    ropFullName: string;
    tradePoints: number;
    clientsWithTp: number;
  }[];
};

function cityKeyForTp(tp: ScopedTradePointDto): string {
  const raw = (tp.city ?? tp.dealerCity)?.trim();
  return raw || "__no_city__";
}

function cityNameForKey(key: string, tp: ScopedTradePointDto): string {
  if (key === "__no_city__") return "Без города";
  return (tp.city ?? tp.dealerCity)?.trim() || "Без города";
}

function managerKey(tp: ScopedTradePointDto): string {
  return tp.managerUserId ?? "__no_manager__";
}

function managerName(tp: ScopedTradePointDto): string {
  return tp.managerFullName?.trim() || "Без менеджера";
}

function teamKey(tp: ScopedTradePointDto): string {
  return tp.teamId ?? "__no_team__";
}

export async function buildTradePointsOverviewFromDb(
  pool: PoolLike,
  userId: string,
  role: UserRole,
  showcaseStatsByTpId?: Map<string, { withoutPhoto: boolean; notFilled: boolean }>,
): Promise<TradePointsOverviewDbPayload> {
  const scope = await computeDbScopeForUser(pool, userId, role);
  const sqlRows =
    role === "regional_manager"
      ? []
      : await fetchScopedTradePointsRows(pool, scope, { activeOnly: true });
  const tradePoints = sqlRows.map((r) => mapScopedTradePointRow(r));

  const clientsWithTpSet = new Set(tradePoints.map((tp) => tp.dealerExternalKey));
  const cityAgg = new Map<string, { cityName: string; tpCount: number; clientIds: Set<string> }>();
  let withoutPhoto = 0;
  let notFilled = 0;

  for (const tp of tradePoints) {
    const ck = cityKeyForTp(tp);
    const cur = cityAgg.get(ck) ?? {
      cityName: cityNameForKey(ck, tp),
      tpCount: 0,
      clientIds: new Set<string>(),
    };
    cur.tpCount += 1;
    cur.clientIds.add(tp.dealerExternalKey);
    cityAgg.set(ck, cur);

    const dbNotFilled = !tp.address?.trim() || !(tp.city ?? tp.dealerCity)?.trim();
    const sh = showcaseStatsByTpId?.get(tp.externalKey) ?? showcaseStatsByTpId?.get(tp.id);
    if (sh?.notFilled ?? dbNotFilled) notFilled += 1;
    if (sh?.withoutPhoto) withoutPhoto += 1;
  }

  const activeTradePoints = tradePoints.length;
  const withPhoto = Math.max(0, activeTradePoints - withoutPhoto);

  let totalActiveClients = scope.totals.active_dealers;
  if (scope.scope_explanation.full_catalog) {
    totalActiveClients = scope.totals.active_dealers;
  } else {
    totalActiveClients = scope.totals.active_dealers;
  }

  const clientsWithoutTp = Math.max(0, totalActiveClients - clientsWithTpSet.size);

  const structure: TradePointsOverviewDbStructure = {
    activeTradePoints,
    clientsWithTp: clientsWithTpSet.size,
    cities: cityAgg.size,
    withoutPhoto,
    notFilled,
    withPhoto,
    clientsWithoutTp,
    totalActiveClients,
  };

  const cities = Array.from(cityAgg.entries())
    .map(([cityKey, c]) => ({
      cityKey,
      cityName: c.cityName,
      tradePointsCount: c.tpCount,
      clientsCount: c.clientIds.size,
    }))
    .sort((a, b) => b.tradePointsCount - a.tradePointsCount || a.cityName.localeCompare(b.cityName, "ru"))
    .slice(0, 50);

  const teamAgg = new Map<
    string,
    {
      teamId: string | null;
      teamName: string;
      ropUserId: string | null;
      ropFullName: string;
      managers: Map<string, { fullName: string; tps: ScopedTradePointDto[] }>;
    }
  >();

  for (const tp of tradePoints) {
    const tk = teamKey(tp);
    let group = teamAgg.get(tk);
    if (!group) {
      group = {
        teamId: tp.teamId,
        teamName: tp.teamName?.trim() || "Без команды",
        ropUserId: tp.ropUserId,
        ropFullName: tp.ropFullName?.trim() || "—",
        managers: new Map(),
      };
      teamAgg.set(tk, group);
    }
    const mk = managerKey(tp);
    let mgr = group.managers.get(mk);
    if (!mgr) {
      mgr = { fullName: managerName(tp), tps: [] };
      group.managers.set(mk, mgr);
    }
    mgr.tps.push(tp);
  }

  const ropGroups: TradePointsOverviewDbRopGroup[] = Array.from(teamAgg.values()).map((g) => {
    const managersArr: TradePointsOverviewDbManager[] = Array.from(g.managers.entries()).map(
      ([userId, { fullName, tps }]) => {
        const clientSet = new Set(tps.map((tp) => tp.dealerExternalKey));
        const citySet = new Set(tps.map((tp) => cityKeyForTp(tp)).filter((c) => c !== "__no_city__"));
        let mgrWithoutPhoto = 0;
        let mgrNotFilled = 0;
        for (const tp of tps) {
          const dbNotFilled = !tp.address?.trim() || !(tp.city ?? tp.dealerCity)?.trim();
          const sh = showcaseStatsByTpId?.get(tp.externalKey) ?? showcaseStatsByTpId?.get(tp.id);
          if (sh?.withoutPhoto) mgrWithoutPhoto += 1;
          if (sh?.notFilled ?? dbNotFilled) mgrNotFilled += 1;
        }
        return {
          userId: userId === "__no_manager__" ? "" : userId,
          fullName,
          tradePoints: tps.length,
          clientsWithTp: clientSet.size,
          cities: citySet.size,
          withoutPhoto: mgrWithoutPhoto,
          notFilled: mgrNotFilled,
        };
      },
    );
    const groupTps = Array.from(g.managers.values()).flatMap((m) => m.tps);
    const groupClientSet = new Set(groupTps.map((tp) => tp.dealerExternalKey));
    const groupCitySet = new Set(groupTps.map((tp) => cityKeyForTp(tp)).filter((c) => c !== "__no_city__"));
    let groupWithoutPhoto = 0;
    let groupNotFilled = 0;
    for (const tp of groupTps) {
      const dbNotFilled = !tp.address?.trim() || !(tp.city ?? tp.dealerCity)?.trim();
      const sh = showcaseStatsByTpId?.get(tp.externalKey) ?? showcaseStatsByTpId?.get(tp.id);
      if (sh?.withoutPhoto) groupWithoutPhoto += 1;
      if (sh?.notFilled ?? dbNotFilled) groupNotFilled += 1;
    }
    return {
      teamId: g.teamId,
      teamName: g.teamName,
      ropUserId: g.ropUserId,
      ropFullName: g.ropFullName,
      managerCount: managersArr.length,
      tradePoints: groupTps.length,
      clientsWithTp: groupClientSet.size,
      cities: groupCitySet.size,
      withoutPhoto: groupWithoutPhoto,
      notFilled: groupNotFilled,
      managers: managersArr.sort(
        (a, b) => b.tradePoints - a.tradePoints || a.fullName.localeCompare(b.fullName, "ru"),
      ),
    };
  });
  ropGroups.sort((a, b) => b.tradePoints - a.tradePoints || a.teamName.localeCompare(b.teamName, "ru"));

  const topRopTeams = [...ropGroups]
    .sort((a, b) => b.tradePoints - a.tradePoints)
    .slice(0, 5)
    .map((g) => ({
      teamId: g.teamId,
      teamName: g.teamName,
      ropFullName: g.ropFullName,
      tradePoints: g.tradePoints,
      clientsWithTp: g.clientsWithTp,
    }));

  return {
    success: true,
    structure,
    cities,
    ropGroups,
    topRopTeams,
  };
}
