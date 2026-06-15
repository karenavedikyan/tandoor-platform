/**
 * Единая обработка результата strict-сохранения overrides (Промт 113.1).
 */

import { toast } from "@/hooks/use-toast";
import type { OverridesApiResult } from "@/lib/overrides-api-result";
import {
  isForbiddenOutOfScopeResult,
  OVERRIDES_FORBIDDEN_OUT_OF_SCOPE_MESSAGE,
} from "@/lib/overrides-api-result";
import { pushOverridesTrace } from "@/lib/overrides-trace-log";
import {
  dequeuePendingSync,
  enqueuePendingSync,
  makePendingId,
  type PendingSyncKind,
} from "@/lib/overrides-pending-sync";

export function showOverridesSaveFailureToast(fieldLabel: string, result?: Extract<OverridesApiResult<unknown>, { ok: false }>): void {
  if (result && isForbiddenOutOfScopeResult(result)) {
    toast({
      variant: "destructive",
      title: OVERRIDES_FORBIDDEN_OUT_OF_SCOPE_MESSAGE,
    });
    return;
  }
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
  if (isForbiddenOutOfScopeResult(result)) {
    showOverridesSaveFailureToast(opts.fieldLabel, result);
    return false;
  }
  pushOverridesTrace({
    fn: opts.pendingKind,
    stage: "enqueued",
    pendingId: opts.pendingId,
    message: result.message,
    status: result.status,
    code: result.code,
  });
  enqueuePendingSync({
    id: opts.pendingId,
    kind: opts.pendingKind,
    payload: opts.pendingPayload,
    lastError: result.message ?? (result.network ? "network" : `HTTP ${result.status ?? "?"}`),
  });
  showOverridesSaveFailureToast(opts.fieldLabel, result);
  return false;
}
