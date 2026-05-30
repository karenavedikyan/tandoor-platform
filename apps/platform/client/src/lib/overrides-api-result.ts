/**
 * Общие типы Result и журнал ошибок overrides API (Промт 113.1).
 */

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

export const OVERRIDES_ERROR_LOG_KEY = "tandoor:overrides-error-log";
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
    const raw = window.localStorage.getItem(OVERRIDES_ERROR_LOG_KEY);
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
};

export async function overridesApiPost<T>(opts: PostOpts): Promise<OverridesApiResult<T>> {
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
        message: data?.message,
        body: parsed,
      };
    }
    return { ok: true, data: data.data as T };
  } catch (e) {
    console.error("[overrides-api] network", e);
    appendOverridesErrorLog({
      scope: opts.scope,
      action: opts.action,
      url: opts.url,
      network: true,
      message: e instanceof Error ? e.message : String(e),
      entityId: opts.entityId,
      fields: opts.fields,
    });
    return { ok: false, network: true, message: e instanceof Error ? e.message : String(e) };
  }
}
