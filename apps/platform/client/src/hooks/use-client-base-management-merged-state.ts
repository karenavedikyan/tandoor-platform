/**
 * Объединённый ActualizationState для РОП/директора (все менеджеры в scope).
 * Для sales_manager — тот же state, что в ClientBaseActualizationProvider.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { mergeActualizationStatesForActivityDashboard } from "@/lib/client-base-actualization-team-state-merge";
import { type ActualizationState } from "@/lib/client-base-actualization-state";
import {
  fetchMergedTeamActualizationForManagement,
  shouldUseTeamMergedActualizationPlane,
} from "@/lib/client-base-management-scope";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

export type ClientBaseManagementMergedState = {
  /** State для buildDealerBaseRowsWithActualization / trade point lists. */
  mergedState: ActualizationState;
  /** Режим team: идёт первая загрузка или смена команды. */
  teamFetchLoading: boolean;
  teamFetchError?: string;
  refreshMergedTeam: () => Promise<void>;
  /** Сырые снимки (для отладки); self всегда подменяется на актуальный contextState в mergedState. */
  teamParts: { userId: string; state: ActualizationState }[];
  diagnostics: {
    requestedUserIds: string[];
    loadedSnapshots: number;
    failedSnapshots: number;
  };
};

export function useClientBaseManagementMergedState(params: {
  enabled: boolean;
  profile: ReleaseDemoProfile;
  dashboardRopTeamId: string;
  contextState: ActualizationState;
}): ClientBaseManagementMergedState {
  const { enabled, profile, dashboardRopTeamId, contextState } = params;
  const isTeamPlane = enabled && shouldUseTeamMergedActualizationPlane(profile);

  const [teamParts, setTeamParts] = useState<{ userId: string; state: ActualizationState }[]>([]);
  const [teamFetchLoading, setTeamFetchLoading] = useState(isTeamPlane);
  const [teamFetchError, setTeamFetchError] = useState<string | undefined>();
  const [diag, setDiag] = useState({
    requestedUserIds: [] as string[],
    loadedSnapshots: 0,
    failedSnapshots: 0,
  });

  const loadTeam = useCallback(async () => {
    if (!isTeamPlane) return;
    setTeamFetchLoading(true);
    setTeamFetchError(undefined);
    const r = await fetchMergedTeamActualizationForManagement(profile, dashboardRopTeamId);
    setTeamParts(r.parts);
    setDiag({
      requestedUserIds: r.diagnostics.requestedUserIds,
      loadedSnapshots: r.diagnostics.loadedSnapshots,
      failedSnapshots: r.diagnostics.failedSnapshots,
    });
    if (r.errorMessage) setTeamFetchError(r.errorMessage);
    setTeamFetchLoading(false);
  }, [isTeamPlane, profile, dashboardRopTeamId]);

  useEffect(() => {
    if (!enabled) {
      setTeamParts([]);
      setTeamFetchLoading(false);
      setTeamFetchError(undefined);
      setDiag({ requestedUserIds: [], loadedSnapshots: 0, failedSnapshots: 0 });
      return;
    }
    if (!isTeamPlane) {
      setTeamParts([]);
      setTeamFetchLoading(false);
      setTeamFetchError(undefined);
      setDiag({ requestedUserIds: [], loadedSnapshots: 0, failedSnapshots: 0 });
      return;
    }
    void loadTeam();
  }, [enabled, isTeamPlane, loadTeam]);

  useEffect(() => {
    if (!isTeamPlane || typeof document === "undefined") return;
    const onVis = (): void => {
      if (document.visibilityState === "visible") void loadTeam();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isTeamPlane, loadTeam]);

  const mergedState = useMemo((): ActualizationState => {
    /** При выключенной актуализации контекст всё равно держит последний state — не затираем пустым. */
    if (!enabled) return contextState;
    if (!isTeamPlane) return contextState;
    const selfId = profile.personaUserId.trim();
    if (teamParts.length === 0) {
      return mergeActualizationStatesForActivityDashboard([{ userId: selfId || "self", state: contextState }]);
    }
    const parts = teamParts.map((p) => (p.userId === selfId ? { userId: p.userId, state: contextState } : p));
    return mergeActualizationStatesForActivityDashboard(parts);
  }, [enabled, isTeamPlane, contextState, teamParts, profile.personaUserId]);

  const refreshMergedTeam = useCallback(async () => {
    await loadTeam();
  }, [loadTeam]);

  return {
    mergedState,
    teamFetchLoading: isTeamPlane && teamFetchLoading,
    teamFetchError,
    refreshMergedTeam,
    teamParts,
    diagnostics: diag,
  };
}
