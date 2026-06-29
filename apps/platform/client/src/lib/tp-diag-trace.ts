/**
 * Временная трассировка блока «Торговые точки» (диагностика на мобильном).
 * Включение: ?tpdiag=1 в URL или localStorage tp-diag=1.
 */

export const TP_DIAG_EVENT = "tp-diag";
export const TP_DIAG_STORAGE_KEY = "tp-diag";

export type TpDiagEntry = {
  t: number;
  tag: string;
  data?: Record<string, unknown>;
};

const MAX_ENTRIES = 50;
const DISPLAY_ENTRIES = 20;

let originMs: number | null = null;
const buffer: TpDiagEntry[] = [];

function ensureOrigin(): number {
  if (originMs == null) originMs = Date.now();
  return originMs;
}

/** Включена ли диагностика (URL ?tpdiag=1 или localStorage). */
export function isTpDiagEnabled(): boolean {
  const w = typeof globalThis !== "undefined" ? globalThis.window : undefined;
  if (!w) return false;
  try {
    if (w.localStorage.getItem(TP_DIAG_STORAGE_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  try {
    const q = new URLSearchParams(w.location?.search ?? "");
    if (q.get("tpdiag") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Записать событие (no-op если диагностика выключена). */
export function tpDiag(tag: string, data?: Record<string, unknown>): void {
  if (!isTpDiagEnabled()) return;
  const entry: TpDiagEntry = {
    t: Date.now() - ensureOrigin(),
    tag,
    data: data && Object.keys(data).length > 0 ? data : undefined,
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES);
  const w = globalThis.window;
  if (w) {
    w.dispatchEvent(new CustomEvent(TP_DIAG_EVENT, { detail: entry }));
  }
}

/** Последние записи для панели (новые первыми). */
export function getTpDiag(limit = DISPLAY_ENTRIES): TpDiagEntry[] {
  return buffer.slice(-limit).reverse();
}

/** Очистить буфер и сбросить таймер. */
export function clearTpDiag(): void {
  buffer.length = 0;
  originMs = null;
  const w = globalThis.window;
  if (w) {
    w.dispatchEvent(new CustomEvent(TP_DIAG_EVENT, { detail: null }));
  }
}

export function formatTpDiagData(data?: Record<string, unknown>): string {
  if (!data) return "";
  return Object.entries(data)
    .map(([k, v]) => {
      if (v === null || v === undefined) return `${k}=`;
      if (typeof v === "object") return `${k}=${JSON.stringify(v)}`;
      return `${k}=${String(v)}`;
    })
    .join(" ");
}
