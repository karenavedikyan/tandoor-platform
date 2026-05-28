/**
 * Drill-down модель города для управленческого экрана «Клиентская база».
 */

import { isClientTopTier, type ClientCategoryId } from "@/lib/client-category";
import { dealerNeedsAttention } from "@/lib/dealer-base-role-views";
import {
  buildCityModels,
  catalogManagerIdFromUserRef,
  resolveDealerRowTeamId,
  type ResponsibleByCodeMap,
} from "@/lib/dealer-base-management-view-model";
import { getDealerManagerDisplay, getDealerRopDisplay, type DealerRow } from "@/lib/dealer-base-mock-data";
import {
  getReleaseClients,
  getReleaseClientTypeLabel,
  getReleaseClientTypeTone,
  type ReleaseClient,
  type ReleaseClientTypeTone,
} from "@/lib/release-client-data";
import type { ReleaseClientNormalizedType } from "@/lib/release-client-seed.generated";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";

export type CityDetailSegmentKey =
  | ReleaseClientNormalizedType
  | "active"
  | "potential"
  | "attention"
  | "no_segment";

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

const SEGMENT_DISPLAY_ORDER: CityDetailSegmentKey[] = [
  "volume",
  "top150",
  "top350",
  "top500",
  "active",
  "potential",
  "attention",
  "closed",
  "nonTarget",
  "no_segment",
];

function categoryToSegmentKey(cat: ClientCategoryId): CityDetailSegmentKey | null {
  if (cat === "top150") return "top150";
  if (cat === "top350") return "top350";
  if (cat === "top500" || cat === "top500plus") return cat === "top500plus" ? "volume" : "top500";
  if (cat === "potential") return "potential";
  return null;
}

function buildReleaseClientByCode(): Map<string, ReleaseClient> {
  const map = new Map<string, ReleaseClient>();
  for (const c of getReleaseClients()) {
    const code = c.code?.trim();
    if (code) map.set(code, c);
  }
  return map;
}

export function resolveCityRowSegmentKey(
  row: DealerRow,
  releaseByCode: Map<string, ReleaseClient>,
): CityDetailSegmentKey {
  if (dealerNeedsAttention(row)) return "attention";

  const code = row.releaseCode?.trim();
  if (code) {
    const rc = releaseByCode.get(code);
    if (rc && rc.normalizedClientType !== "unknown") {
      const nt = rc.normalizedClientType;
      if (
        nt === "volume" ||
        nt === "top150" ||
        nt === "top350" ||
        nt === "top500" ||
        nt === "potential" ||
        nt === "active" ||
        nt === "closed" ||
        nt === "nonTarget"
      ) {
        return nt;
      }
    }
  }

  if (isClientTopTier(row.clientCategory)) {
    const fromCat = categoryToSegmentKey(row.clientCategory);
    if (fromCat) return fromCat;
  }

  if (row.status === "потенциальный") return "potential";
  if (row.status === "активный") return "active";
  return "no_segment";
}

function segmentLabel(key: CityDetailSegmentKey): string {
  if (key === "attention") return "Внимание";
  if (key === "active") return "Активные";
  if (key === "potential") return "Потенциальные";
  if (key === "no_segment") return "Без сегмента";
  return getReleaseClientTypeLabel(key);
}

function segmentTone(key: CityDetailSegmentKey): ReleaseClientTypeTone {
  if (key === "attention") return "destructive";
  if (key === "active") return "secondary";
  if (key === "potential") return "outline";
  if (key === "no_segment") return "outline";
  return getReleaseClientTypeTone(key);
}

function buildCitySegments(cityRows: DealerRow[]): CityDetailModel["segments"] {
  const releaseByCode = buildReleaseClientByCode();
  const counts = new Map<CityDetailSegmentKey, number>();
  for (const row of cityRows) {
    const key = resolveCityRowSegmentKey(row, releaseByCode);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return SEGMENT_DISPLAY_ORDER.filter((key) => (counts.get(key) ?? 0) > 0).map((key) => ({
    key,
    label: segmentLabel(key),
    count: counts.get(key) ?? 0,
    tone: segmentTone(key),
  }));
}

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
    segments: buildCitySegments(cityRows),
    byManager: buildCityByManager(cityRows),
  };
}

export function cityDetailRowMatchesSegment(
  row: DealerRow,
  segment: CityDetailSegmentKey | null,
  releaseByCode?: Map<string, ReleaseClient>,
): boolean {
  if (!segment) return true;
  const map = releaseByCode ?? buildReleaseClientByCode();
  return resolveCityRowSegmentKey(row, map) === segment;
}
