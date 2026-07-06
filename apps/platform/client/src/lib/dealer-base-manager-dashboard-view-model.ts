/**
 * Дашборд менеджера для карточки в командном обзоре и страницы «штаб менеджера».
 */

import { buildCityModels } from "./dealer-base-management-view-model.js";
import { buildDealerRowSegments, type DealerBaseSegmentRow } from "./dealer-base-dealer-segment.js";
import { dealerNeedsAttention } from "./dealer-base-role-views.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import type { ManagerHeatLevel } from "./manager-load-heat.js";
import type { ManagerRowModel } from "./dealer-base-management-view-model.js";

export type ManagerDetailObservationCtx = {
  manager: ManagerRowModel;
  ropName: string;
  teamId: string;
};

/** Счётчики ManagerRowModel из строк — как в aggregateManagersForTeam (без каталога). */
export function buildManagerRowModelFromDealerRows(
  managerId: string,
  name: string,
  rows: DealerRow[],
  teamId = "",
): ManagerRowModel {
  return {
    managerId,
    name,
    teamId,
    active: rows.filter((r) => r.status === "активный").length,
    potential: rows.filter((r) => r.status === "потенциальный").length,
    attention: rows.filter((r) => dealerNeedsAttention(r)).length,
    outlets: rows.reduce((a, r) => a + r.outlets, 0),
    topSegmentLabel: "—",
    rows,
    isExternal: true,
    externalTeamName: null,
  };
}

/**
 * Родный менеджер из ropGroups или синтетический контекст для РОП-наблюдателя (внешний менеджер по грантам).
 */
export function resolveManagerDetailObservationCtx(args: {
  managerCtx: ManagerDetailObservationCtx | null;
  viewingOtherUserScope: boolean;
  targetScopeReady: boolean;
  managerId: string;
  scopedRows: DealerRow[];
  managerDisplayName: string;
  observerRopName: string;
}): ManagerDetailObservationCtx | null {
  if (args.managerCtx) return args.managerCtx;
  if (args.viewingOtherUserScope && args.targetScopeReady) {
    return {
      manager: buildManagerRowModelFromDealerRows(
        args.managerId,
        args.managerDisplayName,
        args.scopedRows,
      ),
      ropName: args.observerRopName,
      teamId: "",
    };
  }
  return null;
}

export type ManagerCitySummary = {
  cityKey: string;
  displayName: string;
  activeClients: number;
  tradePoints: number;
};

export type ManagerDashboardModel = {
  managerId: string;
  managerName: string;
  ropName: string;
  teamId: string;
  heatLevel: ManagerHeatLevel;
  rows: DealerRow[];
  kpis: {
    activeClients: number;
    tradePoints: number;
    potential: number;
    attention: number;
  };
  segments: DealerBaseSegmentRow[];
  cities: ManagerCitySummary[];
  attentionRows: DealerRow[];
};

export function buildManagerDashboardModel(
  manager: ManagerRowModel,
  ropName: string,
  heatLevel: ManagerHeatLevel,
): ManagerDashboardModel {
  const rows = manager.rows;
  const cities = buildCityModels(rows)
    .filter((c) => c.displayName !== "Без города" || c.activeClients > 0)
    .sort((a, b) => b.activeClients - a.activeClients || a.displayName.localeCompare(b.displayName, "ru"))
    .map((c) => ({
      cityKey: c.cityKey,
      displayName: c.displayName,
      activeClients: c.activeClients,
      tradePoints: c.tradePoints,
    }));

  const attentionRows = rows.filter((r) => dealerNeedsAttention(r));

  return {
    managerId: manager.managerId,
    managerName: manager.name,
    ropName,
    teamId: manager.teamId,
    heatLevel,
    rows,
    kpis: {
      activeClients: manager.active,
      tradePoints: manager.outlets,
      potential: manager.potential,
      attention: manager.attention,
    },
    segments: buildDealerRowSegments(rows),
    cities,
    attentionRows,
  };
}

export function findManagerInRopGroups(
  managerId: string,
  ropGroups: { teamId: string; ropName: string; managers: ManagerRowModel[] }[],
): { manager: ManagerRowModel; ropName: string; teamId: string } | null {
  for (const g of ropGroups) {
    const manager = g.managers.find((m) => m.managerId === managerId);
    if (manager) return { manager, ropName: g.ropName, teamId: g.teamId };
  }
  return null;
}

export function findManagerInRopGroupByTeam(
  managerId: string,
  teamId: string | null | undefined,
  ropGroups: { teamId: string | null; ropName: string; managers: ManagerRowModel[] }[],
): { manager: ManagerRowModel; ropName: string; teamId: string } | null {
  if (!teamId) return findManagerInRopGroups(managerId, ropGroups as { teamId: string; ropName: string; managers: ManagerRowModel[] }[]);
  const teamKey = String(teamId);
  for (const g of ropGroups) {
    if (String(g.teamId ?? "") !== teamKey) continue;
    const manager = g.managers.find((m) => m.managerId === managerId);
    if (manager) return { manager, ropName: g.ropName, teamId: String(g.teamId ?? "") };
  }
  return findManagerInRopGroups(managerId, ropGroups as { teamId: string; ropName: string; managers: ManagerRowModel[] }[]);
}
