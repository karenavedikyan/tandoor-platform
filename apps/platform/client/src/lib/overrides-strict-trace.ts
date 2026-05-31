/**
 * Трассировка strict-вызовов overrides (Промт 113.2).
 */

import type { OverridesApiResult } from "@/lib/overrides-api-result";
import { pushOverridesTrace } from "@/lib/overrides-trace-log";

export function fieldsKeysOf(fields: unknown): string[] | undefined {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return undefined;
  return Object.keys(fields as Record<string, unknown>);
}

export function traceOverridesStrictCalled(
  fn: string,
  ctx: { dealerId?: string; tpId?: string; fields?: unknown; args?: unknown },
): void {
  const fieldsKeys = fieldsKeysOf(ctx.fields);
  const payload = { dealerId: ctx.dealerId, tpId: ctx.tpId, fieldsKeys, args: ctx.args ?? ctx };
  console.log("[overrides-strict] call", { fn, ...payload });
  pushOverridesTrace({ fn, stage: "called", ...payload });
}

export function traceOverridesStrictFetching(fn: string, url: string, method: string, ctx?: { dealerId?: string; tpId?: string }): void {
  pushOverridesTrace({ fn, stage: "fetching", url, method, ...ctx });
}

export function traceOverridesStrictFromResult(
  fn: string,
  result: OverridesApiResult<unknown>,
  ctx?: { dealerId?: string; tpId?: string; pendingId?: string },
): void {
  if (result.ok) {
    pushOverridesTrace({ fn, stage: "success", ...ctx });
    return;
  }
  if (result.network) {
    pushOverridesTrace({
      fn,
      stage: "network_error",
      error: result.message ?? "network",
      ...ctx,
    });
    return;
  }
  pushOverridesTrace({
    fn,
    stage: "response",
    status: result.status,
    code: result.code,
    message: result.message,
    ...ctx,
  });
}
