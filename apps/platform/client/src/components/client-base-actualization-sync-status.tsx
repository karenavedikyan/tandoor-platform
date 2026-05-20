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
  if (props.syncStatus === "api_ok" && props.meta.success) return "Сохранено";
  return "—";
}

export function ClientBaseActualizationSyncStatus(props: ClientBaseActualizationSyncStatusProps): ReactElement {
  const { syncStatus, meta, isLoading, onRetry } = props;
  const label = statusLabel(props);
  const showOffline = syncStatus === "local_fallback";
  const showRetry = syncStatus === "error" && onRetry;

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
