import { useEffect, useRef, useState } from "react";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { canActualizeClientBase } from "@/lib/client-base-actualization-permissions";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { PRIMARY_TRADE_POINT_MATERIALIZED_EVENT } from "@/lib/primary-trade-point-materialization";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { UnifiedActiveTradePointDetail } from "@shared/trade-point-primary";
import {
  fetchUnifiedActiveTradePointsForDealer,
  reconcileUnifiedTradePointsIntoActualizationState,
  unifiedDbTradePointIds,
} from "@/lib/trade-points-actualization-hydration";
import {
  getTpHydrationNoWritebackFlagSync,
  shouldUseTpHydrationNoWriteback,
} from "@/lib/tp-hydration-no-writeback-flag";

export const TP_DB_HYDRATION_FETCH_TIMEOUT_MS = 8000;

export function shouldSkipTradePointsHydrationFetch(
  attemptedRef: { current: string | null },
  id: string,
  force: boolean,
): boolean {
  return !force && attemptedRef.current === id;
}

export function releaseTradePointsHydrationAttemptOnCancel(
  attemptedRef: { current: string | null },
  id: string,
  completed: boolean,
): void {
  if (!completed && attemptedRef.current === id) {
    attemptedRef.current = null;
  }
}

export function scheduleHydrationReadyFallback(args: {
  timeoutMs?: number;
  isCancelled: () => boolean;
  isReadySet: () => boolean;
  onFallback: () => void;
}): () => void {
  const timeoutMs = args.timeoutMs ?? TP_DB_HYDRATION_FETCH_TIMEOUT_MS;
  const timer = globalThis.setTimeout(() => {
    if (args.isCancelled() || args.isReadySet()) return;
    args.onFallback();
  }, timeoutMs);
  return () => globalThis.clearTimeout(timer);
}

export async function executeTradePointsDbHydration(args: {
  id: string;
  force?: boolean;
  attemptedRef: { current: string | null };
  isCancelled: () => boolean;
  fetchRows?: (dealerId: string) => Promise<UnifiedActiveTradePointDetail[] | null>;
  persist: (mutate: (prev: ActualizationState) => ActualizationState) => Promise<{ success: boolean }>;
  actState: ActualizationState;
  profile: ReleaseDemoProfile;
  onRows: (rows: UnifiedActiveTradePointDetail[], ids: string[]) => void;
  markCompleted: () => void;
  /** TP_HYDRATION_NO_WRITEBACK: только read-overlay, без persist в blob. */
  noWriteback?: boolean;
}): Promise<boolean> {
  const { id, force = false, attemptedRef, isCancelled } = args;
  const noWriteback = args.noWriteback === true;
  if (shouldSkipTradePointsHydrationFetch(attemptedRef, id, force)) return false;
  attemptedRef.current = id;

  const fetchFn = args.fetchRows ?? fetchUnifiedActiveTradePointsForDealer;
  const rows = await fetchFn(id);
  if (isCancelled()) return false;

  const ids = unifiedDbTradePointIds(rows);
  args.onRows(rows ?? [], ids);

  // Write-back DB→blob нужен только при флаге off (legacy). Отображение читает dbTradePoints +
  // mergeTradePointsActiveFromDbWithActualizationOverlay — результат reconcile в blob не используется.
  if (!noWriteback && rows && rows.length > 0) {
    const r = await args.persist((prev) => {
      const { next, changed: changedInPersist } = reconcileUnifiedTradePointsIntoActualizationState(
        prev,
        rows,
        id,
        args.profile,
      );
      return changedInPersist ? next : prev;
    });
    void r;
  }

  if (isCancelled()) return false;
  args.markCompleted();
  return true;
}

/**
 * При открытии карточки клиента подтягивает активные ТТ из единого DB-источника
 * в read-overlay (`dbTradePoints`). При TP_HYDRATION_NO_WRITEBACK — без write-back в blob.
 */
export function useTradePointsActualizationHydration(
  dealerId: string | undefined,
  profile: ReleaseDemoProfile,
  enabled = true,
): {
  ready: boolean;
  hydrationVersion: number;
  dbActiveTradePointIds: string[];
  dbTradePoints: UnifiedActiveTradePointDetail[];
  dbActiveCount: number;
} {
  const actx = useClientBaseActualization();
  const [hydrationVersion, setHydrationVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [dbActiveTradePointIds, setDbActiveTradePointIds] = useState<string[]>([]);
  const [dbTradePoints, setDbTradePoints] = useState<UnifiedActiveTradePointDetail[]>([]);
  const attemptedRef = useRef<string | null>(null);
  const persistRef = useRef(actx.persist);
  persistRef.current = actx.persist;
  const noWritebackRef = useRef(getTpHydrationNoWritebackFlagSync());
  const readySetRef = useRef(false);

  useEffect(() => {
    const id = dealerId?.trim();
    if (!enabled || !id || !actx.enabled || !canActualizeClientBase(profile)) {
      readySetRef.current = true;
      setReady(true);
      setDbActiveTradePointIds([]);
      setDbTradePoints([]);
      return;
    }

    let cancelled = false;
    let completed = false;

    const markReady = () => {
      readySetRef.current = true;
      setReady(true);
      setHydrationVersion((n) => n + 1);
    };

    const clearReadyFallback = scheduleHydrationReadyFallback({
      isCancelled: () => cancelled,
      isReadySet: () => readySetRef.current,
      onFallback: () => {
        completed = true;
        markReady();
      },
    });

    const run = async (force = false) => {
      noWritebackRef.current = await shouldUseTpHydrationNoWriteback();
      if (cancelled) return;

      const didComplete = await executeTradePointsDbHydration({
        id,
        force,
        attemptedRef,
        isCancelled: () => cancelled,
        noWriteback: noWritebackRef.current,
        persist: (mutate) => persistRef.current(mutate),
        actState: actx.state,
        profile,
        onRows: (rows, ids) => {
          setDbActiveTradePointIds(ids);
          setDbTradePoints(rows);
        },
        markCompleted: () => {
          completed = true;
          clearReadyFallback();
          markReady();
        },
      });
      void didComplete;
    };

    void run();

    const onMaterialized = (e: Event) => {
      const detail = (e as CustomEvent<{ dealerId?: string }>).detail;
      if (detail?.dealerId === id) {
        attemptedRef.current = null;
        void run(true);
      }
    };
    window.addEventListener(PRIMARY_TRADE_POINT_MATERIALIZED_EVENT, onMaterialized);

    return () => {
      cancelled = true;
      clearReadyFallback();
      releaseTradePointsHydrationAttemptOnCancel(attemptedRef, id, completed);
      window.removeEventListener(PRIMARY_TRADE_POINT_MATERIALIZED_EVENT, onMaterialized);
    };
  }, [enabled, dealerId, profile, actx.enabled]);

  return {
    ready,
    hydrationVersion,
    dbActiveTradePointIds,
    dbTradePoints,
    dbActiveCount: dbActiveTradePointIds.length,
  };
}
