/**
 * In-memory кэш и дедупликация in-flight для team actualization fetch (вкладка).
 */

const TEAM_ACTUALIZATION_CACHE_TTL_MS = 15_000;

type CacheEntry<T> = {
  promise: Promise<T>;
  ts: number;
  result?: T;
};

const teamActualizationCache = new Map<string, CacheEntry<unknown>>();

export function invalidateTeamActualizationCache(): void {
  teamActualizationCache.clear();
}

export function getTeamActualizationCacheKey(dashboardRopTeamId: string, userIds: readonly string[]): string {
  return `${dashboardRopTeamId}::${userIds.slice().sort().join(",")}`;
}

/**
 * Кэш свежих результатов (TTL) и дедупликация параллельных запросов с тем же ключом.
 */
export async function runWithTeamActualizationCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const existing = teamActualizationCache.get(key) as CacheEntry<T> | undefined;
  if (existing) {
    if (existing.result && now - existing.ts < TEAM_ACTUALIZATION_CACHE_TTL_MS) {
      return existing.result;
    }
    if (!existing.result) {
      return existing.promise;
    }
  }

  const promise = fetcher().then((result) => {
    teamActualizationCache.set(key, { promise, ts: Date.now(), result });
    return result;
  });
  teamActualizationCache.set(key, { promise, ts: now });
  return promise;
}

/** @internal Тесты: сброс и чтение кэша. */
export function __testOnlyTeamActualizationCache(): {
  clear: () => void;
  size: () => number;
} {
  return {
    clear: () => teamActualizationCache.clear(),
    size: () => teamActualizationCache.size,
  };
}
