/**
 * In-memory кэш ответов team-activity (60 сек, Промт 378).
 */

const TTL_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  body: unknown;
};

const cache = new Map<string, CacheEntry>();

export function teamActivityCacheKey(parts: string[]): string {
  return parts.join(":");
}

export function getTeamActivityCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.body as T;
}

export function setTeamActivityCached(key: string, body: unknown): void {
  cache.set(key, { expiresAt: Date.now() + TTL_MS, body });
}

/** Сброс кэша (тесты). */
export function resetTeamActivityCache(): void {
  cache.clear();
}
