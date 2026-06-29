import { useEffect, useRef, useState } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { canActualizeClientBase } from "@/lib/client-base-actualization-permissions";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  materializePrimaryTradePointIfNeeded,
  shouldMaterializePrimaryTradePoint,
} from "@/lib/primary-trade-point-materialization";

/** Идемпотентно создаёт основную ТТ в БД, если у клиента нет реальных точек. */
export function usePrimaryTradePointMaterialization(
  row: DealerRow,
  profile: ReleaseDemoProfile,
  opts?: { enabled?: boolean; dbActiveTradePointIds?: string[] },
): { materializing: boolean; materialized: boolean } {
  const actx = useClientBaseActualization();
  const [materializing, setMaterializing] = useState(false);
  const [materialized, setMaterialized] = useState(false);
  const attemptedDealerRef = useRef<string | null>(null);
  const hydrationEnabled = opts?.enabled !== false;
  const dbActiveTradePointIds = opts?.dbActiveTradePointIds ?? [];
  const dbActiveCount = dbActiveTradePointIds.length;

  useEffect(() => {
    if (!hydrationEnabled) return;
    if (!actx.enabled || !canActualizeClientBase(profile)) return;
    if (dbActiveCount > 0) {
      setMaterialized(true);
      return;
    }
    const should = shouldMaterializePrimaryTradePoint(row, actx.state, { dbActiveCount });
    if (!should) {
      setMaterialized(true);
      return;
    }
    if (attemptedDealerRef.current === row.id) return;
    attemptedDealerRef.current = row.id;

    let cancelled = false;
    setMaterializing(true);
    void materializePrimaryTradePointIfNeeded({
      row,
      profile,
      persist: actx.persist,
      dbActiveTradePointIds,
    })
      .then((result) => {
        if (cancelled) return;
        if (result.created || result.skipped) setMaterialized(true);
        if (!result.created && !result.skipped) attemptedDealerRef.current = null;
      })
      .finally(() => {
        if (!cancelled) setMaterializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrationEnabled, dbActiveCount, dbActiveTradePointIds, actx, actx.enabled, actx.state, profile, row]);

  return { materializing, materialized };
}
