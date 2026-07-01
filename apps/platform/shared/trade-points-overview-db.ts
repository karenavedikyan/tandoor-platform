/**
 * Промт 393 — trade-points-overview из реальной БД (trade_points + assignments).
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";
import { computeDbScopeForUser, DEALER_OVERRIDE_JOIN } from "./db-scope-formula.js";
import { dealerJoinStatusActive } from "./record-status.js";
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
  /** Региональный менеджер (dealer_overrides.regional_manager_id), не продажник. */
  isRegional?: boolean;
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

export type TradePointsOverviewViewerTeam = {
  teamId: string;
  teamName: string;
  ropUserId: string | null;
  ropFullName: string;
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

type RegionalManagerDealerStat = {
  fullName: string;
  dealerCount: number;
};

/** Клиенты регионала в зоне команды (dealer_overrides.regional_manager_id ∩ scope). */
export async function fetchRegionalManagerDealerCountsByTeam(
  pool: PoolLike,
  scopedDealerKeys: string[],
  viewerTeam?: TradePointsOverviewViewerTeam | null,
): Promise<Map<string, Map<string, RegionalManagerDealerStat>>> {
  const out = new Map<string, Map<string, RegionalManagerDealerStat>>();
  if (scopedDealerKeys.length === 0) return out;

  const q = await pool.query<{
    team_id: string;
    rm_id: string;
    rm_name: string | null;
    dealer_count: string;
  }>(
    `SELECT
       COALESCE(
         (SELECT t.id::text FROM teams t WHERE t.rop_user_id = d_ov.rop_id LIMIT 1),
         ca.team_id::text,
         '__no_team__'
       ) AS team_id,
       d_ov.regional_manager_id::text AS rm_id,
       rmu.full_name AS rm_name,
       COUNT(DISTINCT d.external_key)::text AS dealer_count
     FROM dealers d
     ${DEALER_OVERRIDE_JOIN}
     LEFT JOIN users rmu ON rmu.id = d_ov.regional_manager_id
     LEFT JOIN client_assignments ca ON ca.client_code = upper(d.release_code)
     WHERE d.external_key = ANY($1::text[])
       AND d_ov.regional_manager_id IS NOT NULL
       AND ${dealerJoinStatusActive("d_ov")}
     GROUP BY 1, 2, 3`,
    [scopedDealerKeys],
  );

  for (const row of q.rows) {
    const teamId = viewerTeam ? viewerTeam.teamId : row.team_id;
    const rmId = row.rm_id?.trim();
    if (!teamId || !rmId) continue;
    let teamMap = out.get(teamId);
    if (!teamMap) {
      teamMap = new Map();
      out.set(teamId, teamMap);
    }
    teamMap.set(rmId, {
      fullName: row.rm_name?.trim() || "—",
      dealerCount: Number(row.dealer_count) || 0,
    });
  }
  return out;
}

function buildRegionalManagerTpBuckets(
  tradePoints: ScopedTradePointDto[],
  viewerTeam?: TradePointsOverviewViewerTeam | null,
): Map<string, Map<string, { fullName: string; tps: ScopedTradePointDto[] }>> {
  const buckets = new Map<string, Map<string, { fullName: string; tps: ScopedTradePointDto[] }>>();
  for (const tp of tradePoints) {
    const rmId = tp.regionalManagerUserId?.trim();
    if (!rmId) continue;
    const tk = viewerTeam ? viewerTeam.teamId : teamKey(tp);
    let teamMap = buckets.get(tk);
    if (!teamMap) {
      teamMap = new Map();
      buckets.set(tk, teamMap);
    }
    let mgr = teamMap.get(rmId);
    if (!mgr) {
      mgr = { fullName: tp.regionalManagerFullName?.trim() || "—", tps: [] };
      teamMap.set(rmId, mgr);
    }
    mgr.tps.push(tp);
  }
  return buckets;
}

function appendRegionalManagersToGroup(
  managersArr: TradePointsOverviewDbManager[],
  teamId: string,
  regionalTpBuckets: Map<string, Map<string, { fullName: string; tps: ScopedTradePointDto[] }>>,
  regionalDealerCounts: Map<string, Map<string, RegionalManagerDealerStat>>,
  showcaseStatsByTpId?: Map<string, { withoutPhoto: boolean; notFilled: boolean }>,
): TradePointsOverviewDbManager[] {
  const existingIds = new Set(managersArr.map((m) => m.userId).filter(Boolean));
  const tpByRm: Map<string, { fullName: string; tps: ScopedTradePointDto[] }> =
    regionalTpBuckets.get(teamId) ?? new Map();
  const dealerByRm: Map<string, RegionalManagerDealerStat> =
    regionalDealerCounts.get(teamId) ?? new Map();
  const rmIds = new Set<string>([...Array.from(tpByRm.keys()), ...Array.from(dealerByRm.keys())]);

  for (const rmId of Array.from(rmIds)) {
    if (existingIds.has(rmId)) continue;
    const tpEntry = tpByRm.get(rmId);
    const dealerEntry = dealerByRm.get(rmId);
    const tps = tpEntry?.tps ?? [];
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
    managersArr.push({
      userId: rmId,
      fullName: dealerEntry?.fullName ?? tpEntry?.fullName ?? "—",
      tradePoints: tps.length,
      clientsWithTp: dealerEntry?.dealerCount ?? clientSet.size,
      cities: citySet.size,
      withoutPhoto: mgrWithoutPhoto,
      notFilled: mgrNotFilled,
      isRegional: true,
    });
  }
  return managersArr;
}

export async function buildTradePointsOverviewFromDb(
  pool: PoolLike,
  userId: string,
  role: UserRole,
  showcaseStatsByTpId?: Map<string, { withoutPhoto: boolean; notFilled: boolean }>,
  viewerTeam?: TradePointsOverviewViewerTeam | null,
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

  if (viewerTeam) {
    const single = {
      teamId: viewerTeam.teamId,
      teamName: viewerTeam.teamName,
      ropUserId: viewerTeam.ropUserId,
      ropFullName: viewerTeam.ropFullName,
      managers: new Map<string, { fullName: string; tps: ScopedTradePointDto[] }>(),
    };
    teamAgg.set(viewerTeam.teamId, single);
    for (const tp of tradePoints) {
      const mk = managerKey(tp);
      let mgr = single.managers.get(mk);
      if (!mgr) {
        mgr = { fullName: managerName(tp), tps: [] };
        single.managers.set(mk, mgr);
      }
      mgr.tps.push(tp);
    }
  } else {
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
  }

  const regionalTpBuckets = buildRegionalManagerTpBuckets(tradePoints, viewerTeam);
  const regionalDealerCounts =
    role === "regional_manager"
      ? new Map<string, Map<string, RegionalManagerDealerStat>>()
      : await fetchRegionalManagerDealerCountsByTeam(pool, scope.active_dealer_external_keys, viewerTeam);

  for (const teamId of Array.from(
    new Set<string>([...Array.from(regionalDealerCounts.keys()), ...Array.from(regionalTpBuckets.keys())]),
  )) {
    if (teamAgg.has(teamId)) continue;
    const sampleBucket = regionalTpBuckets.get(teamId);
    const sampleTp = sampleBucket
      ? Array.from(sampleBucket.values()).find((v) => v.tps.length > 0)?.tps[0]
      : undefined;
    teamAgg.set(teamId, {
      teamId: teamId === "__no_team__" ? null : teamId,
      teamName: sampleTp?.teamName?.trim() || "Без команды",
      ropUserId: sampleTp?.ropUserId ?? null,
      ropFullName: sampleTp?.ropFullName?.trim() || "—",
      managers: new Map(),
    });
  }

  const ropGroups: TradePointsOverviewDbRopGroup[] = Array.from(teamAgg.values()).map((g) => {
    const teamIdForRegional = g.teamId ?? "__no_team__";
    let managersArr: TradePointsOverviewDbManager[] = Array.from(g.managers.entries()).map(
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
    managersArr = appendRegionalManagersToGroup(
      managersArr,
      teamIdForRegional,
      regionalTpBuckets,
      regionalDealerCounts,
      showcaseStatsByTpId,
    );
    managersArr.sort(
      (a, b) => b.tradePoints - a.tradePoints || a.fullName.localeCompare(b.fullName, "ru"),
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
      managers: managersArr,
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
