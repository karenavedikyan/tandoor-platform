/**
 * Компактный индикатор синхронизации состояния актуализации (foundation).
 */

import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import type { ActualizationApiMeta, ActualizationSyncStatus } from "@/lib/client-base-actualization-api";

export type ClientBaseActualizationSyncStatusProps = {
  syncStatus: ActualizationSyncStatus;
  meta: ActualizationApiMeta;
  isLoading?: boolean;
  onRetry?: () => void;
  /** Компактный вид для карточки клиента в clean-актуализации */
  compact?: boolean;
};

function formatSavedAt(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
}

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
  return "—";
}

function storageModeShort(meta: ActualizationApiMeta): string | null {
  if (meta.storageMode === "persistent") return "Postgres";
  if (meta.storageMode === "server_memory") return "Память сервера";
  if (meta.storageMode === "not_configured") return "Без сервера";
  return null;
}

export function ClientBaseActualizationSyncStatus(props: ClientBaseActualizationSyncStatusProps): ReactElement {
  const { syncStatus, meta, isLoading, onRetry, compact } = props;
  const label = statusLabel(props);
  const showOffline = syncStatus === "local_fallback";
  const showRetry = syncStatus === "error" && onRetry;
  const storageShort = storageModeShort(meta);

  if (compact) {
    return (
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-muted/25 px-2.5 py-1.5 text-xs text-muted-foreground"
        data-testid="section-client-base-actualization-sync"
      >
        <span className="font-medium text-foreground" data-testid="text-actualization-sync-status">
          {label}
        </span>
        <span className="tabular-nums" data-testid="text-actualization-last-saved-at">
          {formatSavedAt(meta.updatedAt)}
        </span>
        {storageShort && !showOffline ? (
          <span className="rounded border border-emerald-600/25 bg-emerald-600/5 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900 dark:text-emerald-100">
            {storageShort}
          </span>
        ) : null}
        {showOffline ? (
          <span className="text-amber-800 dark:text-amber-300" data-testid="text-actualization-offline-fallback">
            Локально, без синхронизации между устройствами
          </span>
        ) : null}
        {meta.message && !showOffline && !isLoading ? (
          <span className="max-w-full text-[11px] text-muted-foreground/90">{meta.message}</span>
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
      <span className="text-muted-foreground" data-testid="text-actualization-last-saved-at">
        Обновлено: {formatSavedAt(meta.updatedAt)}
      </span>
      {showOffline ? (
        <span className="text-amber-700 dark:text-amber-400" data-testid="text-actualization-offline-fallback">
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
