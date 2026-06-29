import { useEffect, useMemo, useRef, useState } from "react";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useDistributionScopedDealers } from "@/hooks/use-distribution-scoped-dealers";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";
import { scopedTradePointIdsStableKey } from "@/lib/distribution-entry-tradepoint-view-model";
import {
  buildDistributionAnalyticsData,
  buildScopedAnalyticsTradePointRows,
  type DistributionAnalyticsData,
} from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DistributionAnalyticsFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import {
  DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD,
  hasAnyDistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
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

export type DistributionAnalyticsHookResult = DistributionAnalyticsData & {
  act: ActualizationState;
};

export function useDistributionAnalyticsData(
  profile: ReleaseDemoProfile,
  filters: DistributionAnalyticsFilters,
): DistributionAnalyticsHookResult {
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const realScope = useSidebarNavRealScope();
  const scopedDealers = useDistributionScopedDealers(profile);
  const [matrixCacheBump, setMatrixCacheBump] = useState(0);
  const lastPrefetchedScopeKeyRef = useRef("");
  const prefetchTradePointIdsRef = useRef<string[]>([]);
  const prevSourceScopeKeyRef = useRef("");

  const mergedState = managementPlane.mergedState;
  const act = actx.enabled ? mergedState : actx.state;

  const actContentKey = useMemo(() => {
    const tp = act.tradePointShowcaseActualizationById;
    const ov = act.dealerOverridesById;
    return [
      act.updatedAt ?? "",
      tp ? Object.keys(tp).length : 0,
      ov ? Object.keys(ov).length : 0,
    ].join("|");
  }, [act.updatedAt, act.tradePointShowcaseActualizationById, act.dealerOverridesById]);

  const actStableRef = useRef(act);
  const actKeyRef = useRef(actContentKey);
  if (actKeyRef.current !== actContentKey) {
    actKeyRef.current = actContentKey;
    actStableRef.current = act;
  }
  const actStable = actStableRef.current;

  const scopeTooLarge =
    scopedDealers.length > DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD &&
    !hasAnyDistributionAnalyticsFilters(filters);

  const scopedRows = useMemo(
    () =>
      scopeTooLarge
        ? []
        : buildScopedAnalyticsTradePointRows(actStable, profile, scopedDealers, realScope),
    [scopeTooLarge, actStable, profile, scopedDealers, realScope],
  );

  const sourceScopeKey = useMemo(
    () =>
      scopedTradePointIdsStableKey(
        buildScopedAnalyticsTradePointRows(actStable, profile, scopedDealers, realScope).map(
          (r) => r.tradePointId,
        ),
      ),
    [actStable, profile, scopedDealers, realScope],
  );

  if (prevSourceScopeKeyRef.current !== sourceScopeKey) {
    prevSourceScopeKeyRef.current = sourceScopeKey;
    prefetchTradePointIdsRef.current = scopeTooLarge ? [] : scopedRows.map((r) => r.tradePointId);
  }

  const tradePointIds = useMemo(() => scopedRows.map((r) => r.tradePointId), [scopedRows]);

  useEffect(() => {
    const onCache = () => setMatrixCacheBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onCache);
  }, []);

  useEffect(() => {
    if (scopeTooLarge || sourceScopeKey === "") return;
    if (hasScopePrefetchCompleted(sourceScopeKey)) return;
    if (lastPrefetchedScopeKeyRef.current === sourceScopeKey) return;

    lastPrefetchedScopeKeyRef.current = sourceScopeKey;
    markScopePrefetchCompleted(sourceScopeKey);
    const ids = prefetchTradePointIdsRef.current;
    if (ids.length === 0) return;

    void (async () => {
      const entries = await fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] });
      if (entries != null && entries.length > 0) {
        applyScopeEntriesToMatrixCache(entries);
      }
    })();
  }, [scopeTooLarge, sourceScopeKey]);

  const installedEntriesByTradePointId = useMemo(() => {
    void matrixCacheBump;
    const map: Record<string, ReturnType<typeof loadCachedMatrix>> = {};
    for (const id of tradePointIds) {
      map[id] = loadCachedMatrix(id);
    }
    return map;
  }, [tradePointIds, matrixCacheBump]);

  return useMemo(
    () =>
      scopeTooLarge
        ? { ...EMPTY_DISTRIBUTION_ANALYTICS_DATA, act: actStable }
        : {
            ...buildDistributionAnalyticsData({
              scopedRows,
              filters,
              act: actStable,
              installedEntriesByTradePointId,
            }),
            act: actStable,
          },
    [scopeTooLarge, scopedRows, filters, actStable, installedEntriesByTradePointId],
  );
}
