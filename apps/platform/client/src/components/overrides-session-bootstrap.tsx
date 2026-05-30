/**
 * Старт воркера pending-sync и бэкфила при логине (Промт 113.1).
 */

import { useEffect, useRef } from "react";
import { runOverridesBackfillIfNeeded } from "@/lib/overrides-backfill-on-login";
import { startOverridesPendingSyncWorker } from "@/lib/overrides-pending-sync-worker";

export function OverridesSessionBootstrap({ userId }: { userId: string | undefined }): null {
  const started = useRef(false);

  useEffect(() => {
    startOverridesPendingSyncWorker();
  }, []);

  useEffect(() => {
    if (!userId || started.current) return;
    started.current = true;
    void runOverridesBackfillIfNeeded(userId);
  }, [userId]);

  return null;
}
