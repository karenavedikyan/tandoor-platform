/**
 * Feature flags для источника каталога дилеров (Промт 374).
 */

export function useDbDealers(): boolean {
  return process.env.USE_DB_DEALERS === "true";
}

export function shadowDiffEnabled(): boolean {
  return process.env.SHADOW_DIFF_ENABLED === "true";
}

export function useServerKpiAggregates(): boolean {
  return process.env.USE_SERVER_KPI_AGGREGATES === "true";
}

export function useTpHydrationNoWriteback(): boolean {
  return process.env.TP_HYDRATION_NO_WRITEBACK === "true";
}
