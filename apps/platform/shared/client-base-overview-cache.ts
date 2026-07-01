/**
 * In-memory кэш агрегатов client-base-overview и trade-points-overview (60 сек).
 */

const TTL_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  body: unknown;
};

const overviewCache = new Map<string, CacheEntry>();
const tradePointsOverviewCache = new Map<string, CacheEntry>();

function getCached<T>(store: Map<string, CacheEntry>, key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.body as T;
}

function setCached(store: Map<string, CacheEntry>, key: string, body: unknown): void {
  store.set(key, { expiresAt: Date.now() + TTL_MS, body });
}

export function clientBaseOverviewCacheKey(
  role: string,
  userId: string,
  teamIdFilter: string | null,
  managerFilter: string | null,
): string {
  return [role, userId, teamIdFilter ?? "", managerFilter ?? ""].join(":");
}

export function tradePointsOverviewCacheKey(role: string, userId: string): string {
  return [role, userId].join(":");
}

export function getClientBaseOverviewCached<T>(key: string): T | null {
  return getCached<T>(overviewCache, key);
}

export function setClientBaseOverviewCached(key: string, body: unknown): void {
  setCached(overviewCache, key, body);
}

export function getTradePointsOverviewCached<T>(key: string): T | null {
  return getCached<T>(tradePointsOverviewCache, key);
}

export function setTradePointsOverviewCached(key: string, body: unknown): void {
  setCached(tradePointsOverviewCache, key, body);
}

/** Сброс кэша (тесты). */
export function resetClientBaseOverviewCaches(): void {
  overviewCache.clear();
  tradePointsOverviewCache.clear();
}
