/**
 * Порядок выгрузки клиента (localStorage-кеш + Postgres, Промт 113 / 114).
 */

import { upsertDealerOverrideStrict } from "./dealer-overrides-api.js";
import { getDbUnloadingOrderOverride, patchDealerUnloadingOrderRuntime } from "./dealer-overrides-runtime.js";
import { handleOverridesStrictResult } from "./overrides-save-feedback.js";
import { makePendingId } from "./overrides-pending-sync.js";
import { saveDealerField } from "./use-dealer-field-saver.js";

export const DEALER_UNLOADING_ORDER_STORAGE_KEY = "tandoor-dealer-unloading-order-v1";
export const DEALER_UNLOADING_ORDER_EVENT = "tandoor-dealer-unloading-order-changed";

type OrderMap = Record<string, number>;

type HistoryEntry = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

type State = {
  orderByDealer: OrderMap;
  historyByDealer: Record<string, HistoryEntry[]>;
};

function emptyState(): State {
  return { orderByDealer: {}, historyByDealer: {} };
}

function isoNow(): string {
  return new Date().toISOString();
}

function formatMetaRu(iso: string, actor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return `${iso.trim()} · ${actor}`;
  return `${m[3]}.${m[2]}.${m[1]} · ${actor}`;
}

export function loadDealerUnloadingOrderState(): State {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_UNLOADING_ORDER_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<State>;
    const orderByDealer =
      p.orderByDealer && typeof p.orderByDealer === "object" ? (p.orderByDealer as OrderMap) : {};
    const historyByDealer =
      p.historyByDealer && typeof p.historyByDealer === "object" ? p.historyByDealer : {};
    return { orderByDealer, historyByDealer };
  } catch {
    return emptyState();
  }
}

function saveState(state: State): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_UNLOADING_ORDER_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_UNLOADING_ORDER_EVENT));
}

export function getDealerUnloadingOrder(dealerId: string, state = loadDealerUnloadingOrderState()): number | null {
  const fromDb = getDbUnloadingOrderOverride(dealerId);
  if (fromDb != null) return fromDb;
  const v = state.orderByDealer[dealerId];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
}

export async function setDealerUnloadingOrder(
  dealerId: string,
  next: number | null,
  actorUserId: string,
  actorLabel: string,
): Promise<void> {
  const state = loadDealerUnloadingOrderState();
  const prev = getDealerUnloadingOrder(dealerId, state);
  const orderByDealer = { ...state.orderByDealer };
  if (next == null || !Number.isFinite(next) || next <= 0) {
    delete orderByDealer[dealerId];
  } else {
    orderByDealer[dealerId] = Math.floor(next);
  }
  const at = isoNow();
  const body =
    prev == null && (next == null || next <= 0)
      ? ""
      : prev == null
        ? `Изменён порядок выгрузки: было не указано, стало ${next}.`
        : next == null || next <= 0
          ? `Изменён порядок выгрузки: было ${prev}, снято значение.`
          : `Изменён порядок выгрузки: было ${prev}, стало ${next}.`;

  const historyByDealer = { ...state.historyByDealer };
  if (body) {
    const ev: HistoryEntry = {
      id: `uo-${dealerId}-${Date.now()}`,
      at,
      meta: formatMetaRu(at, actorLabel || actorUserId || "Пользователь"),
      body,
    };
    const h = [...(historyByDealer[dealerId] ?? [])];
    h.unshift(ev);
    historyByDealer[dealerId] = h.slice(0, 80);
  }

  saveState({ orderByDealer, historyByDealer });

  const value = next != null && next > 0 ? String(Math.floor(next)) : null;
  patchDealerUnloadingOrderRuntime(dealerId, next != null && next > 0 ? Math.floor(next) : null);

  const strictResult = await upsertDealerOverrideStrict(dealerId, { unloading_order: value });
  if (
    !handleOverridesStrictResult(strictResult, {
      pendingId: makePendingId("dealer-upsert", `${dealerId}:unloading_order`),
      pendingKind: "dealer-upsert",
      pendingPayload: { dealer_id: dealerId, fields: { unloading_order: value } },
      fieldLabel: "Порядок выгрузки",
    })
  ) {
    /* pending queued */
  }

  void saveDealerField(dealerId, "unloading_order", value, {
    fieldLabel: "Порядок выгрузки",
    source: "dealer-unloading-order-storage",
  });
}

export function hydrateDealerUnloadingOrderFromServer(orderByDealer: Record<string, number>): void {
  const state = loadDealerUnloadingOrderState();
  for (const [dealerId, order] of Object.entries(orderByDealer)) {
    if (typeof order === "number" && order > 0) {
      state.orderByDealer[dealerId] = order;
      patchDealerUnloadingOrderRuntime(dealerId, order);
    }
  }
  saveState(state);
}

export function getDealerUnloadingOrderHistoryEvents(
  dealerId: string,
  state = loadDealerUnloadingOrderState(),
): HistoryEntry[] {
  return [...(state.historyByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
