/**
 * Старт гидрации overrides, воркера pending-sync и бэкфила при логине (Промт 113.1 / 113.4).
 */

import { useEffect, useRef } from "react";
import { hydrateAllOverridesFromServer } from "@/lib/dealer-overrides-sync";
import { runOverridesBackfillIfNeeded } from "@/lib/overrides-backfill-on-login";
import { startOverridesPendingSyncWorker } from "@/lib/overrides-pending-sync-worker";

export function OverridesSessionBootstrap({ userId }: { userId: string | undefined }): null {
  const hydrateStarted = useRef(false);

  useEffect(() => {
    startOverridesPendingSyncWorker();
  }, []);

  useEffect(() => {
    if (!userId || hydrateStarted.current) return;
    hydrateStarted.current = true;
    void (async () => {
      await hydrateAllOverridesFromServer();
      await runOverridesBackfillIfNeeded(userId);
    })();
  }, [userId]);

  return null;
}
