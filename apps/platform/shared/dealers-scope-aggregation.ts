/**
 * Агрегация scope members → team_totals / org_totals (SET-union, Промт 423).
 */

import type { TeamScopeMember, TeamTotals } from "./dealers-scope-types.js";

const KPI_PLACEHOLDER = {
  tp_status_active: 0,
  tp_status_potential: 0,
  tp_status_attention: 0,
  dealer_no_status: 0,
  avg_distribution: 0,
} as const;

export function unionExternalKeys(members: TeamScopeMember[]): {
  active: Set<string>;
  trashed: Set<string>;
} {
  const active = new Set<string>();
  const trashed = new Set<string>();
  for (const m of members) {
    for (const k of m.active_dealer_external_keys) active.add(k);
    for (const k of m.trashed_dealer_external_keys) trashed.add(k);
  }
  return { active, trashed };
}

/** SET-union активных ТТ по tp_id (RM может дублировать TP менеджеров команды). */
export function unionTradePointIds(members: TeamScopeMember[]): Set<string> {
  const ids = new Set<string>();
  for (const m of members) {
    for (const tp of m.active_trade_points) {
      if (tp.tp_id) ids.add(tp.tp_id);
    }
  }
  return ids;
}

export function aggregateMemberTotals(members: TeamScopeMember[]): TeamTotals {
  const keys = unionExternalKeys(members);
  return {
    active_dealers: keys.active.size,
    active_trade_points: unionTradePointIds(members).size,
    trashed_dealers: keys.trashed.size,
    // TODO(423c): SET-union по trashed tp_id, когда в TeamScopeMember появится trashed_trade_points[].
    trashed_trade_points: members.reduce((s, m) => s + m.totals.trashed_trade_points, 0),
    ...KPI_PLACEHOLDER,
  };
}

/** org_totals: SET-union дилеров и ТТ по всем members (без двойного счёта RM). */
export function aggregateOrgTotals(
  teamTotalsList: TeamTotals[],
  orphanTotals: TeamTotals,
  allMembers: TeamScopeMember[],
): TeamTotals {
  const keys = unionExternalKeys(allMembers);
  return {
    active_dealers: keys.active.size,
    trashed_dealers: keys.trashed.size,
    active_trade_points: unionTradePointIds(allMembers).size,
    trashed_trade_points:
      teamTotalsList.reduce((s, t) => s + t.trashed_trade_points, 0) + orphanTotals.trashed_trade_points,
    ...KPI_PLACEHOLDER,
  };
}

/** @deprecated use aggregateOrgTotals for org level */
export function aggregateTotalsFromBlocks(blocks: TeamScopeMember[][]): TeamTotals {
  const allMembers = blocks.flat();
  return aggregateMemberTotals(allMembers);
}

/** @deprecated use aggregateMemberTotals for SET-union semantics */
export function sumMemberFieldTotals(members: TeamScopeMember[]): TeamTotals {
  return {
    active_dealers: members.reduce((s, m) => s + m.totals.active_dealers, 0),
    active_trade_points: members.reduce((s, m) => s + m.totals.active_trade_points, 0),
    trashed_dealers: members.reduce((s, m) => s + m.totals.trashed_dealers, 0),
    trashed_trade_points: members.reduce((s, m) => s + m.totals.trashed_trade_points, 0),
    ...KPI_PLACEHOLDER,
  };
}
