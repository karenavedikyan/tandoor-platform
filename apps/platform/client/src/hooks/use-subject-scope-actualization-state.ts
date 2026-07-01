/**
 * Actualization plane for staff view under a manager: mirror subject manager LK state
 * instead of viewer's merged team plane. Used by dealer-base / trade-points embed lists.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchActualizationStateByUserId } from "@/lib/client-base-actualization-api";
import { createEmptyActualizationState, type ActualizationState } from "@/lib/client-base-actualization-state";
import type { UserRole } from "@shared/auth";

function isManagerScopeRole(role: string | null | undefined): boolean {
  return role === "manager" || role === "regional_manager";
}

export function resolveSubjectScopeActualizationStateSync(
  teamParts: { userId: string; state: ActualizationState }[],
  scopeUserId: string,
): ActualizationState | undefined {
  return teamParts.find((p) => p.userId === scopeUserId)?.state;
}

export function shouldMirrorSubjectManagerActualizationState(
  viewingOtherUserScope: boolean,
  scopeUserId: string | undefined,
  scopeReady: boolean,
  scopeSubjectRole: UserRole | string | null | undefined,
): boolean {
  return (
    viewingOtherUserScope &&
    Boolean(scopeUserId) &&
    scopeReady &&
    isManagerScopeRole(scopeSubjectRole)
  );
}

export function useSubjectScopeActualizationState(params: {
  viewingOtherUserScope: boolean;
  scopeUserId?: string;
  scopeSubjectRole?: UserRole | string | null;
  scopeReady: boolean;
  teamMergedState: ActualizationState;
  teamParts: { userId: string; state: ActualizationState }[];
  actEnabled: boolean;
}): { plane: ActualizationState; subjectLoading: boolean } {
  const {
    viewingOtherUserScope,
    scopeUserId,
    scopeSubjectRole,
    scopeReady,
    teamMergedState,
    teamParts,
    actEnabled,
  } = params;

  const needsSubjectMirror = shouldMirrorSubjectManagerActualizationState(
    viewingOtherUserScope,
    scopeUserId,
    scopeReady,
    scopeSubjectRole,
  );

  const syncSubjectState = useMemo(() => {
    if (!needsSubjectMirror || !scopeUserId) return undefined;
    return resolveSubjectScopeActualizationStateSync(teamParts, scopeUserId);
  }, [needsSubjectMirror, scopeUserId, teamParts]);

  const [fetchedState, setFetchedState] = useState<ActualizationState | undefined>();
  const [fetchLoading, setFetchLoading] = useState(false);

  const loadSubject = useCallback(async () => {
    if (!needsSubjectMirror || !scopeUserId || syncSubjectState) return;
    setFetchLoading(true);
    try {
      const r = await fetchActualizationStateByUserId(scopeUserId);
      setFetchedState(r.meta.success ? r.meta.state : createEmptyActualizationState());
    } finally {
      setFetchLoading(false);
    }
  }, [needsSubjectMirror, scopeUserId, syncSubjectState]);

  useEffect(() => {
    if (!needsSubjectMirror) {
      setFetchedState(undefined);
      setFetchLoading(false);
      return;
    }
    if (syncSubjectState) {
      setFetchedState(undefined);
      setFetchLoading(false);
      return;
    }
    void loadSubject();
  }, [needsSubjectMirror, syncSubjectState, loadSubject]);

  const plane = useMemo((): ActualizationState => {
    if (!actEnabled) return createEmptyActualizationState();
    if (!needsSubjectMirror) return teamMergedState;
    return syncSubjectState ?? fetchedState ?? createEmptyActualizationState();
  }, [actEnabled, needsSubjectMirror, teamMergedState, syncSubjectState, fetchedState]);

  const subjectLoading =
    needsSubjectMirror && !syncSubjectState && !fetchedState && fetchLoading;

  return { plane, subjectLoading };
}
