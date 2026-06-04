/**
 * Единый merge team actualization для РОП/директора: один fetch на scope команды,
 * общий для dealer-base, trade-points, главной, сайдбара, активности, client-map (через хук-обёртку).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import {
  countManualDealersInState,
  countManualTradePointsInState,
  mergeActualizationStatesForActivityDashboard,
} from "@/lib/client-base-actualization-team-state-merge";
import type { ActivityDataSourcesDiagnostics, ActivitySourceSnapshot } from "@/lib/client-base-activity-metrics";
import {
  fetchMergedTeamActualizationForManagement,
  shouldUseTeamMergedActualizationPlane,
} from "@/lib/client-base-management-scope";
import {
  dispatchManagementTeamScopeChanged,
  MANAGEMENT_TEAM_SCOPE_CHANGED_EVENT,
  MANAGEMENT_TEAM_SCOPE_LS_KEY,
  normalizeManagementDashboardRopTeamId,
  publishManagementDashboardRopTeamId,
  resolveInitialManagementDashboardRopTeamId,
} from "@/lib/client-base-management-team-scope-storage";
import { mapSalesRoleToDealerBaseAccess } from "@/lib/dealer-base-role-views";
import { getRopOptions, isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";
import { getEffectiveTeamLeadTeamId } from "@/lib/release-demo-profile";
import { useRouteSearchParams } from "@/lib/hash-route-utils";

export type ClientBaseTeamActualizationContextValue = {
  /** Идентификатор команды РОП для resolveActualizationDashboardSourceUserIds (`all` = все). */
  dashboardRopTeamId: string;
  /** Обновить scope (директор — пишет LS; всегда dispatch события). */
  publishDashboardRopTeamId: (ropTeamId: string) => void;
  mergedState: ActualizationState;
  teamParts: { userId: string; state: ActualizationState }[];
  teamFetchLoading: boolean;
  teamFetchError?: string;
  refresh: () => Promise<void>;
  /** Снимки для дашборда активности (с подменой self на живой contextState). */
  activitySourceSnapshots: ActivitySourceSnapshot[];
  activityDiagnostics: ActivityDataSourcesDiagnostics;
};

const Ctx = createContext<ClientBaseTeamActualizationContextValue | null>(null);

function emptyActivityDiag(): ActivityDataSourcesDiagnostics {
  return {
    mode: "self",
    requestedUserIds: [],
    loadedSnapshots: 0,
    failedSnapshots: 0,
    emptySnapshots: 0,
    sumManualDealersAcrossSources: 0,
    mergedManualDealers: 0,
    mergedManualTradePoints: 0,
    lastMergedUpdatedAt: null,
  };
}

function selfActivityDiag(profile: { personaUserId: string }, st: ActualizationState): ActivityDataSourcesDiagnostics {
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

function teamActivityDiag(
  ids: string[],
  _parts: { userId: string; state: ActualizationState }[],
  merged: ActualizationState,
  failed: number,
  empty: number,
  sumManual: number,
): ActivityDataSourcesDiagnostics {
  return {
    mode: "team",
    requestedUserIds: ids,
    loadedSnapshots: ids.length - failed,
    failedSnapshots: failed,
    emptySnapshots: empty,
    sumManualDealersAcrossSources: sumManual,
    mergedManualDealers: countManualDealersInState(merged),
    mergedManualTradePoints: countManualTradePointsInState(merged),
    lastMergedUpdatedAt: merged.updatedAt,
  };
}

type ManagementTeamScopeChangedDetail = { ropTeamId: string };

export function ClientBaseTeamActualizationProvider({ children }: { children: ReactNode }): ReactElement {
  const { profile } = useReleaseDemoProfile();
  const actx = useClientBaseActualization();
  const access = useMemo(() => mapSalesRoleToDealerBaseAccess(profile.role), [profile.role]);
  const [loc] = useLocation();
  const routeQs = useRouteSearchParams();

  const isTeamPlane = actx.enabled && shouldUseTeamMergedActualizationPlane(profile);

  const [dashboardRopTeamId, setDashboardRopTeamId] = useState(() =>
    resolveInitialManagementDashboardRopTeamId(profile, access),
  );

  const [teamParts, setTeamParts] = useState<{ userId: string; state: ActualizationState }[]>([]);
  const [teamFetchLoading, setTeamFetchLoading] = useState(isTeamPlane);
  const [teamFetchError, setTeamFetchError] = useState<string | undefined>();
  const [lastFetchDiag, setLastFetchDiag] = useState<{
    requestedUserIds: string[];
    failed: number;
    empty: number;
    sumManual: number;
  }>({ requestedUserIds: [], failed: 0, empty: 0, sumManual: 0 });

  const publishDashboardRopTeamId = useCallback(
    (ropTeamId: string) => {
      let next = normalizeManagementDashboardRopTeamId(ropTeamId);
      if (profile.role === "team_lead") {
        next = getEffectiveTeamLeadTeamId(profile);
      }
      setDashboardRopTeamId(next);
      if (profile.role === "sales_director") {
        publishManagementDashboardRopTeamId(next, profile);
      } else {
        dispatchManagementTeamScopeChanged(next);
      }
    },
    [profile],
  );

  /** URL `team` / `rop`: только если параметр явно задан (иначе сохраняем LS / текущий scope). */
  useEffect(() => {
    if (profile.role !== "sales_director") return;
    const path = loc.split("?")[0] ?? loc;
    if (path !== "/dealer-base" && path !== "/trade-points" && path !== "/client-base-activity") return;
    const teamRaw = (routeQs.get("team") ?? routeQs.get("rop"))?.trim() ?? "";
    if (!teamRaw) return;
    if (isRopOrManagerAllFilter(teamRaw)) {
      setDashboardRopTeamId("all");
      publishManagementDashboardRopTeamId("all", profile);
      return;
    }
    if (!getRopOptions().some((o) => o.teamId === teamRaw)) return;
    setDashboardRopTeamId(teamRaw);
    publishManagementDashboardRopTeamId(teamRaw, profile);
  }, [loc, routeQs, profile]);

  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== MANAGEMENT_TEAM_SCOPE_LS_KEY || profile.role !== "sales_director") return;
      try {
        const raw = e.newValue?.trim();
        if (!raw) return;
        const parsed = JSON.parse(raw) as { ropTeamId?: string };
        const id = typeof parsed?.ropTeamId === "string" ? normalizeManagementDashboardRopTeamId(parsed.ropTeamId) : "all";
        setDashboardRopTeamId(id);
      } catch {
        /* ignore */
      }
    };
    const onCustom = (ev: Event): void => {
      const d = (ev as CustomEvent<ManagementTeamScopeChangedDetail>).detail;
      if (!d?.ropTeamId) return;
      if (profile.role === "team_lead") return;
      setDashboardRopTeamId(normalizeManagementDashboardRopTeamId(d.ropTeamId));
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(MANAGEMENT_TEAM_SCOPE_CHANGED_EVENT, onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(MANAGEMENT_TEAM_SCOPE_CHANGED_EVENT, onCustom as EventListener);
    };
  }, [profile.role]);

  /** При смене пользователя/роли — пересчитать дефолтный scope. */
  useEffect(() => {
    const next = resolveInitialManagementDashboardRopTeamId(profile, access);
    setDashboardRopTeamId(next);
  }, [profile.personaUserId, profile.role, access]);

  const lastLoadAtRef = useRef(0);
  const VISIBILITY_RELOAD_MIN_MS = 30_000;

  const loadTeam = useCallback(async () => {
    if (!isTeamPlane) return;
    setTeamFetchLoading(true);
    setTeamFetchError(undefined);
    const r = await fetchMergedTeamActualizationForManagement(profile, dashboardRopTeamId);
    setTeamParts(r.parts);
    const failed = r.diagnostics.failedSnapshots;
    const empty = r.diagnostics.emptySnapshots;
    const sumManual = r.diagnostics.sumManualDealersAcrossSources;
    setLastFetchDiag({
      requestedUserIds: r.diagnostics.requestedUserIds,
      failed,
      empty,
      sumManual,
    });
    if (r.errorMessage) setTeamFetchError(r.errorMessage);
    setTeamFetchLoading(false);
    lastLoadAtRef.current = Date.now();
  }, [isTeamPlane, profile.personaUserId, profile.role, dashboardRopTeamId]);

  useEffect(() => {
    if (!actx.enabled) {
      setTeamParts([]);
      setTeamFetchLoading(false);
      setTeamFetchError(undefined);
      setLastFetchDiag({ requestedUserIds: [], failed: 0, empty: 0, sumManual: 0 });
      return;
    }
    if (!isTeamPlane) {
      setTeamParts([]);
      setTeamFetchLoading(false);
      setTeamFetchError(undefined);
      setLastFetchDiag({ requestedUserIds: [], failed: 0, empty: 0, sumManual: 0 });
      return;
    }
    void loadTeam();
  }, [actx.enabled, isTeamPlane, loadTeam]);

  useEffect(() => {
    if (!isTeamPlane || typeof document === "undefined") return;
    const onVis = (): void => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadAtRef.current < VISIBILITY_RELOAD_MIN_MS) return;
      void loadTeam();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isTeamPlane, loadTeam]);

  const mergedState = useMemo((): ActualizationState => {
    if (!actx.enabled) return actx.state;
    if (!isTeamPlane) return actx.state;
    const selfId = profile.personaUserId.trim();
    if (teamParts.length === 0) {
      return mergeActualizationStatesForActivityDashboard([{ userId: selfId || "self", state: actx.state }]);
    }
    const parts = teamParts.map((p) => (p.userId === selfId ? { userId: p.userId, state: actx.state } : p));
    return mergeActualizationStatesForActivityDashboard(parts);
  }, [actx.enabled, actx.state, isTeamPlane, teamParts, profile.personaUserId]);

  const activitySourceSnapshots = useMemo((): ActivitySourceSnapshot[] => {
    if (!actx.enabled) return [];
    const uid = profile.personaUserId.trim();
    if (!uid) return [];
    if (!isTeamPlane) return [{ userId: uid, state: actx.state }];
    const selfId = uid;
    if (teamParts.length === 0) return [{ userId: selfId || "self", state: actx.state }];
    return teamParts.map((p) => (p.userId === selfId ? { userId: p.userId, state: actx.state } : p));
  }, [actx.enabled, actx.state, isTeamPlane, teamParts, profile.personaUserId]);

  const activityDiagnostics = useMemo((): ActivityDataSourcesDiagnostics => {
    if (!actx.enabled) return emptyActivityDiag();
    if (!isTeamPlane) return selfActivityDiag(profile, actx.state);
    const merged = mergedState;
    return teamActivityDiag(
      lastFetchDiag.requestedUserIds,
      teamParts,
      merged,
      lastFetchDiag.failed,
      lastFetchDiag.empty,
      lastFetchDiag.sumManual,
    );
  }, [actx.enabled, actx.state, isTeamPlane, mergedState, teamParts, lastFetchDiag, profile]);

  const refresh = useCallback(async () => {
    await loadTeam();
  }, [loadTeam]);

  const value = useMemo(
    (): ClientBaseTeamActualizationContextValue => ({
      dashboardRopTeamId,
      publishDashboardRopTeamId,
      mergedState,
      teamParts,
      teamFetchLoading: isTeamPlane && teamFetchLoading,
      teamFetchError,
      refresh,
      activitySourceSnapshots,
      activityDiagnostics,
    }),
    [
      dashboardRopTeamId,
      publishDashboardRopTeamId,
      mergedState,
      teamParts,
      isTeamPlane,
      teamFetchLoading,
      teamFetchError,
      refresh,
      activitySourceSnapshots,
      activityDiagnostics,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientBaseTeamActualization(): ClientBaseTeamActualizationContextValue {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useClientBaseTeamActualization must be used within ClientBaseTeamActualizationProvider");
  }
  return v;
}

export function useOptionalClientBaseTeamActualization(): ClientBaseTeamActualizationContextValue | null {
  return useContext(Ctx);
}
