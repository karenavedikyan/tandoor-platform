import { useEffect, useMemo, useRef, useState } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import {
  aggregateDistribution,
  computeDistributionForTradePoint,
  type DistributionGroupMetrics,
} from "@/lib/distribution-analytics/distribution-analytics-math";
import { DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD } from "@/lib/distribution-analytics/distribution-analytics-filters";
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
    entrance: { capacity: 0, tandoorOnShelf: 0, percent: null },
    interior: { capacity: 0, tandoorOnShelf: 0, percent: null },
    hardware: { capacity: 0, tandoorOnShelf: 0, percent: null },
  },
  averagePercent: null,
  tradePointsCount: 0,
};

/** Агрегат дистрибуции по списку ТТ: installed-модели матрицы + ёмкость из актуализации. */
export function useTradePointDistributionAggregate(
  tradePointIds: string[],
  act: ActualizationState,
): { aggregate: DistributionGroupMetrics; tradePointsCount: number } {
  const [matrixCacheBump, setMatrixCacheBump] = useState(0);
  const lastPrefetchedScopeKeyRef = useRef("");
  const tradePointIdsRef = useRef(tradePointIds);
  const prevTradePointIdsKeyRef = useRef("");

  const tradePointIdsKey = useMemo(() => scopedTradePointIdsStableKey(tradePointIds), [tradePointIds]);
  const scopeTooLarge = tradePointIds.length > DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD;

  if (prevTradePointIdsKeyRef.current !== tradePointIdsKey) {
    prevTradePointIdsKeyRef.current = tradePointIdsKey;
    tradePointIdsRef.current = tradePointIds;
  }

  useEffect(() => {
    const onCache = () => setMatrixCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  useEffect(() => {
    if (scopeTooLarge || tradePointIdsKey === "") return;
    if (hasScopePrefetchCompleted(tradePointIdsKey)) return;
    if (lastPrefetchedScopeKeyRef.current === tradePointIdsKey) return;

    lastPrefetchedScopeKeyRef.current = tradePointIdsKey;
    markScopePrefetchCompleted(tradePointIdsKey);
    const ids = tradePointIdsRef.current;
    if (ids.length === 0) return;

    void (async () => {
      const entries = await fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] });
      if (entries != null && entries.length > 0) {
        applyScopeEntriesToMatrixCache(entries);
      }
    })();
  }, [scopeTooLarge, tradePointIdsKey]);

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
      return { aggregate: EMPTY_AGGREGATE, tradePointsCount: 0 };
    }

    const shById = act.tradePointShowcaseActualizationById;
    const metrics = tradePointIds.map((tradePointId) =>
      computeDistributionForTradePoint(
        shById[tradePointId],
        installedEntriesByTradePointId[tradePointId] ?? [],
      ),
    );
    const aggregate = aggregateDistribution(metrics);
    return { aggregate, tradePointsCount: aggregate.tradePointsCount };
  }, [tradePointIds, act.tradePointShowcaseActualizationById, installedEntriesByTradePointId]);
}
