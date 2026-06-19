/**
 * Агрегация scope members → team_totals / org_totals (SET-union, Промт 423).
 */

import type { TeamScopeMember, TeamTotals } from "./dealers-scope-types.js";

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

export function aggregateMemberTotals(members: TeamScopeMember[]): TeamTotals {
  const keys = unionExternalKeys(members);
  return {
    active_dealers: keys.active.size,
    active_trade_points: members.reduce((s, m) => s + m.totals.active_trade_points, 0),
    trashed_dealers: keys.trashed.size,
    trashed_trade_points: members.reduce((s, m) => s + m.totals.trashed_trade_points, 0),
  };
}

/** org_totals: SET-union дилеров по всем members, сумма ТТ по team_totals + orphan. */
export function aggregateOrgTotals(
  teamTotalsList: TeamTotals[],
  orphanTotals: TeamTotals,
  allMembers: TeamScopeMember[],
): TeamTotals {
  const keys = unionExternalKeys(allMembers);
  return {
    active_dealers: keys.active.size,
    trashed_dealers: keys.trashed.size,
    active_trade_points:
      teamTotalsList.reduce((s, t) => s + t.active_trade_points, 0) + orphanTotals.active_trade_points,
    trashed_trade_points:
      teamTotalsList.reduce((s, t) => s + t.trashed_trade_points, 0) + orphanTotals.trashed_trade_points,
  };
}

/** @deprecated use aggregateOrgTotals for org level */
export function aggregateTotalsFromBlocks(blocks: TeamScopeMember[][]): TeamTotals {
  const allMembers = blocks.flat();
  return aggregateMemberTotals(allMembers);
}

export function sumMemberFieldTotals(members: TeamScopeMember[]): TeamTotals {
  return {
    active_dealers: members.reduce((s, m) => s + m.totals.active_dealers, 0),
    active_trade_points: members.reduce((s, m) => s + m.totals.active_trade_points, 0),
    trashed_dealers: members.reduce((s, m) => s + m.totals.trashed_dealers, 0),
    trashed_trade_points: members.reduce((s, m) => s + m.totals.trashed_trade_points, 0),
  };
}
