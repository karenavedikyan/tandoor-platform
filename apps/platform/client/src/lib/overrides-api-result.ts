/**
 * Общие типы Result и журнал ошибок overrides API (Промт 113.1 / 113.2).
 */

import { pushOverridesTrace } from "./overrides-trace-log.js";

export type OverridesApiOk<T> = { ok: true; data: T };
export type OverridesApiFail = {
  ok: false;
  status?: number;
  code?: string;
  message?: string;
  network?: boolean;
  body?: unknown;
};
export type OverridesApiResult<T> = OverridesApiOk<T> | OverridesApiFail;

export const OVERRIDES_FORBIDDEN_OUT_OF_SCOPE_CODE = "FORBIDDEN_OUT_OF_SCOPE";
export const OVERRIDES_FORBIDDEN_OUT_OF_SCOPE_MESSAGE = "Этот клиент вне вашей зоны ответственности";

export function isForbiddenOutOfScopeResult(result: OverridesApiFail): boolean {
  return result.code === OVERRIDES_FORBIDDEN_OUT_OF_SCOPE_CODE;
}

export const OVERRIDES_ERROR_LOG_KEY = "tandoor:overrides:error-log";
const ERROR_LOG_MAX = 50;

export type OverridesErrorLogEntry = {
  at: string;
  scope: "dealer" | "trade-point";
  action: string;
  url: string;
  status?: number;
  code?: string;
  message?: string;
  network?: boolean;
  entityId?: string;
  fields?: unknown;
  body?: unknown;
};

export function appendOverridesErrorLog(entry: Omit<OverridesErrorLogEntry, "at">): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(OVERRIDES_ERROR_LOG_KEY);
    const prev: OverridesErrorLogEntry[] = raw ? (JSON.parse(raw) as OverridesErrorLogEntry[]) : [];
    const next: OverridesErrorLogEntry[] = [{ ...entry, at: new Date().toISOString() }, ...prev].slice(
      0,
      ERROR_LOG_MAX,
    );
    window.localStorage.setItem(OVERRIDES_ERROR_LOG_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function readOverridesErrorLog(): OverridesErrorLogEntry[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw =
      window.localStorage.getItem(OVERRIDES_ERROR_LOG_KEY) ??
      window.localStorage.getItem("tandoor:overrides-error-log");
    if (!raw) return [];
    const p = JSON.parse(raw) as OverridesErrorLogEntry[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function clearOverridesErrorLog(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.removeItem(OVERRIDES_ERROR_LOG_KEY);
}

type PostOpts = {
  scope: "dealer" | "trade-point";
  action: string;
  url: string;
  entityId?: string;
  fields?: unknown;
  body: unknown;
  traceFn?: string;
};

export async function overridesApiPost<T>(opts: PostOpts): Promise<OverridesApiResult<T>> {
  const traceCtx = {
    dealerId: opts.scope === "dealer" ? opts.entityId : undefined,
    tpId: opts.scope === "trade-point" ? opts.entityId : undefined,
  };
  if (opts.traceFn) {
    pushOverridesTrace({
      fn: opts.traceFn,
      stage: "fetching",
      url: opts.url,
      method: "POST",
      ...traceCtx,
    });
  }
  try {
    const res = await fetch(opts.url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts.body),
    });
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    const data = parsed as { success?: boolean; code?: string; message?: string; data?: T };
    if (!res.ok || !data?.success) {
      if (opts.traceFn) {
        pushOverridesTrace({
          fn: opts.traceFn,
          stage: "response",
          status: res.status,
          code: data?.code,
          message: data?.message ?? `HTTP ${res.status}`,
          ...traceCtx,
        });
      }
      console.error("[overrides-api] upsert failed", {
        url: opts.url,
        status: res.status,
        body: parsed,
        entityId: opts.entityId,
        fields: opts.fields,
      });
      appendOverridesErrorLog({
        scope: opts.scope,
        action: opts.action,
        url: opts.url,
        status: res.status,
        code: data?.code,
        message: data?.message ?? `HTTP ${res.status}`,
        entityId: opts.entityId,
        fields: opts.fields,
        body: parsed,
      });
      return {
        ok: false,
        status: res.status,
        code: data?.code,
        message: data?.message ?? `HTTP ${res.status}`,
        body: parsed,
      };
    }
    if (opts.traceFn) {
      pushOverridesTrace({ fn: opts.traceFn, stage: "success", ...traceCtx });
    }
    return { ok: true, data: data.data as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (opts.traceFn) {
      pushOverridesTrace({
        fn: opts.traceFn,
        stage: "network_error",
        error: msg,
        ...traceCtx,
      });
    }
    console.error("[overrides-api] network", e);
    appendOverridesErrorLog({
      scope: opts.scope,
      action: opts.action,
      url: opts.url,
      network: true,
      message: msg,
      entityId: opts.entityId,
      fields: opts.fields,
    });
    return { ok: false, network: true, message: msg };
  }
}
