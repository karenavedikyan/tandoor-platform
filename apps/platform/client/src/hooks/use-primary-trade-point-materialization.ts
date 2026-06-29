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
): { materializing: boolean; materialized: boolean } {
  const actx = useClientBaseActualization();
  const [materializing, setMaterializing] = useState(false);
  const [materialized, setMaterialized] = useState(false);
  const attemptedDealerRef = useRef<string | null>(null);

  useEffect(() => {
    if (!actx.enabled || !canActualizeClientBase(profile)) return;
    if (!shouldMaterializePrimaryTradePoint(row, actx.state)) {
      setMaterialized(true);
      return;
    }
    if (attemptedDealerRef.current === row.id) return;
    attemptedDealerRef.current = row.id;

    let cancelled = false;
    setMaterializing(true);
    void materializePrimaryTradePointIfNeeded({
      row,
      act: actx.state,
      profile,
      persist: actx.persist,
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
  }, [actx, actx.enabled, actx.state, profile, row]);

  return { materializing, materialized };
}
