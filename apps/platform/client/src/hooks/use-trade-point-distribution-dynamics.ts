import { useEffect, useMemo, useRef, useState } from "react";
import {
  aggregateSnapshotByTypeMaps,
  computeDistributionDeltaByType,
  computeSinceDateUtc,
  type DistributionSnapshotByTypeNumbers,
} from "@/lib/distribution-snapshot-aggregate";
import { scopedTradePointIdsStableKey } from "@/lib/distribution-entry-tradepoint-view-model";
import type { EquipmentTypeKey } from "@/lib/distribution-analytics/distribution-analytics-math";

export type DistributionPeriodDays = 7 | 30 | 90;

type SnapshotRangeResponse = {
  success: boolean;
  baselineByTradePointId?: Record<string, DistributionSnapshotByTypeNumbers>;
  currentByTradePointId?: Record<string, DistributionSnapshotByTypeNumbers>;
};

const EMPTY_DELTA: Record<EquipmentTypeKey, number | null> = {
  entrance: null,
  interior: null,
  hardware: null,
};

export function useTradePointDistributionDynamics(
  tradePointIds: string[],
  periodDays: DistributionPeriodDays,
): {
  loading: boolean;
  deltaByType: Record<EquipmentTypeKey, number | null>;
} {
  const [loading, setLoading] = useState(false);
  const [deltaByType, setDeltaByType] = useState(EMPTY_DELTA);
  const lastFetchKeyRef = useRef("");

  const tradePointIdsKey = useMemo(() => scopedTradePointIdsStableKey(tradePointIds), [tradePointIds]);
  const sinceDate = useMemo(() => computeSinceDateUtc(periodDays), [periodDays]);
  const fetchKey = `${tradePointIdsKey}|${periodDays}|${sinceDate}`;

  useEffect(() => {
    if (tradePointIds.length === 0) {
      setDeltaByType(EMPTY_DELTA);
      setLoading(false);
      lastFetchKeyRef.current = "";
      return;
    }

    if (lastFetchKeyRef.current === fetchKey) return;

    let cancelled = false;
    const keyForRun = fetchKey;
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch("/api/showcase-matrix/snapshot-range", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tradePointIds, sinceDate }),
          cache: "no-store",
        });
        const data = (await res.json()) as SnapshotRangeResponse;
        if (cancelled) return;

        if (!res.ok || !data.success) {
          setDeltaByType(EMPTY_DELTA);
          return;
        }

        const currentAgg = aggregateSnapshotByTypeMaps(
          tradePointIds,
          data.currentByTradePointId ?? {},
        );
        const baselineAgg = aggregateSnapshotByTypeMaps(
          tradePointIds,
          data.baselineByTradePointId ?? {},
        );
        setDeltaByType(computeDistributionDeltaByType(currentAgg, baselineAgg));
      } catch {
        if (!cancelled) setDeltaByType(EMPTY_DELTA);
      } finally {
        if (!cancelled) {
          lastFetchKeyRef.current = keyForRun;
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchKey, sinceDate, tradePointIds, tradePointIdsKey, periodDays]);

  return { loading, deltaByType };
}
