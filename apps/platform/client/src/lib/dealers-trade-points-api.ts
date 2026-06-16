/**
 * Server-source for dealers and trade points. NOT in use yet.
 * Promt 349 will switch UI to this api via feature flag.
 * See: tandoor-audit-mock-vs-server-347.md
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseClientSearchFilters, ReleaseClientSummary } from "@/lib/release-client-data";

export type DealersTradePointsListResponse = {
  success: true;
  dealers: DealerRow[];
};

export type DealersTradePointsGetResponse = {
  success: true;
  dealer: DealerRow;
};

export type DealersTradePointsSummaryResponse = {
  success: true;
  summary: ReleaseClientSummary;
};

type ApiError = {
  success: false;
  code: string;
  message: string;
};

function buildQuery(filters: ReleaseClientSearchFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.teamId) params.set("teamId", filters.teamId);
  if (filters.managerId) params.set("managerId", filters.managerId);
  if (filters.city) params.set("city", filters.city);
  if (filters.cities?.length) params.set("cities", filters.cities.join(","));
  if (filters.clientType && filters.clientType !== "all") params.set("clientType", filters.clientType);
  if (filters.clientCategory && filters.clientCategory !== "all") {
    params.set("clientCategory", filters.clientCategory);
  }
  if (filters.clientCategories?.length) {
    params.set("clientCategories", filters.clientCategories.join(","));
  }
  if (filters.priorityOnly) params.set("priorityOnly", "true");
  if (filters.activeOnly) params.set("activeOnly", "true");
  if (filters.includeClosed) params.set("includeClosed", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function parseJson<T>(res: Response): Promise<T | ApiError> {
  return (await res.json()) as T | ApiError;
}

/** Список дилеров с вложенными ТТ (форма `DealerRow[]`). */
export async function fetchDealersTradePointsList(
  filters: ReleaseClientSearchFilters = {},
): Promise<DealersTradePointsListResponse | ApiError> {
  const res = await fetch(`/api/dealers-trade-points/list${buildQuery(filters)}`, {
    credentials: "include",
  });
  return parseJson<DealersTradePointsListResponse>(res);
}

/** Один дилер по externalKey (= DealerRow.id). */
export async function fetchDealersTradePointByKey(
  externalKey: string,
): Promise<DealersTradePointsGetResponse | ApiError> {
  const params = new URLSearchParams({ externalKey });
  const res = await fetch(`/api/dealers-trade-points/get?${params}`, {
    credentials: "include",
  });
  return parseJson<DealersTradePointsGetResponse>(res);
}

/** Сводка по скоупу (форма `ReleaseClientSummary`). */
export async function fetchDealersTradePointsSummary(
  filters: ReleaseClientSearchFilters = {},
): Promise<DealersTradePointsSummaryResponse | ApiError> {
  const res = await fetch(`/api/dealers-trade-points/summary${buildQuery(filters)}`, {
    credentials: "include",
  });
  return parseJson<DealersTradePointsSummaryResponse>(res);
}
