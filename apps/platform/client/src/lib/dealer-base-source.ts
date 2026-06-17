/**
 * Единый источник каталога клиентов из API (БД).
 * Промт 376, 377.
 */

import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { fetchAllDealers } from "@/lib/dealers-trade-points-api";
import { queryClient } from "@/lib/queryClient";

export const DEALER_BASE_ROWS_QUERY_KEY = ["dealer-base-rows"] as const;

let featureFlagUseDb: boolean | null = null;
let cachedCatalogRows: DealerRow[] | null = null;

export async function shouldUseDbDealers(): Promise<boolean> {
  if (featureFlagUseDb !== null) return featureFlagUseDb;
  try {
    const res = await fetch("/api/config/feature-flags", { credentials: "include" });
    if (!res.ok) {
      featureFlagUseDb = false;
      return false;
    }
    const body = (await res.json()) as { flags?: { USE_DB_DEALERS?: boolean } };
    featureFlagUseDb = body.flags?.USE_DB_DEALERS === true;
  } catch {
    featureFlagUseDb = false;
  }
  return featureFlagUseDb;
}

/** Сброс кэша флага (тесты). */
export function resetDealerBaseSourceCache(): void {
  featureFlagUseDb = null;
  cachedCatalogRows = null;
}

/** Preload из GET /api/bootstrap (Промт 380-safe). */
export function seedFeatureFlagsFromBootstrap(flags: { flags?: { USE_DB_DEALERS?: boolean } }): void {
  if (flags.flags?.USE_DB_DEALERS === true) featureFlagUseDb = true;
  else if (flags.flags?.USE_DB_DEALERS === false) featureFlagUseDb = false;
}

export function setDealerBaseRowsCache(rows: DealerRow[]): void {
  cachedCatalogRows = rows;
}

export async function fetchDealerBaseRows(): Promise<DealerRow[]> {
  if (await shouldUseDbDealers()) {
    try {
      const r = await fetchAllDealers();
      if (r.success && Array.isArray(r.dealers)) {
        setDealerBaseRowsCache(r.dealers);
        return r.dealers;
      }
    } catch {
      /* no hardcode fallback */
    }
  }
  setDealerBaseRowsCache([]);
  return [];
}

export function getCatalogDealerRows(): DealerRow[] {
  const fromQuery = queryClient.getQueryData<DealerRow[]>(DEALER_BASE_ROWS_QUERY_KEY);
  if (fromQuery) return fromQuery;
  if (cachedCatalogRows) return cachedCatalogRows;
  return [];
}

/** @deprecated Prefer getCatalogDealerRows — alias для совместимости с промтом. */
export function getDealerBaseRowsSync(): DealerRow[] {
  return getCatalogDealerRows();
}

export function getCatalogDealerById(rawId: string): DealerRow | undefined {
  const rows = getCatalogDealerRows();
  const t = rawId.trim();
  if (/^\d{1,3}$/.test(t)) {
    const padded = String(parseInt(t, 10)).padStart(3, "0");
    return rows.find((r) => r.id === padded || r.id.endsWith(`-${padded}`));
  }
  return rows.find((r) => r.id === t);
}

export function filterDealerRowsByVisibleCodes(
  rows: DealerRow[],
  codes: string[] | null,
): DealerRow[] {
  if (codes === null) return rows;
  const allow = new Set(codes);
  return rows.filter((r) => r.releaseCode != null && allow.has(r.releaseCode));
}

/** Видимые строки каталога для real-scope (замена buildDealerRowsFromReleaseClients + codes). */
export function getVisibleDealerRows(
  catalogRows: DealerRow[],
  all: boolean,
  codes: string[] | null,
): DealerRow[] {
  if (all || codes === null) return catalogRows;
  return filterDealerRowsByVisibleCodes(catalogRows, codes);
}

export function useDealerBaseRows() {
  return useQuery({
    queryKey: DEALER_BASE_ROWS_QUERY_KEY,
    queryFn: fetchDealerBaseRows,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function invalidateDealerBase(qc: QueryClient = queryClient): void {
  featureFlagUseDb = null;
  void qc.invalidateQueries({ queryKey: [...DEALER_BASE_ROWS_QUERY_KEY] });
}
