import { useEffect, useRef, useState } from "react";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { canActualizeClientBase } from "@/lib/client-base-actualization-permissions";
import { PRIMARY_TRADE_POINT_MATERIALIZED_EVENT } from "@/lib/primary-trade-point-materialization";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  fetchUnifiedActiveTradePointsForDealer,
  reconcileUnifiedTradePointsIntoActualizationState,
} from "@/lib/trade-points-actualization-hydration";

/**
 * При открытии карточки клиента подтягивает активные ТТ из единого DB-источника
 * и реконсилирует их в actualization-blob (идемпотентно).
 */
export function useTradePointsActualizationHydration(
  dealerId: string | undefined,
  profile: ReleaseDemoProfile,
  enabled = true,
): { ready: boolean; hydrationVersion: number } {
  const actx = useClientBaseActualization();
  const [hydrationVersion, setHydrationVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    const id = dealerId?.trim();
    if (!enabled || !id || !actx.enabled || !canActualizeClientBase(profile)) {
      setReady(true);
      return;
    }

    let cancelled = false;

    const run = async (force = false) => {
      if (!force && attemptedRef.current === id) return;
      attemptedRef.current = id;

      const rows = await fetchUnifiedActiveTradePointsForDealer(id);
      if (cancelled) return;

      if (rows && rows.length > 0) {
        const r = await actx.persist((prev) => {
          const { next, changed } = reconcileUnifiedTradePointsIntoActualizationState(prev, rows, id, profile);
          return changed ? next : prev;
        });
        void r;
      }

      if (!cancelled) {
        setReady(true);
        setHydrationVersion((n) => n + 1);
      }
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
      window.removeEventListener(PRIMARY_TRADE_POINT_MATERIALIZED_EVENT, onMaterialized);
    };
  }, [enabled, dealerId, profile, actx.enabled, actx.persist]);

  return { ready, hydrationVersion };
}
