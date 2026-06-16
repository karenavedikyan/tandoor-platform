import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getCatalogDealerRows } from "@/lib/dealer-base-source";
import { dealerNeedsAttention, isDealerTop } from "@/lib/dealer-base-role-views";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import { logRealScopeAudit } from "./real-scope-audit";
import { getRopOptions } from "@/lib/rop-manager-filters";
import { managerDisplayMatchesCatalogName } from "@/lib/rop-manager-filters";
import { getTeamLeadForTeam, getTeamManagers, SALES_TEAMS } from "@/lib/sales-control-data";

export type TeamAttentionLevel = "critical" | "warning" | "neutral";

export type TeamLoadLevel = "overload" | "ok" | "underload";

export type TeamSummary = {
  teamId: string;
  ropName: string;
  teamDisplayName: string;
  managerCount: number;
  totalClients: number;
  activeClients: number;
  topClients: number;
  potentialClients: number;
  attentionClients: number;
  avgClientsPerManager: number;
  pctActive: number;
  pctAttention: number;
  leaderManagerName: string;
  riskManagerName: string;
};

function rowsForTeam(teamId: string, rows: DealerRow[] = getCatalogDealerRows()): DealerRow[] {
  return rows.filter((r) => r.releaseTeamId === teamId);
}

/** Уровень «светофора» по доле клиентов с вниманием. */
export function getAttentionLevel(pctAttention: number): TeamAttentionLevel {
  if (pctAttention > 50) return "critical";
  if (pctAttention >= 25) return "warning";
  return "neutral";
}

/** Перегруз / недогруз по среднему числу клиентов на менеджера. */
export function getLoadLevel(avgClientsPerManager: number): TeamLoadLevel {
  if (avgClientsPerManager > 150) return "overload";
  if (avgClientsPerManager < 50) return "underload";
  return "ok";
}

export function getTeamLeader(summary: TeamSummary): string {
  return summary.leaderManagerName;
}

export function getTeamRiskManager(summary: TeamSummary): string {
  return summary.riskManagerName;
}

export type TeamManagerAggRow = { id: string; name: string; total: number; active: number; attention: number };

type MgrAgg = TeamManagerAggRow;

function aggregateManagers(teamId: string, rows: DealerRow[]): MgrAgg[] {
  const managers = getTeamManagers(teamId);
  return managers.map((m) => {
    let total = 0;
    let active = 0;
    let attention = 0;
    for (const r of rows) {
      const match = r.releaseManagerId === m.id || managerDisplayMatchesCatalogName(r.manager, m.name);
      if (!match) continue;
      total += 1;
      if (r.status === "активный") active += 1;
      if (dealerNeedsAttention(r)) attention += 1;
    }
    return { id: m.id, name: m.name, total, active, attention };
  });
}

function pickLeader(aggs: MgrAgg[]): string {
  if (aggs.length === 0) return "—";
  const maxActive = Math.max(0, ...aggs.map((a) => a.active));
  if (maxActive === 0) return "—";
  const sorted = [...aggs].sort((a, b) => {
    if (b.active !== a.active) return b.active - a.active;
    const pa = a.total > 0 ? a.active / a.total : 0;
    const pb = b.total > 0 ? b.active / b.total : 0;
    if (Math.abs(pb - pa) > 1e-6) return pb - pa;
    return a.name.localeCompare(b.name, "ru");
  });
  return sorted[0]?.name ?? "—";
}

function pickRisk(aggs: MgrAgg[]): string {
  if (aggs.length === 0) return "—";
  const sorted = [...aggs].sort((a, b) => {
    if (b.attention !== a.attention) return b.attention - a.attention;
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name, "ru");
  });
  const top = sorted[0];
  if (!top || top.attention === 0) return "—";
  return top.name;
}

/** Агрегаты по менеджерам команды (для аналитики и сравнений). */
export function aggregateManagersForTeam(teamId: string): TeamManagerAggRow[] {
  const rows = rowsForTeam(teamId);
  return aggregateManagers(teamId, rows);
}

/** Агрегаты по менеджерам команды по переданным строкам (merge актуализации). */
export function aggregateManagersForTeamFromRows(teamId: string, scopedRows: DealerRow[]): TeamManagerAggRow[] {
  const rows = scopedRows.filter((r) => r.releaseTeamId === teamId);
  return aggregateManagers(teamId, rows);
}

/** Сводка по команде по переданным строкам клиентской базы (актуализация / без архива). */
export function buildTeamSummaryFromRows(teamId: string, rows: DealerRow[]): TeamSummary {
  const inTeam = rows.filter((r) => r.releaseTeamId === teamId);
  const managers = getTeamManagers(teamId);
  const managerCount = Math.max(managers.length, 1);

  const totalClients = inTeam.length;
  const activeClients = inTeam.filter((r) => r.status === "активный").length;
  const topClients = inTeam.filter(isDealerTop).length;
  const potentialClients = inTeam.filter((r) => r.status === "потенциальный").length;
  const attentionClients = inTeam.filter(dealerNeedsAttention).length;

  const avgClientsPerManager = Math.round((totalClients / managerCount) * 10) / 10;
  const pctActive = totalClients > 0 ? Math.round((100 * activeClients) / totalClients) : 0;
  const pctAttention = totalClients > 0 ? Math.round((100 * attentionClients) / totalClients) : 0;

  const aggs = aggregateManagers(teamId, inTeam);
  const leaderManagerName = pickLeader(aggs);
  const riskManagerName = pickRisk(aggs);

  const lead = getTeamLeadForTeam(teamId);
  const ropName = lead?.name ?? "—";
  const teamMeta = SALES_TEAMS.find((t) => t.id === teamId);
  const teamDisplayName = teamMeta?.name ?? teamId;

  return {
    teamId,
    ropName,
    teamDisplayName,
    managerCount: managers.length,
    totalClients,
    activeClients,
    topClients,
    potentialClients,
    attentionClients,
    avgClientsPerManager,
    pctActive,
    pctAttention,
    leaderManagerName,
    riskManagerName,
  };
}

export function buildTeamSummary(teamId: string): TeamSummary {
  return buildTeamSummaryFromRows(teamId, rowsForTeam(teamId));
}

export function buildTeamSummaries(profile: ReleaseDemoProfile): TeamSummary[] {
  if (profile.role === "sales_director" || profile.role === "analyst") {
    return getRopOptions().map((o) => buildTeamSummary(o.teamId));
  }
  if (profile.role === "team_lead") {
    logRealScopeAudit({
      callSite: "buildTeamSummaries@team-summary",
      profileRole: profile.role,
      personaUserId: profile.personaUserId,
      reason: "demo-fallback-for-real-user",
    });
    return [buildTeamSummary(getEffectiveTeamLeadTeamId(profile))];
  }
  return [];
}
