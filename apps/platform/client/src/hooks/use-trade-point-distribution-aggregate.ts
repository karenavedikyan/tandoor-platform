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
  /** Матрица витрины из БД ещё не готова — не показывать локальные seed-значения. */
  loading: boolean;
};

/** Агрегат дистрибуции по списку ТТ: installed-модели матрицы + ёмкость из БД. */
export function useTradePointDistributionAggregate(
  tradePointIds: string[],
  act: ActualizationState,
): TradePointDistributionAggregateResult {
  const [matrixCacheBump, setMatrixCacheBump] = useState(0);
  const [matrixPrefetchDone, setMatrixPrefetchDone] = useState(false);
  const lastPrefetchedScopeKeyRef = useRef("");
  const tradePointIdsRef = useRef(tradePointIds);
  const prevTradePointIdsKeyRef = useRef("");

  const tradePointIdsKey = useMemo(() => scopedTradePointIdsStableKey(tradePointIds), [tradePointIds]);
  const scopeTooLarge = tradePointIds.length > DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD;
  const dbPrimary = getDistributionDbPrimaryFlagSync();

  if (prevTradePointIdsKeyRef.current !== tradePointIdsKey) {
    prevTradePointIdsKeyRef.current = tradePointIdsKey;
    tradePointIdsRef.current = tradePointIds;
    setMatrixPrefetchDone(false);
  }

  useEffect(() => {
    const onCache = () => setMatrixCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  useEffect(() => {
    if (!dbPrimary || scopeTooLarge || tradePointIdsKey === "") {
      setMatrixPrefetchDone(true);
      return;
    }
    if (hasScopePrefetchCompleted(tradePointIdsKey) && matrixPrefetchDone) return;
    if (lastPrefetchedScopeKeyRef.current === tradePointIdsKey && matrixPrefetchDone) return;

    lastPrefetchedScopeKeyRef.current = tradePointIdsKey;
    markScopePrefetchCompleted(tradePointIdsKey);
    setMatrixPrefetchDone(false);
    const ids = tradePointIdsRef.current;
    if (ids.length === 0) {
      setMatrixPrefetchDone(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      const entries = await fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] });
      if (cancelled) return;
      if (entries != null && entries.length > 0) {
        applyScopeEntriesToMatrixCache(entries);
      }
      setMatrixPrefetchDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [dbPrimary, scopeTooLarge, tradePointIdsKey, matrixPrefetchDone]);

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
      return { aggregate: EMPTY_AGGREGATE, tradePointsCount: 0, loading: false };
    }

    const loading = dbPrimary && !scopeTooLarge && !matrixPrefetchDone;
    if (loading) {
      return { aggregate: EMPTY_AGGREGATE, tradePointsCount: tradePointIds.length, loading: true };
    }

    const shById = act.tradePointShowcaseActualizationById;
    const metrics = tradePointIds.map((tradePointId) =>
      computeDistributionForTradePoint(
        shById[tradePointId],
        installedEntriesByTradePointId[tradePointId] ?? [],
      ),
    );
    const aggregate = aggregateDistribution(metrics);
    return { aggregate, tradePointsCount: aggregate.tradePointsCount, loading: false };
  }, [
    tradePointIds,
    act.tradePointShowcaseActualizationById,
    installedEntriesByTradePointId,
    dbPrimary,
    scopeTooLarge,
    matrixPrefetchDone,
  ]);
}
