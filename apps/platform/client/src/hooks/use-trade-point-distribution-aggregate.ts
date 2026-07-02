import { useEffect, useMemo, useRef, useState } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import {
  aggregateDistribution,
  computeDistributionForTradePoint,
  type DistributionGroupMetrics,
} from "@/lib/distribution-analytics/distribution-analytics-math";
import { DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD } from "@/lib/distribution-analytics/distribution-analytics-filters";
import { getDistributionDbPrimaryFlagSync } from "@/lib/distribution-db-primary-flag";
import { scopedTradePointIdsStableKey } from "@/lib/distribution-entry-tradepoint-view-model";
import { fetchShowcaseMatrixScope } from "@/lib/showcase-matrix-api";
import {
  hasScopePrefetchCompleted,
  markScopePrefetchCompleted,
} from "@/lib/distribution-scope-prefetch-guard";
import {
  applyScopeEntriesToMatrixCache,
  loadCachedMatrix,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";

const EMPTY_AGGREGATE: DistributionGroupMetrics = {
  byType: {
    entrance: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
    interior: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
    hardware: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
  },
  averagePercent: null,
  rotationPotentialPercent: null,
  totalLegacyOurs: 0,
  tradePointsCount: 0,
};

export type TradePointDistributionAggregateResult = {
  aggregate: DistributionGroupMetrics;
  tradePointsCount: number;
  /** true только при холодной загрузке: кэша матрицы нет и префетч ещё не завершён. */
  loading: boolean;
  /** Фоновая ревалидация поверх уже показанных данных (SWR). */
  revalidating?: boolean;
};

export type UseTradePointDistributionAggregateOptions = {
  /** Внешний оркестратор наполняет кэш — внутренний монолитный префетч не запускать. */
  skipInternalPrefetch?: boolean;
  /** Пока внешний оркестратор грузит бакеты (порции по РОПам). */
  externalPrefetching?: boolean;
};

/** Есть ли в клиентском кэше хотя бы одна запись матрицы по scope ТТ. */
export function hasMatrixCacheForTradePointIds(tradePointIds: readonly string[]): boolean {
  for (const id of tradePointIds) {
    if (loadCachedMatrix(id).length > 0) return true;
  }
  return false;
}

function lookupShowcaseRecord(
  shById: ActualizationState["tradePointShowcaseActualizationById"],
  matrixKey: string,
  showcaseUuidByMatrixKey?: ReadonlyMap<string, string>,
) {
  const direct = shById[matrixKey];
  if (direct) return direct;
  const uuid = showcaseUuidByMatrixKey?.get(matrixKey);
  if (uuid) return shById[uuid];
  return undefined;
}

function computeAggregateFromInstalledEntries(
  tradePointIds: string[],
  act: ActualizationState,
  installedEntriesByTradePointId: Record<string, ReturnType<typeof loadCachedMatrix>>,
  showcaseUuidByMatrixKey?: ReadonlyMap<string, string>,
): DistributionGroupMetrics {
  const shById = act.tradePointShowcaseActualizationById;
  const metrics = tradePointIds.map((tradePointId) =>
    computeDistributionForTradePoint(
      lookupShowcaseRecord(shById, tradePointId, showcaseUuidByMatrixKey),
      installedEntriesByTradePointId[tradePointId] ?? [],
    ),
  );
  return aggregateDistribution(metrics);
}

/** Агрегат дистрибуции по списку ТТ: installed-модели матрицы + ёмкость из БД. */
export function useTradePointDistributionAggregate(
  tradePointIds: string[],
  act: ActualizationState,
  showcaseUuidByMatrixKey?: ReadonlyMap<string, string>,
  options?: UseTradePointDistributionAggregateOptions,
): TradePointDistributionAggregateResult {
  const skipInternalPrefetch = options?.skipInternalPrefetch === true;
  const externalPrefetching = options?.externalPrefetching === true;
  const [matrixCacheBump, setMatrixCacheBump] = useState(0);
  const [matrixPrefetchDone, setMatrixPrefetchDone] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const lastPrefetchedScopeKeyRef = useRef("");
  const tradePointIdsRef = useRef(tradePointIds);
  const prevTradePointIdsKeyRef = useRef("");

  const tradePointIdsKey = useMemo(() => scopedTradePointIdsStableKey(tradePointIds), [tradePointIds]);
  const scopeTooLarge = tradePointIds.length > DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD;
  const dbPrimary = getDistributionDbPrimaryFlagSync();

  if (prevTradePointIdsKeyRef.current !== tradePointIdsKey) {
    prevTradePointIdsKeyRef.current = tradePointIdsKey;
    tradePointIdsRef.current = tradePointIds;
    const hasCache = hasMatrixCacheForTradePointIds(tradePointIds);
    setMatrixPrefetchDone(hasCache);
    setRevalidating(false);
  }

  useEffect(() => {
    const onCache = () => setMatrixCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  useEffect(() => {
    if (skipInternalPrefetch) {
      return;
    }
    if (!dbPrimary || scopeTooLarge || tradePointIdsKey === "") {
      setMatrixPrefetchDone(true);
      setRevalidating(false);
      return;
    }
    if (hasScopePrefetchCompleted(tradePointIdsKey) && matrixPrefetchDone) return;
    if (lastPrefetchedScopeKeyRef.current === tradePointIdsKey && matrixPrefetchDone) return;

    const ids = tradePointIdsRef.current;
    if (ids.length === 0) {
      setMatrixPrefetchDone(true);
      setRevalidating(false);
      return;
    }

    const hasCache = hasMatrixCacheForTradePointIds(ids);
    lastPrefetchedScopeKeyRef.current = tradePointIdsKey;
    markScopePrefetchCompleted(tradePointIdsKey);
    if (hasCache) {
      setRevalidating(true);
    } else {
      setMatrixPrefetchDone(false);
      setRevalidating(false);
    }

    let cancelled = false;
    void (async () => {
      const entries = await fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] });
      if (cancelled) return;
      if (entries != null && entries.length > 0) {
        applyScopeEntriesToMatrixCache(entries);
      }
      setMatrixPrefetchDone(true);
      setRevalidating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [dbPrimary, scopeTooLarge, tradePointIdsKey, matrixPrefetchDone, skipInternalPrefetch]);

  useEffect(() => {
    if (!skipInternalPrefetch) return;
    const ids = tradePointIdsRef.current;
    if (ids.length === 0) {
      setMatrixPrefetchDone(true);
      setRevalidating(false);
      return;
    }
    if (hasMatrixCacheForTradePointIds(ids)) {
      setMatrixPrefetchDone(true);
    }
    if (!externalPrefetching) {
      setRevalidating(false);
    }
  }, [skipInternalPrefetch, externalPrefetching, tradePointIdsKey, matrixCacheBump]);

  const installedEntriesByTradePointId = useMemo(() => {
    void matrixCacheBump;
    const map: Record<string, ReturnType<typeof loadCachedMatrix>> = {};
    for (const id of tradePointIds) {
      map[id] = loadCachedMatrix(id);
    }
    return map;
  }, [tradePointIds, matrixCacheBump]);

  return useMemo(() => {
    if (tradePointIds.length === 0) {
      return { aggregate: EMPTY_AGGREGATE, tradePointsCount: 0, loading: false, revalidating: false };
    }

    const hasCache = hasMatrixCacheForTradePointIds(tradePointIds);
    const coldLoading =
      dbPrimary &&
      !scopeTooLarge &&
      !hasCache &&
      (skipInternalPrefetch ? externalPrefetching : !matrixPrefetchDone);
    const aggregate = computeAggregateFromInstalledEntries(
      tradePointIds,
      act,
      installedEntriesByTradePointId,
      showcaseUuidByMatrixKey,
    );

    if (coldLoading) {
      return {
        aggregate: EMPTY_AGGREGATE,
        tradePointsCount: tradePointIds.length,
        loading: true,
        revalidating: false,
      };
    }

    return {
      aggregate,
      tradePointsCount: aggregate.tradePointsCount,
      loading: false,
      revalidating:
        (revalidating && dbPrimary && !scopeTooLarge) ||
        (skipInternalPrefetch && externalPrefetching && hasCache && dbPrimary && !scopeTooLarge),
    };
  }, [
    tradePointIds,
    act,
    installedEntriesByTradePointId,
    dbPrimary,
    scopeTooLarge,
    matrixPrefetchDone,
    revalidating,
    showcaseUuidByMatrixKey,
    skipInternalPrefetch,
    externalPrefetching,
  ]);
}
