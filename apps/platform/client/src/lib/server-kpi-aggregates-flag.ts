/**
 * Feature flag USE_SERVER_KPI_AGGREGATES (Промт 3).
 */

let cached: boolean | null = null;

export function resetServerKpiAggregatesFlagCache(): void {
  cached = null;
}

export function seedServerKpiAggregatesFromBootstrap(flags: { flags?: { USE_SERVER_KPI_AGGREGATES?: boolean } }): void {
  if (flags.flags?.USE_SERVER_KPI_AGGREGATES === true) cached = true;
  else if (flags.flags?.USE_SERVER_KPI_AGGREGATES === false) cached = false;
}

export async function shouldUseServerKpiAggregates(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const res = await fetch("/api/config/feature-flags", { credentials: "include" });
    if (!res.ok) {
      cached = false;
      return false;
    }
    const body = (await res.json()) as { flags?: { USE_SERVER_KPI_AGGREGATES?: boolean } };
    cached = body.flags?.USE_SERVER_KPI_AGGREGATES === true;
  } catch {
    cached = false;
  }
  return cached;
}

export function getServerKpiAggregatesFlagSync(): boolean {
  return cached === true;
}
