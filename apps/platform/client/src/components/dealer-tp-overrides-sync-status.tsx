/**
 * Статус синхронизации полей overrides дилера/ТТ (Промт 113.1).
 */

import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listPendingForDealer,
  listPendingForTp,
  OVERRIDES_PENDING_CHANGED_EVENT,
  pendingStatusForEntity,
} from "@/lib/overrides-pending-sync";
import { runOverridesPendingSyncOnce } from "@/lib/overrides-pending-sync-worker";

export type DealerTpOverridesSyncStatusProps = {
  dealerId?: string;
  tpId?: string;
  compact?: boolean;
  className?: string;
};

export function DealerTpOverridesSyncStatus({
  dealerId,
  tpId,
  compact,
  className,
}: DealerTpOverridesSyncStatusProps): ReactElement {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    window.addEventListener(OVERRIDES_PENDING_CHANGED_EVENT, fn);
    return () => window.removeEventListener(OVERRIDES_PENDING_CHANGED_EVENT, fn);
  }, []);

  const status = pendingStatusForEntity({ dealerId, tpId });
  const pendingItems = tpId ? listPendingForTp(tpId) : dealerId ? listPendingForDealer(dealerId) : [];

  let label = "Сохранено в облаке";
  let tone: "saved" | "pending" | "error" = "saved";
  if (status === "pending") {
    label = "Сохраняем…";
    tone = "pending";
  } else if (status === "error") {
    label = "Ошибка сохранения";
    tone = "error";
  }

  const showRetry = tone === "error" && pendingItems.length > 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        compact
          ? "rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground"
          : "rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm",
        className,
      )}
      data-testid="section-dealer-tp-overrides-sync"
    >
      <span
        className={cn(
          "inline-flex h-2 w-2 shrink-0 rounded-full",
          tone === "saved" && "bg-emerald-500",
          tone === "pending" && "bg-amber-500",
          tone === "error" && "bg-red-500",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "font-medium",
          tone === "saved" && "text-emerald-800 dark:text-emerald-200",
          tone === "pending" && "text-amber-900 dark:text-amber-200",
          tone === "error" && "text-red-800 dark:text-red-200",
        )}
        data-testid="text-dealer-tp-overrides-sync-status"
      >
        {label}
      </span>
      {showRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={compact ? "h-7 text-xs" : ""}
          data-testid="button-dealer-tp-overrides-retry"
          onClick={() => void runOverridesPendingSyncOnce()}
        >
          Повторить
        </Button>
      ) : null}
    </div>
  );
}
