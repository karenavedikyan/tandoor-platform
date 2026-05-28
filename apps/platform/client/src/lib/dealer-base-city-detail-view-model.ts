/**
 * Drill-down модель города для управленческого экрана «Клиентская база».
 */

import { dealerNeedsAttention } from "@/lib/dealer-base-role-views";
import {
  buildCityModels,
  catalogManagerIdFromUserRef,
  resolveDealerRowTeamId,
  type ResponsibleByCodeMap,
} from "@/lib/dealer-base-management-view-model";
import {
  buildDealerRowSegments,
  buildReleaseClientByCodeMap,
  dealerRowMatchesSegment,
  type CityDetailSegmentKey,
  type DealerBaseSegmentKey,
} from "@/lib/dealer-base-dealer-segment";
import { getDealerManagerDisplay, getDealerRopDisplay, type DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseClientTypeTone } from "@/lib/release-client-data";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";

export type { CityDetailSegmentKey, DealerBaseSegmentKey };

export type CityDetailModel = {
  cityKey: string;
  displayName: string;
  dealerRows: DealerRow[];
  kpis: {
    activeClients: number;
    tradePoints: number;
    potential: number;
    attention: number;
  };
  segments: Array<{
    key: CityDetailSegmentKey;
    label: string;
    count: number;
    tone: ReleaseClientTypeTone;
  }>;
  byManager: Array<{
    managerCatalogId: string;
    managerName: string;
    teamId?: string;
    ropName?: string;
    activeClients: number;
    tradePoints: number;
    rows: DealerRow[];
  }>;
};

export {
  resolveDealerRowSegmentKey,
  resolveDealerRowSegmentKey as resolveCityRowSegmentKey,
} from "@/lib/dealer-base-dealer-segment";

/** Catalog manager id для строки — та же логика, что в `buildCityByManager`. */
export function resolveDealerRowManagerCatalogId(row: DealerRow): string {
  const managerName = getDealerManagerDisplay(row);
  return row.releaseManagerId ? catalogManagerIdFromUserRef(row.releaseManagerId) : `name:${managerName}`;
}

function buildCityByManager(cityRows: DealerRow[]): CityDetailModel["byManager"] {
  const map = new Map<
    string,
    {
      managerCatalogId: string;
      managerName: string;
      teamId?: string;
      ropName?: string;
      rows: DealerRow[];
    }
  >();

  for (const row of cityRows) {
    const managerName = getDealerManagerDisplay(row);
    const managerCatalogId = resolveDealerRowManagerCatalogId(row);
    const groupKey = `${managerCatalogId}::${managerName}`;
    let group = map.get(groupKey);
    if (!group) {
      group = {
        managerCatalogId,
        managerName,
        teamId: resolveDealerRowTeamId(row),
        ropName: getDealerRopDisplay(row) || undefined,
        rows: [],
      };
      map.set(groupKey, group);
    }
    group.rows.push(row);
  }

  return Array.from(map.values())
    .map((g) => ({
      managerCatalogId: g.managerCatalogId,
      managerName: g.managerName,
      teamId: g.teamId,
      ropName: g.ropName,
      activeClients: g.rows.filter((r) => r.status === "активный").length,
      tradePoints: g.rows.reduce((sum, r) => sum + r.outlets, 0),
      rows: g.rows,
    }))
    .sort(
      (a, b) =>
        b.activeClients - a.activeClients ||
        a.managerName.localeCompare(b.managerName, "ru"),
    );
}

export function buildCityDetailModel(
  cityKey: string,
  allDealerRows: DealerRow[],
  _options?: { orgSnap?: OrgSnapshot | null; responsibleByCode?: ResponsibleByCodeMap },
): CityDetailModel | null {
  void _options;
  const cities = buildCityModels(allDealerRows);
  const city = cities.find((c) => c.cityKey === cityKey);
  if (!city) return null;

  const cityRows = city.dealerRows;
  const activeClients = cityRows.filter((r) => r.status === "активный").length;
  const tradePoints = cityRows.reduce((sum, r) => sum + r.outlets, 0);
  const potential = cityRows.filter((r) => r.status === "потенциальный").length;
  const attention = cityRows.filter((r) => dealerNeedsAttention(r)).length;

  return {
    cityKey: city.cityKey,
    displayName: city.displayName,
    dealerRows: cityRows,
    kpis: { activeClients, tradePoints, potential, attention },
    segments: buildDealerRowSegments(cityRows),
    byManager: buildCityByManager(cityRows),
  };
}

export function cityDetailRowMatchesSegment(
  row: DealerRow,
  segment: CityDetailSegmentKey | null,
  releaseByCode?: Map<string, import("@/lib/release-client-data").ReleaseClient>,
): boolean {
  return dealerRowMatchesSegment(row, segment, releaseByCode);
}
