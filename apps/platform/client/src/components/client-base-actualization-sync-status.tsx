/**
 * Компактный индикатор синхронизации состояния актуализации (foundation).
 */

import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import type { ActualizationApiMeta, ActualizationSyncStatus } from "@/lib/client-base-actualization-api";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/use-auth-user";
import { DealerTpOverridesSyncStatus } from "@/components/dealer-tp-overrides-sync-status";

export type ClientBaseActualizationSyncStatusProps = {
  syncStatus: ActualizationSyncStatus;
  meta: ActualizationApiMeta;
  isLoading?: boolean;
  onRetry?: () => void;
  /** Компактный вид для карточки клиента в clean-актуализации */
  compact?: boolean;
  /** actualization-blob — legacy канал; dealer-tp-overrides — поля промта 113 */
  scope?: "actualization-blob" | "dealer-tp-overrides";
  dealerId?: string;
  tpId?: string;
};

function statusLabel(props: ClientBaseActualizationSyncStatusProps): string {
  if (props.isLoading) return "Сохраняем…";
  if (props.syncStatus === "error") return "Ошибка сохранения";
  if (props.syncStatus === "local_fallback") return "Работает локально, синхронизация недоступна";
  if (props.meta.storageMode === "not_configured") return "Серверное хранение не настроено";
  if (props.syncStatus === "api_ok" && props.meta.success) {
    if (props.meta.storageMode === "persistent") return "Сохранено";
    if (props.meta.storageMode === "server_memory") {
      return props.compact
        ? "Сохранено (временное хранение)"
        : "Временное серверное хранение, синхронизация между устройствами не гарантирована";
    }
    return "Сохранено";
  }
  return "Не указано";
}

function storageModeShort(meta: ActualizationApiMeta): string | null {
  if (meta.storageMode === "persistent") return "Postgres";
  if (meta.storageMode === "server_memory") return "Память сервера";
  if (meta.storageMode === "not_configured") return "Без сервера";
  return null;
}

export function ClientBaseActualizationSyncStatus(props: ClientBaseActualizationSyncStatusProps): ReactElement {
  const scope = props.scope ?? "actualization-blob";
  if (scope === "dealer-tp-overrides") {
    return (
      <DealerTpOverridesSyncStatus
        dealerId={props.dealerId}
        tpId={props.tpId}
        compact={props.compact}
      />
    );
  }

  const { syncStatus, meta, isLoading, onRetry, compact } = props;
  const { user } = useAuthUser();
  const showStorageLabel = user?.role === "admin" || user?.role === "director";
  const label = statusLabel(props);
  const showOffline = syncStatus === "local_fallback";
  const showRetry = syncStatus === "error" && onRetry;
  // Промт 47: технический ярлычок «Postgres / Память сервера» оставляем только для admin/director.
  const storageShort = showStorageLabel ? storageModeShort(meta) : null;
  const savedAtLabel = meta.updatedAt?.trim() ? formatDisplayDateTime(meta.updatedAt) : null;

  if (compact) {
    return (
      <div
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-[11px] leading-tight text-muted-foreground"
        data-testid="section-client-base-actualization-sync"
      >
        <span className="font-medium text-foreground" data-testid="text-actualization-sync-status">
          {label}
        </span>
        {meta.updatedAt?.trim() ? (
          <span className="tabular-nums text-muted-foreground/90" data-testid="text-actualization-last-saved-at">
            {formatDisplayDateTime(meta.updatedAt)}
          </span>
        ) : null}
        {storageShort && !showOffline ? (
          <span className="rounded border border-border/50 bg-background/80 px-1 py-0 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {storageShort}
          </span>
        ) : null}
        {showOffline ? (
          <span className="text-[10px] text-muted-foreground" data-testid="text-actualization-offline-fallback">
            Локально, без синхронизации между устройствами
          </span>
        ) : null}
        {meta.message && !showOffline && !isLoading ? (
          <span className="w-full max-w-full text-[10px] leading-snug text-muted-foreground/85">{meta.message}</span>
        ) : null}
        {showRetry ? (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onRetry} data-testid="button-actualization-sync-retry">
            Повторить
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
      data-testid="section-client-base-actualization-sync"
    >
      <span className="text-muted-foreground">Актуализация:</span>
      <span className="font-medium text-foreground" data-testid="text-actualization-sync-status">
        {label}
      </span>
      <span className={cn("text-muted-foreground", savedAtLabel && savedAtLabel !== "Не указано" && "tabular-nums")} data-testid="text-actualization-last-saved-at">
        Обновлено: {savedAtLabel ?? "Не указано"}
      </span>
      {showOffline ? (
        <span className="text-muted-foreground" data-testid="text-actualization-offline-fallback">
          Локальный режим без кросс-девайс синхронизации
        </span>
      ) : null}
      {meta.message && !showOffline && !isLoading ? (
        <span className="max-w-[28rem] text-xs text-muted-foreground">{meta.message}</span>
      ) : null}
      {showRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} data-testid="button-actualization-sync-retry">
          Повторить
        </Button>
      ) : null}
    </div>
  );
}
