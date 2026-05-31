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
import { startOverridesPendingSyncWorker } from "@/lib/overrides-pending-sync-worker";

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
