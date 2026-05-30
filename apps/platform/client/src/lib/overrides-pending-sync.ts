/**
 * Очередь отложенной синхронизации overrides (Промт 113.1).
 */

export type PendingSyncKind =
  | "dealer-upsert"
  | "tp-upsert"
  | "dealer-training"
  | "tp-training"
  | "dealer-trash"
  | "dealer-untrash"
  | "tp-trash"
  | "tp-untrash"
  | "manual-dealer";

export type PendingSyncItem = {
  id: string;
  kind: PendingSyncKind;
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type PendingSyncState = {
  items: PendingSyncItem[];
};

export const OVERRIDES_PENDING_STORAGE_KEY = "tandoor:overrides:pending-v1";
export const OVERRIDES_PENDING_CHANGED_EVENT = "tandoor:overrides-pending-changed";

const HOURLY_LOG_MS = 60 * 60 * 1000;
const lastHourlyLogById = new Map<string, number>();

function emptyState(): PendingSyncState {
  return { items: [] };
}

function loadState(): PendingSyncState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(OVERRIDES_PENDING_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<PendingSyncState>;
    return { items: Array.isArray(p.items) ? p.items : [] };
  } catch {
    return emptyState();
  }
}

function saveState(state: PendingSyncState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(OVERRIDES_PENDING_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(OVERRIDES_PENDING_CHANGED_EVENT));
}

export function listPendingSyncItems(): PendingSyncItem[] {
  return [...loadState().items];
}

export function pendingSyncCount(): number {
  return loadState().items.length;
}

export function enqueuePendingSync(item: Omit<PendingSyncItem, "createdAt" | "attempts"> & { createdAt?: number; attempts?: number }): void {
  const state = loadState();
  const existing = state.items.find((x) => x.id === item.id);
  if (existing) {
    existing.payload = item.payload;
    existing.lastError = item.lastError;
  } else {
    state.items.push({
      ...item,
      createdAt: item.createdAt ?? Date.now(),
      attempts: item.attempts ?? 0,
    });
  }
  saveState(state);
}

export function dequeuePendingSync(id: string): void {
  const state = loadState();
  state.items = state.items.filter((x) => x.id !== id);
  saveState(state);
}

export function markPendingSyncFailed(id: string, err: string): void {
  const state = loadState();
  const item = state.items.find((x) => x.id === id);
  if (!item) return;
  item.attempts += 1;
  item.lastError = err;
  saveState(state);
  if (item.attempts > 5) {
    const last = lastHourlyLogById.get(id) ?? 0;
    if (Date.now() - last > HOURLY_LOG_MS) {
      console.warn("[overrides-pending-sync] item exceeded 5 attempts", id, err);
      lastHourlyLogById.set(id, Date.now());
    }
  }
}

export function listPendingForDealer(dealerId: string): PendingSyncItem[] {
  return loadState().items.filter((item) => {
    const p = item.payload as Record<string, unknown> | undefined;
    if (!p) return false;
    if (item.kind.startsWith("dealer-") || item.kind === "manual-dealer") {
      return String(p.dealer_id ?? p.dealerId ?? "") === dealerId;
    }
    if (item.kind === "tp-upsert" || item.kind.startsWith("tp-")) {
      return String(p.dealer_id ?? "") === dealerId;
    }
    return false;
  });
}

export function listPendingForTp(tpId: string): PendingSyncItem[] {
  return loadState().items.filter((item) => {
    const p = item.payload as Record<string, unknown> | undefined;
    if (!p) return false;
    return String(p.tp_id ?? p.tpId ?? "") === tpId;
  });
}

export function pendingStatusForEntity(opts: { dealerId?: string; tpId?: string }): "saved" | "pending" | "error" {
  const items = opts.tpId
    ? listPendingForTp(opts.tpId)
    : opts.dealerId
      ? listPendingForDealer(opts.dealerId)
      : [];
  if (items.length === 0) return "saved";
  if (items.some((i) => i.attempts > 3)) return "error";
  return "pending";
}

export function makePendingId(kind: PendingSyncKind, entityKey: string): string {
  return `${kind}:${entityKey}`;
}
