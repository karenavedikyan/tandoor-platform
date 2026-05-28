/**
 * Дашборд менеджера для карточки в командном обзоре и страницы «штаб менеджера».
 */

import { buildCityModels } from "@/lib/dealer-base-management-view-model";
import { buildDealerRowSegments, type DealerBaseSegmentRow } from "@/lib/dealer-base-dealer-segment";
import { dealerNeedsAttention } from "@/lib/dealer-base-role-views";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ManagerHeatLevel } from "@/lib/manager-load-heat";
import type { ManagerRowModel } from "@/lib/dealer-base-management-view-model";

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
