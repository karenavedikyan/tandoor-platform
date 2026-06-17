/**
 * Единая обработка результата strict-сохранения overrides (Промт 113.1).
 */

import { toast } from "../hooks/use-toast.js";
import type { OverridesApiResult } from "./overrides-api-result.js";
import {
  isForbiddenOutOfScopeResult,
  OVERRIDES_FORBIDDEN_OUT_OF_SCOPE_MESSAGE,
} from "./overrides-api-result.js";
import { pushOverridesTrace } from "./overrides-trace-log.js";
import {
  dequeuePendingSync,
  enqueuePendingSync,
  makePendingId,
  type PendingSyncKind,
} from "./overrides-pending-sync.js";

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
