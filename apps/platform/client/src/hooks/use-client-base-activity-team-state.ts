/**
 * Состояние актуализации для дашборда активности: один менеджер — из контекста;
 * РОП / директор — объединение GET /api/actualization/state по userId команды.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchActualizationStateByUserId } from "@/lib/client-base-actualization-api";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  countManualDealersInState,
  countManualTradePointsInState,
  mergeActualizationStatesForActivityDashboard,
  resolveActualizationDashboardSourceUserIds,
} from "@/lib/client-base-actualization-team-state-merge";
import type { ActivityDataSourcesDiagnostics, ActivitySourceSnapshot } from "@/lib/client-base-activity-metrics";
import { useOptionalClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";

export type { ActivityDataSourcesDiagnostics } from "@/lib/client-base-activity-metrics";

function emptyDiag(ids: string[]): ActivityDataSourcesDiagnostics {
  return {
    mode: "self",
    requestedUserIds: ids,
    loadedSnapshots: 0,
    failedSnapshots: 0,
    emptySnapshots: 0,
    sumManualDealersAcrossSources: 0,
    mergedManualDealers: 0,
    mergedManualTradePoints: 0,
    lastMergedUpdatedAt: null,
  };
}

function selfDiag(profile: ReleaseDemoProfile, st: ActualizationState): ActivityDataSourcesDiagnostics {
  const id = profile.personaUserId.trim();
  const md = countManualDealersInState(st);
  const mt = countManualTradePointsInState(st);
  const looksEmpty = md === 0 && mt === 0 && Object.keys(st.dealerOverridesById ?? {}).length === 0;
  return {
    mode: "self",
    requestedUserIds: id ? [id] : [],
    loadedSnapshots: 1,
    failedSnapshots: 0,
    emptySnapshots: looksEmpty ? 1 : 0,
    sumManualDealersAcrossSources: md,
    mergedManualDealers: md,
    mergedManualTradePoints: mt,
    lastMergedUpdatedAt: st.updatedAt,
  };
}

export function useClientBaseActivityTeamState(params: {
  enabled: boolean;
  profile: ReleaseDemoProfile;
  dashboardRopTeamId: string;
  contextState: ActualizationState;
}): {
  activityState: ActualizationState;
  activitySources: ActivitySourceSnapshot[];
  diagnostics: ActivityDataSourcesDiagnostics;
  teamLoading: boolean;
  teamError?: string;
  refreshTeam: () => Promise<void>;
} {
  const { enabled, profile, dashboardRopTeamId, contextState } = params;
  const teamCtx = useOptionalClientBaseTeamActualization();
  const fromSharedContext = Boolean(
    teamCtx && enabled && shouldUseTeamMergedActualizationPlane(profile),
  );

  const isTeamMode = profile.role === "sales_director" || profile.role === "team_lead";

  const [activityState, setActivityState] = useState<ActualizationState>(() =>
    isTeamMode ? createEmptyActualizationState() : contextState,
  );
  const [diagnostics, setDiagnostics] = useState<ActivityDataSourcesDiagnostics>(() =>
    isTeamMode ? emptyDiag([]) : selfDiag(profile, contextState),
  );
  const [teamLoading, setTeamLoading] = useState(isTeamMode && enabled);
  const [teamError, setTeamError] = useState<string | undefined>();
  const [teamSourceSnapshots, setTeamSourceSnapshots] = useState<ActivitySourceSnapshot[]>([]);

  const loadTeam = useCallback(async () => {
    if (!enabled || !isTeamMode || fromSharedContext) return;
    setTeamLoading(true);
    setTeamError(undefined);
    const ids = resolveActualizationDashboardSourceUserIds(profile, dashboardRopTeamId);
    const results = await Promise.all(ids.map((id) => fetchActualizationStateByUserId(id)));
    let failed = 0;
    let empty = 0;
    let sumManual = 0;
    const parts: { userId: string; state: ActualizationState }[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const r = results[i]!;
      if (r.syncStatus === "error" || !r.meta.success) {
        failed += 1;
        parts.push({ userId: id, state: createEmptyActualizationState() });
        continue;
      }
      const st = r.meta.state;
      const md = countManualDealersInState(st);
      sumManual += md;
      const mt = countManualTradePointsInState(st);
      if (md === 0 && mt === 0 && Object.keys(st.dealerOverridesById ?? {}).length === 0) {
        empty += 1;
      }
      parts.push({ userId: id, state: st });
    }
    const merged = mergeActualizationStatesForActivityDashboard(parts);
    setActivityState(merged);
    setTeamSourceSnapshots(parts);
    setDiagnostics({
      mode: "team",
      requestedUserIds: ids,
      loadedSnapshots: ids.length - failed,
      failedSnapshots: failed,
      emptySnapshots: empty,
      sumManualDealersAcrossSources: sumManual,
      mergedManualDealers: countManualDealersInState(merged),
      mergedManualTradePoints: countManualTradePointsInState(merged),
      lastMergedUpdatedAt: merged.updatedAt,
    });
    if (failed > 0) {
      setTeamError(`Не удалось загрузить часть state (${failed} из ${ids.length}).`);
    }
    setTeamLoading(false);
  }, [enabled, isTeamMode, fromSharedContext, profile, dashboardRopTeamId]);

  useEffect(() => {
    if (fromSharedContext) return;
    if (enabled) return;
    setActivityState(createEmptyActualizationState());
    setDiagnostics(emptyDiag([]));
    setTeamSourceSnapshots([]);
    setTeamLoading(false);
    setTeamError(undefined);
  }, [fromSharedContext, enabled]);

  useEffect(() => {
    if (fromSharedContext) return;
    if (!enabled || isTeamMode) return;
    setActivityState(contextState);
    setDiagnostics(selfDiag(profile, contextState));
    setTeamSourceSnapshots([]);
    setTeamLoading(false);
    setTeamError(undefined);
  }, [fromSharedContext, enabled, isTeamMode, contextState, profile]);

  useEffect(() => {
    if (fromSharedContext) return;
    if (!enabled || !isTeamMode) return;
    void loadTeam();
  }, [fromSharedContext, enabled, isTeamMode, loadTeam]);

  const refreshTeam = useCallback(async () => {
    if (fromSharedContext && teamCtx) {
      await teamCtx.refresh();
      return;
    }
    await loadTeam();
  }, [fromSharedContext, teamCtx, loadTeam]);

  const activitySources = useMemo((): ActivitySourceSnapshot[] => {
    if (!enabled) return [];
    if (fromSharedContext && teamCtx) return teamCtx.activitySourceSnapshots;
    const uid = profile.personaUserId.trim();
    if (!uid) return [];
    if (isTeamMode) return teamSourceSnapshots;
    return [{ userId: uid, state: contextState }];
  }, [
    enabled,
    fromSharedContext,
    teamCtx,
    isTeamMode,
    teamSourceSnapshots,
    contextState,
    profile.personaUserId,
  ]);

  return useMemo(() => {
    if (fromSharedContext && teamCtx) {
      return {
        activityState: teamCtx.mergedState,
        activitySources,
        diagnostics: teamCtx.activityDiagnostics,
        teamLoading: teamCtx.teamFetchLoading,
        teamError: teamCtx.teamFetchError,
        refreshTeam,
      };
    }
    return { activityState, activitySources, diagnostics, teamLoading, teamError, refreshTeam };
  }, [
    fromSharedContext,
    teamCtx,
    activityState,
    activitySources,
    diagnostics,
    teamLoading,
    teamError,
    refreshTeam,
  ]);
}
