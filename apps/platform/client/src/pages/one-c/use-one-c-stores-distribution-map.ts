import { useEffect, useMemo, useState } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import {
  computeDistributionForTradePoint,
  type DistributionTradePointMetrics,
} from "@/lib/distribution-analytics/distribution-analytics-math";
import { useTradePointDistributionAggregate } from "@/hooks/use-trade-point-distribution-aggregate";
import { setShowcaseMatrixApiBase, resetShowcaseMatrixApiBase } from "@/lib/showcase-matrix-api";
import { loadCachedMatrix, refreshMatrixFromServer, SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";

export function useOneCStoresDistributionMap(
  items: OneCStoreListItem[],
  act: ActualizationState,
  options?: { enabled?: boolean },
): { map: Map<string, DistributionTradePointMetrics>; loading: boolean } {
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    setShowcaseMatrixApiBase("/api/one-c/showcase-matrix");
    return () => resetShowcaseMatrixApiBase();
  }, [enabled]);

  const ids = useMemo(
    () => (enabled ? items.map((item) => item.id_1c) : []),
    [items, enabled],
  );
  const { loading } = useTradePointDistributionAggregate(ids, act);
  const [cacheBump, setCacheBump] = useState(0);

  useEffect(() => {
    const onCache = () => setCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      for (const id of ids) {
        if (cancelled) return;
        await refreshMatrixFromServer(id).catch(() => null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids, enabled]);

  const map = useMemo(() => {
    void cacheBump;
    const next = new Map<string, DistributionTradePointMetrics>();
    for (const item of items) {
      next.set(
        item.id_1c,
        computeDistributionForTradePoint(
          act.tradePointShowcaseActualizationById[item.id_1c],
          loadCachedMatrix(item.id_1c),
        ),
      );
    }
    return next;
  }, [items, act, cacheBump]);

  return { map, loading };
}
