/**
 * Feature flags для источника каталога дилеров (Промт 374).
 */

export function useDbDealers(): boolean {
  return process.env.USE_DB_DEALERS === "true";
}

export function shadowDiffEnabled(): boolean {
  return process.env.SHADOW_DIFF_ENABLED === "true";
}
