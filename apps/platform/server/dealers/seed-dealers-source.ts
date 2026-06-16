/**
 * Загрузка каталога из TS-seed (canonical для UI, Промт 374).
 */

import {
  buildDealerRowsFromReleaseClients,
  type DealerRow,
} from "../../client/src/lib/dealer-base-mock-data.js";
import { getReleaseClients, type ReleaseClient } from "../../client/src/lib/release-client-data.js";
import type { DealersTradePointsSearchFilters } from "../../shared/dealers-trade-points-handlers.js";

let cachedRows: DealerRow[] | null = null;
let cachedReleaseById: Map<string, ReleaseClient> | null = null;

export function loadSeedDealerRows(): DealerRow[] {
  if (!cachedRows) {
    cachedRows = buildDealerRowsFromReleaseClients(getReleaseClients());
  }
  return cachedRows;
}

export function loadReleaseClientById(): Map<string, ReleaseClient> {
  if (!cachedReleaseById) {
    cachedReleaseById = new Map(getReleaseClients().map((c) => [c.id, c]));
  }
  return cachedReleaseById;
}

/** Сброс кэша (тесты). */
export function resetSeedDealerCache(): void {
  cachedRows = null;
  cachedReleaseById = null;
}

function normQ(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesQuery(row: DealerRow, q: string): boolean {
  if (!q) return true;
  const hay = [
    row.name,
    row.city,
    row.releaseCode ?? "",
    row.id,
    row.manager,
    row.region,
    row.ropName,
    row.clientTypeLabel ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function filterSeedDealerRows(
  rows: DealerRow[],
  filters: DealersTradePointsSearchFilters,
): DealerRow[] {
  const releaseById = loadReleaseClientById();
  const q = normQ(filters.query ?? "");
  const teamId = filters.teamId && filters.teamId !== "all" ? filters.teamId : undefined;
  const managerId = filters.managerId && filters.managerId !== "all" ? filters.managerId : undefined;
  const cities = filters.cities && filters.cities.length > 0 ? new Set(filters.cities) : null;
  const city = !cities && filters.city && filters.city !== "all" ? filters.city : undefined;
  const categories =
    filters.clientCategories && filters.clientCategories.length > 0
      ? new Set(filters.clientCategories)
      : null;
  const clientCategory =
    !categories && filters.clientCategory && filters.clientCategory !== "all"
      ? filters.clientCategory
      : undefined;
  const clientType = filters.clientType && filters.clientType !== "all" ? filters.clientType : undefined;
  const priorityOnly = filters.priorityOnly === true;
  const activeOnly = filters.activeOnly === true;
  const includeClosed = filters.includeClosed === true;

  return rows.filter((row) => {
    const rc = releaseById.get(row.id);
    if (!matchesQuery(row, q)) return false;
    if (teamId && row.releaseTeamId !== teamId) return false;
    if (managerId && row.releaseManagerId !== managerId) return false;
    if (cities && !cities.has(row.city ?? "")) return false;
    if (city && row.city !== city) return false;
    if (categories && !categories.has(row.clientCategory)) return false;
    if (clientCategory && row.clientCategory !== clientCategory) return false;
    if (!clientCategory && !categories && clientType && rc?.normalizedClientType !== clientType) return false;
    if (priorityOnly && !rc?.isPriority) return false;
    if (activeOnly && !rc?.isActive) return false;
    if (!includeClosed && rc?.isClosed) return false;
    return true;
  });
}

export function summarizeSeedDealerRows(rows: DealerRow[]): {
  total: number;
  active: number;
  priority: number;
  closed: number;
  unknownType: number;
} {
  const releaseById = loadReleaseClientById();
  let active = 0;
  let priority = 0;
  let closed = 0;
  let unknownType = 0;
  for (const row of rows) {
    const rc = releaseById.get(row.id);
    if (rc?.isActive) active += 1;
    if (rc?.isPriority) priority += 1;
    if (rc?.isClosed) closed += 1;
    if (rc?.normalizedClientType === "unknown") unknownType += 1;
  }
  return { total: rows.length, active, priority, closed, unknownType };
}
