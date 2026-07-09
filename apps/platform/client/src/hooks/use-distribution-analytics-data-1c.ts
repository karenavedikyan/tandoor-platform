import { useEffect, useMemo, useState } from "react";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useOneCScopedStores } from "@/hooks/use-one-c-scoped-stores";
import { useTradePointShowcaseSharedStore } from "@/hooks/use-trade-point-showcase-shared-store";
import type { DistributionAnalyticsFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import {
  DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD,
  hasAnyDistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import {
  buildDistributionAnalyticsDataFromScoped,
  type DistributionAnalyticsData,
} from "@/lib/distribution-analytics/distribution-analytics-view-models";
import { buildOneCAnalyticsTradePointRows } from "@/lib/distribution-analytics/one-c-analytics-trade-point-rows";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import {
  mergeActualizationWithSharedShowcaseStore,
  sharedShowcaseStoreContentKey,
} from "@/lib/trade-point-showcase-shared-merge";
import { loadCachedMatrix, SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";
import { useOneCStoresDistributionMap } from "@/pages/one-c/use-one-c-stores-distribution-map";
import type { DistributionAnalyticsHookResult } from "@/hooks/use-distribution-analytics-data";

const EMPTY_GROUP_AGGREGATE: DistributionAnalyticsData["groupAggregate"] = {
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

const EMPTY_DISTRIBUTION_ANALYTICS_DATA: DistributionAnalyticsData = {
  filteredRows: [],
  tradePointRows: [],
  metricsByTradePointId: {},
  groupAggregate: EMPTY_GROUP_AGGREGATE,
  modelCoverageByModelId: {},
  productRows: [],
  territoryRows: [],
  installedEntriesByTradePointId: {},
};

export function useDistributionAnalyticsData1c(
  filters: DistributionAnalyticsFilters,
): DistributionAnalyticsHookResult {
  const { items, dealers, loading: storesLoading } = useOneCScopedStores();
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const mergedState = managementPlane.mergedState;
  const actBase = actx.enabled ? mergedState : actx.state;
  const [matrixCacheBump, setMatrixCacheBump] = useState(0);

  const scopeTooLarge =
    dealers.length > DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD &&
    !hasAnyDistributionAnalyticsFilters(filters);

  const scopedRows = useMemo(
    () => (scopeTooLarge ? [] : buildOneCAnalyticsTradePointRows(items)),
    [items, scopeTooLarge],
  );

  const tradePointIds = useMemo(() => scopedRows.map((r) => r.tradePointId), [scopedRows]);
  const { recordByTradePointId } = useTradePointShowcaseSharedStore(tradePointIds);

  const actForAnalytics = useMemo(
    () => mergeActualizationWithSharedShowcaseStore(actBase, recordByTradePointId),
    [actBase, recordByTradePointId],
  );

  const actContentKey = useMemo(
    () =>
      [
        actForAnalytics.updatedAt ?? "",
        sharedShowcaseStoreContentKey(recordByTradePointId),
        storesLoading ? "loading" : "ready",
        items.length,
      ].join("|"),
    [actForAnalytics.updatedAt, recordByTradePointId, storesLoading, items.length],
  );

  const { map: metricsMap } = useOneCStoresDistributionMap(items, actForAnalytics, {
    enabled: !scopeTooLarge && items.length > 0,
  });

  useEffect(() => {
    const onCache = () => setMatrixCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  const installedEntriesByTradePointId = useMemo(() => {
    void matrixCacheBump;
    const map: Record<string, ReturnType<typeof loadCachedMatrix>> = {};
    for (const id of tradePointIds) {
      map[id] = loadCachedMatrix(id);
    }
    return map;
  }, [tradePointIds, matrixCacheBump]);

  return useMemo(() => {
    if (scopeTooLarge || storesLoading) {
      return { ...EMPTY_DISTRIBUTION_ANALYTICS_DATA, act: actForAnalytics };
    }
    const metricsByTradePointId = Object.fromEntries(metricsMap.entries());
    return {
      ...buildDistributionAnalyticsDataFromScoped({
        scopedRows,
        filters,
        act: actForAnalytics,
        metricsByTradePointId,
        installedEntriesByTradePointId,
      }),
      act: actForAnalytics,
    };
  }, [
    scopeTooLarge,
    storesLoading,
    scopedRows,
    filters,
    actForAnalytics,
    metricsMap,
    installedEntriesByTradePointId,
    actContentKey,
  ]);
}
