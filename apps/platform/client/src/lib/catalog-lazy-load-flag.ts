/**
 * Feature flag CATALOG_LAZY_LOAD (Промт 4).
 * При включении seed каталога грузится динамически, не на critical path dealer-base.
 */

let cached: boolean | null = null;

export function resetCatalogLazyLoadFlagCache(): void {
  cached = null;
}

export function seedCatalogLazyLoadFromBootstrap(
  flags: { flags?: { CATALOG_LAZY_LOAD?: boolean } },
): void {
  if (flags.flags?.CATALOG_LAZY_LOAD === true) cached = true;
  else if (flags.flags?.CATALOG_LAZY_LOAD === false) cached = false;
}

export async function shouldUseCatalogLazyLoad(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const res = await fetch("/api/config/feature-flags", { credentials: "include" });
    if (!res.ok) {
      cached = false;
      return false;
    }
    const body = (await res.json()) as { flags?: { CATALOG_LAZY_LOAD?: boolean } };
    cached = body.flags?.CATALOG_LAZY_LOAD === true;
  } catch {
    cached = false;
  }
  return cached;
}

export function isCatalogLazyLoadEnabled(): boolean {
  return cached === true;
}
