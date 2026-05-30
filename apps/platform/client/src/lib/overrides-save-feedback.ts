/**
 * Единая обработка результата strict-сохранения overrides (Промт 113.1).
 */

import { toast } from "@/hooks/use-toast";
import type { OverridesApiResult } from "@/lib/overrides-api-result";
import {
  dequeuePendingSync,
  enqueuePendingSync,
  makePendingId,
  type PendingSyncKind,
} from "@/lib/overrides-pending-sync";

export function showOverridesSaveFailureToast(fieldLabel: string): void {
  toast({
    variant: "destructive",
    title: `Не удалось сохранить изменение поля «${fieldLabel}»`,
    description: "Попробуем ещё раз автоматически.",
  });
}

export function handleOverridesStrictResult(
  result: OverridesApiResult<unknown>,
  opts: {
    pendingId: string;
    pendingKind: PendingSyncKind;
    pendingPayload: unknown;
    fieldLabel: string;
  },
): boolean {
  if (result.ok) {
    dequeuePendingSync(opts.pendingId);
    return true;
  }
  enqueuePendingSync({
    id: opts.pendingId,
    kind: opts.pendingKind,
    payload: opts.pendingPayload,
    lastError: result.message ?? (result.network ? "network" : `HTTP ${result.status ?? "?"}`),
  });
  showOverridesSaveFailureToast(opts.fieldLabel);
  return false;
}
