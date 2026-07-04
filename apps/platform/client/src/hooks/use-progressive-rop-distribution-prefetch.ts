import { useEffect, useMemo, useRef, useState } from "react";
import { buildTradePointExternalKeysByRopFromScopedDb } from "@/lib/trade-points-scoped-ids";
import { scopedTradePointIdsStableKey } from "@/lib/distribution-entry-tradepoint-view-model";
import { fetchShowcaseMatrixScope } from "@/lib/showcase-matrix-api";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import { applyScopeEntriesToMatrixCache } from "@/lib/showcase-matrix-store";
import type { ScopedTradePointDto } from "@/lib/trade-points-scoped-api";

export const BUCKET_TIMEOUT_MS = 25_000;

async function fetchBucketWithTimeout(externalKeys: string[]): Promise<ShowcaseMatrixEntryDto[] | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetchShowcaseMatrixScope({ tradePointIds: externalKeys, statuses: ["installed"] }),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), BUCKET_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export type ProgressiveRopDistributionPrefetchState = {
  /** Идёт последовательная загрузка бакетов по РОПам. */
  prefetching: boolean;
  loadedBuckets: number;
  totalBuckets: number;
};

/**
 * Последовательно наполняет глобальный кэш матрицы по бакетам РОПов.
 * После каждого бакета — applyScopeEntriesToMatrixCache → SHOWCASE_MATRIX_STORE_CHANGED_EVENT.
 */
export function useProgressiveRopDistributionPrefetch(
  tradePoints: readonly ScopedTradePointDto[] | undefined,
  enabled: boolean,
): ProgressiveRopDistributionPrefetchState {
  const buckets = useMemo(
    () => (tradePoints?.length ? buildTradePointExternalKeysByRopFromScopedDb(tradePoints) : []),
    [tradePoints],
  );
  const scopeKey = useMemo(
    () => scopedTradePointIdsStableKey(buckets.flatMap((bucket) => bucket.externalKeys)),
    [buckets],
  );

  const [loadedBuckets, setLoadedBuckets] = useState(0);
  const [prefetching, setPrefetching] = useState(false);
  const runIdRef = useRef(0);
  const lastScopeKeyRef = useRef("");

  useEffect(() => {
    if (!enabled || buckets.length === 0) {
      setPrefetching(false);
      setLoadedBuckets(0);
      return;
    }

    if (lastScopeKeyRef.current !== scopeKey) {
      lastScopeKeyRef.current = scopeKey;
      setLoadedBuckets(0);
    }

    const runId = ++runIdRef.current;
    setPrefetching(true);

    void (async () => {
      let loaded = 0;
      for (const bucket of buckets) {
        if (runIdRef.current !== runId) return;
        if (bucket.externalKeys.length > 0) {
          const entries = await fetchBucketWithTimeout(bucket.externalKeys);
          if (runIdRef.current !== runId) return;
          if (entries != null && entries.length > 0) {
            applyScopeEntriesToMatrixCache(entries);
          }
        }
        loaded += 1;
        setLoadedBuckets(loaded);
      }
      if (runIdRef.current === runId) {
        setPrefetching(false);
      }
    })();

    return () => {
      runIdRef.current += 1;
    };
  }, [enabled, scopeKey, buckets]);

  return {
    prefetching,
    loadedBuckets,
    totalBuckets: buckets.length,
  };
}
