import { useEffect, useRef, useState } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { canActualizeClientBase } from "@/lib/client-base-actualization-permissions";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  materializePrimaryTradePointIfNeeded,
  shouldMaterializePrimaryTradePoint,
} from "@/lib/primary-trade-point-materialization";
import { tpDiag } from "@/lib/tp-diag-trace";

/** Идемпотентно создаёт основную ТТ в БД, если у клиента нет реальных точек. */
export function usePrimaryTradePointMaterialization(
  row: DealerRow,
  profile: ReleaseDemoProfile,
  opts?: { enabled?: boolean },
): { materializing: boolean; materialized: boolean } {
  const actx = useClientBaseActualization();
  const [materializing, setMaterializing] = useState(false);
  const [materialized, setMaterialized] = useState(false);
  const attemptedDealerRef = useRef<string | null>(null);
  const hydrationEnabled = opts?.enabled !== false;

  useEffect(() => {
    tpDiag("mat:effect", { dealerId: row.id, enabled: hydrationEnabled, actxEnabled: actx.enabled });
    if (!hydrationEnabled) return;
    if (!actx.enabled || !canActualizeClientBase(profile)) return;
    const should = shouldMaterializePrimaryTradePoint(row, actx.state);
    tpDiag("mat:should", { dealerId: row.id, should });
    if (!should) {
      setMaterialized(true);
      return;
    }
    if (attemptedDealerRef.current === row.id) return;
    attemptedDealerRef.current = row.id;

    let cancelled = false;
    setMaterializing(true);
    tpDiag("mat:run:start", { dealerId: row.id });
    void materializePrimaryTradePointIfNeeded({
      row,
      profile,
      persist: actx.persist,
    })
      .then((result) => {
        if (cancelled) return;
        tpDiag("mat:run:done", {
          dealerId: row.id,
          created: result.created,
          skipped: result.skipped,
        });
        if (result.created || result.skipped) setMaterialized(true);
        if (!result.created && !result.skipped) attemptedDealerRef.current = null;
      })
      .finally(() => {
        if (!cancelled) setMaterializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrationEnabled, actx, actx.enabled, actx.state, profile, row]);

  return { materializing, materialized };
}
