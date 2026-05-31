/**
 * Кольцевой буфер клиентской трассировки overrides (Промт 113.2).
 */

export const OVERRIDES_TRACE_LOG_KEY = "tandoor:overrides:trace-log";
const TRACE_LOG_MAX = 200;

export type OverridesTraceLogEntry = {
  ts: string;
  fn: string;
  stage: string;
  dealerId?: string;
  tpId?: string;
  fieldsKeys?: string[];
  url?: string;
  method?: string;
  status?: number;
  code?: string;
  message?: string;
  error?: string;
  pendingId?: string;
  field?: string;
  newValue?: unknown;
  reason?: string;
  result?: unknown;
  success?: boolean;
  args?: unknown;
  [key: string]: unknown;
};

export function pushOverridesTrace(entry: Omit<OverridesTraceLogEntry, "ts">): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(OVERRIDES_TRACE_LOG_KEY);
    const prev: OverridesTraceLogEntry[] = raw ? (JSON.parse(raw) as OverridesTraceLogEntry[]) : [];
    const row = { ...entry, ts: new Date().toISOString() } as OverridesTraceLogEntry;
    const next: OverridesTraceLogEntry[] = [row, ...prev].slice(0, TRACE_LOG_MAX);
    window.localStorage.setItem(OVERRIDES_TRACE_LOG_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function readOverridesTraceLog(): OverridesTraceLogEntry[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(OVERRIDES_TRACE_LOG_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as OverridesTraceLogEntry[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function clearOverridesTraceLog(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.removeItem(OVERRIDES_TRACE_LOG_KEY);
}

export function downloadOverridesTraceLogJson(): void {
  const data = readOverridesTraceLog();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `overrides-trace-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
