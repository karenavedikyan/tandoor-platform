/**
 * Feature flag DISTRIBUTION_DB_PRIMARY_CAPACITY (Промт 2 — дистрибуция).
 * При включении capacity и hasShowcase для расчёта дистрибуции берутся из matrix entries (БД),
 * blob — только fallback.
 */

let cached: boolean | null = null;

export function resetDistributionDbPrimaryFlagCache(): void {
  cached = null;
}

export function seedDistributionDbPrimaryFromBootstrap(
  flags: { flags?: { DISTRIBUTION_DB_PRIMARY_CAPACITY?: boolean } },
): void {
  if (flags.flags?.DISTRIBUTION_DB_PRIMARY_CAPACITY === true) cached = true;
  else if (flags.flags?.DISTRIBUTION_DB_PRIMARY_CAPACITY === false) cached = false;
}

export async function shouldUseDistributionDbPrimary(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const res = await fetch("/api/config/feature-flags", { credentials: "include" });
    if (!res.ok) {
      cached = true;
      return true;
    }
    const body = (await res.json()) as { flags?: { DISTRIBUTION_DB_PRIMARY_CAPACITY?: boolean } };
    cached = body.flags?.DISTRIBUTION_DB_PRIMARY_CAPACITY !== false;
  } catch {
    cached = true;
  }
  return cached;
}

export function getDistributionDbPrimaryFlagSync(): boolean {
  return cached !== false;
}
