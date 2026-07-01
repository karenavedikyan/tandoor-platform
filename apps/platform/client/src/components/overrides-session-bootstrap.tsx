/**
 * Старт гидрации overrides, маршрутов, комментариев, воркера pending-sync и бэкфила при логине (Промт 113.1 / 113.4 / 114).
 */

import { useEffect, useRef } from "react";
import { hydrateAllOverridesFromServer } from "@/lib/dealer-overrides-sync";
import {
  backfillClientCommentsFromLocalStorage,
  backfillShipmentRoutesFromLocalStorage,
  runOverridesBackfillIfNeeded,
} from "@/lib/overrides-backfill-on-login";
import { hydrateShipmentRoutesFromServer, setShipmentRoutesSessionKeys } from "@/lib/dealer-shipment-route-definitions";
import { runPendingSyncUuidCleanupOnLogin } from "@/lib/overrides-pending-uuid-cleanup";
import { startOverridesPendingSyncWorker } from "@/lib/overrides-pending-sync-worker";
import { queryClient } from "@/lib/queryClient";
import {
  TRADE_POINTS_LIST_SCOPED_QUERY_KEY,
  TRADE_POINTS_SCOPED_INVALIDATE_EVENT,
} from "@/lib/trade-points-scoped-api";

export function OverridesSessionBootstrap({
  userId,
  localUserId,
}: {
  userId: string | undefined;
  localUserId: string | undefined;
}): null {
  const hydrateStarted = useRef(false);

  useEffect(() => {
    startOverridesPendingSyncWorker();
  }, []);

  useEffect(() => {
    const onScopedTpInvalidate = () => {
      void queryClient.invalidateQueries({ queryKey: TRADE_POINTS_LIST_SCOPED_QUERY_KEY });
    };
    window.addEventListener(TRADE_POINTS_SCOPED_INVALIDATE_EVENT, onScopedTpInvalidate);
    return () => window.removeEventListener(TRADE_POINTS_SCOPED_INVALIDATE_EVENT, onScopedTpInvalidate);
  }, []);

  useEffect(() => {
    if (!userId) return;
    runPendingSyncUuidCleanupOnLogin(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId || hydrateStarted.current) return;
    hydrateStarted.current = true;
    void (async () => {
      await hydrateAllOverridesFromServer();
      if (localUserId) {
        setShipmentRoutesSessionKeys(userId);
        await hydrateShipmentRoutesFromServer(userId, localUserId);
        await backfillShipmentRoutesFromLocalStorage(userId, localUserId);
      }
      await runOverridesBackfillIfNeeded(userId);
      await backfillClientCommentsFromLocalStorage(userId);
    })();
  }, [userId, localUserId]);

  return null;
}
