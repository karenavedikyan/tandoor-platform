/**
 * Объединённый ActualizationState для РОП/директора: данные из {@link ClientBaseTeamActualizationProvider}.
 * Параметр `dashboardRopTeamId` сохранён для совместимости API; фактический scope — общий контекст.
 */

import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

export type ClientBaseManagementMergedState = {
  mergedState: ActualizationState;
  teamFetchLoading: boolean;
  teamFetchError?: string;
  refreshMergedTeam: () => Promise<void>;
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
  void params.enabled;
  void params.profile;
  void params.dashboardRopTeamId;
  void params.contextState;
  const ctx = useClientBaseTeamActualization();
  return {
    mergedState: ctx.mergedState,
    teamFetchLoading: ctx.teamFetchLoading,
    teamFetchError: ctx.teamFetchError,
    refreshMergedTeam: ctx.refresh,
    teamParts: ctx.teamParts,
    diagnostics: {
      requestedUserIds: ctx.activityDiagnostics.requestedUserIds,
      loadedSnapshots: ctx.activityDiagnostics.loadedSnapshots,
      failedSnapshots: ctx.activityDiagnostics.failedSnapshots,
    },
  };
}
