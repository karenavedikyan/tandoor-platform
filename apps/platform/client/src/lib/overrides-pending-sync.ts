/**
 * Очередь отложенной синхронизации overrides (Промт 113.1 / 114.4).
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
  | "manual-dealer"
  | "shipment-routes-upsert"
  | "shipment-routes-delete"
  | "client-comments-create"
  | "showcase-matrix-upsert"
  | "showcase-matrix-catalog-upsert"
  | "showcase-matrix-catalog-set-status"
  | "showcase-matrix-catalog-delete"
  | "showcase-matrix-catalog-replace-models";

export type PendingSyncItem = {
  id: string;
  kind: PendingSyncKind;
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
  /** Не ретраить (400 / UUID / 5+ одинаковых ошибок). */
  dead?: boolean;
};

export type PendingSyncState = {
  items: PendingSyncItem[];
};

export const OVERRIDES_PENDING_STORAGE_KEY = "tandoor:overrides:pending-v1";
export const OVERRIDES_PENDING_CHANGED_EVENT = "tandoor:overrides-pending-changed";

const HOURLY_LOG_MS = 60 * 60 * 1000;
const DEAD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
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

export function listPendingSyncItems(opts?: { includeDead?: boolean }): PendingSyncItem[] {
  const items = [...loadState().items];
  if (opts?.includeDead) return items;
  return items.filter((x) => !x.dead);
}

export function listAllPendingSyncItems(): PendingSyncItem[] {
  return listPendingSyncItems({ includeDead: true });
}

export function pendingSyncCount(): number {
  return listPendingSyncItems().length;
}

export function enqueuePendingSync(item: Omit<PendingSyncItem, "createdAt" | "attempts"> & { createdAt?: number; attempts?: number }): void {
  const state = loadState();
  const existing = state.items.find((x) => x.id === item.id);
  if (existing) {
    existing.payload = item.payload;
    existing.lastError = item.lastError;
    if (item.dead) existing.dead = true;
  } else {
    state.items.push({
      ...item,
      createdAt: item.createdAt ?? Date.now(),
      attempts: item.attempts ?? 0,
      dead: item.dead ?? false,
    });
  }
  saveState(state);
}

export function dequeuePendingSync(id: string): void {
  const state = loadState();
  state.items = state.items.filter((x) => x.id !== id);
  saveState(state);
}

export function markPendingSyncDead(id: string, err: string): void {
  const state = loadState();
  const item = state.items.find((x) => x.id === id);
  if (!item) return;
  item.dead = true;
  item.lastError = err;
  saveState(state);
  console.warn("[overrides-pending-sync] marked dead", id, err);
}

function isPermanentClientError(err: string): boolean {
  const lower = err.toLowerCase();
  return (
    lower.includes("invalid input syntax for type uuid") ||
    lower.includes("invalid_uuid_field") ||
    lower.includes("http 400")
  );
}

export function markPendingSyncFailed(id: string, err: string): void {
  const state = loadState();
  const item = state.items.find((x) => x.id === id);
  if (!item) return;
  const prevErr = item.lastError;
  item.attempts += 1;
  item.lastError = err;

  if (isPermanentClientError(err)) {
    item.dead = true;
  } else if (item.attempts >= MAX_ATTEMPTS && prevErr === err) {
    item.dead = true;
  }

  saveState(state);

  if (item.dead) {
    console.warn("[overrides-pending-sync] item dead after failures", id, err);
    return;
  }

  if (item.attempts > MAX_ATTEMPTS) {
    const last = lastHourlyLogById.get(id) ?? 0;
    if (Date.now() - last > HOURLY_LOG_MS) {
      console.warn("[overrides-pending-sync] item exceeded 5 attempts", id, err);
      lastHourlyLogById.set(id, Date.now());
    }
  }
}

/** Удалить dead-записи старше 7 дней. */
export function purgeStaleDeadPendingSync(): number {
  const state = loadState();
  const cutoff = Date.now() - DEAD_RETENTION_MS;
  const before = state.items.length;
  state.items = state.items.filter((x) => !x.dead || x.createdAt >= cutoff);
  const removed = before - state.items.length;
  if (removed > 0) saveState(state);
  return removed;
}

/** Удалить записи с UUID-ошибками (one-shot / health cleanup). */
export function removePendingSyncWithUuidErrors(): number {
  const state = loadState();
  const before = state.items.length;
  state.items = state.items.filter((item) => {
    if (item.lastError && isPermanentClientError(item.lastError)) return false;
    const p = item.payload as Record<string, unknown> | undefined;
    const fields = (p?.fields ?? {}) as Record<string, unknown>;
    for (const [key, val] of Object.entries(fields)) {
      if (!key.endsWith("_id") || val == null) continue;
      const s = String(val).trim();
      if (!s) continue;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) && s.startsWith("mgr-")) {
        return false;
      }
    }
    return true;
  });
  const removed = before - state.items.length;
  if (removed > 0) saveState(state);
  return removed;
}

export function clearPendingSyncForDealers(dealerIds: string[]): number {
  const set = new Set(dealerIds);
  const state = loadState();
  const before = state.items.length;
  state.items = state.items.filter((item) => {
    const p = item.payload as Record<string, unknown> | undefined;
    if (!p) return true;
    const dealerId = String(p.dealer_id ?? p.dealerId ?? "");
    return !set.has(dealerId);
  });
  const removed = before - state.items.length;
  if (removed > 0) saveState(state);
  return removed;
}

export function listPendingForDealer(dealerId: string): PendingSyncItem[] {
  return listPendingSyncItems().filter((item) => {
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
  return listPendingSyncItems().filter((item) => {
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
  if (items.some((i) => i.dead || i.attempts > 3)) return "error";
  return "pending";
}

export function makePendingId(kind: PendingSyncKind, entityKey: string): string {
  return `${kind}:${entityKey}`;
}
