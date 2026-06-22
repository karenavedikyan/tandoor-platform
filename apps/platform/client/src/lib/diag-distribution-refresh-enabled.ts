import { useHashQuery } from "@/lib/hash-location-router";

/** Диагностика включается только при ?diag=1 в hash-query. */
export function useDistributionRefreshDiagEnabled(): boolean {
  const qs = useHashQuery();
  return qs.get("diag") === "1";
}
