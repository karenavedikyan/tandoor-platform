/**
 * Общие типы scope team/org (Промт 423).
 */

import type { UserRole } from "./auth.js";
import type { DbScopeTotals } from "./db-scope-formula.js";

export type ScopeTotals = DbScopeTotals;

export type ScopeKpiTotals = Pick<
  ScopeTotals,
  | "tp_status_active"
  | "tp_status_potential"
  | "tp_status_attention"
  | "dealer_no_status"
  | "avg_distribution"
>;

export type ScopeCountTotals = Pick<
  ScopeTotals,
  "active_dealers" | "active_trade_points" | "trashed_dealers" | "trashed_trade_points"
>;

export type ScopeTradePoint = {
  tp_id: string;
  dealer_id: string;
  is_primary: boolean;
};

export type TeamScopeMemberUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type TeamScopeMember = {
  user: TeamScopeMemberUser;
  totals: ScopeCountTotals & ScopeKpiTotals;
  active_dealer_ids: string[];
  active_dealer_external_keys: string[];
  trashed_dealer_external_keys: string[];
  active_trade_points: ScopeTradePoint[];
};

export type TeamScopeTeamInfo = {
  id: string;
  name: string;
  rop: { id: string; name: string; email: string };
};

export type TeamScopePayload = {
  success: true;
  team: TeamScopeTeamInfo;
  members: TeamScopeMember[];
  team_totals: ScopeCountTotals & ScopeKpiTotals;
};

export type OrgScopeTeamBlock = {
  team: { id: string; name: string; rop: { id: string; name: string; email: string } | null };
  members: TeamScopeMember[];
  team_totals: ScopeCountTotals & ScopeKpiTotals;
};

export type OrgScopePayload = {
  success: true;
  org: { id: string; name: string };
  teams: OrgScopeTeamBlock[];
  orphan: {
    label: string;
    members: TeamScopeMember[];
    totals: ScopeCountTotals & ScopeKpiTotals;
  };
  org_totals: ScopeCountTotals & ScopeKpiTotals;
};

export type MemberTotals = TeamScopeMember["totals"];
export type TeamTotals = TeamScopePayload["team_totals"];
