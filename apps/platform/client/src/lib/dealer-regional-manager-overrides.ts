/**
 * Назначение регионального менеджера на карточке дилера (overrides: regional_manager_id + name).
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getDealerRegionalManagerDisplay } from "@/lib/dealer-base-mock-data";
import { saveDealerFields } from "@/lib/use-dealer-field-saver";

export const DEALER_REGIONAL_MANAGER_OVERRIDES_STORAGE_KEY = "tandoor-dealer-regional-manager-overrides-v1";
export const DEALER_REGIONAL_MANAGER_OVERRIDES_EVENT = "tandoor-dealer-regional-manager-overrides-changed";

export type RegionalManagerOverride = {
  userId: string;
  displayName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type RegionalManagerHistoryEntry = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

export type DealerRegionalManagerOverridesState = {
  byDealerId: Record<string, RegionalManagerOverride>;
  historyByDealer: Record<string, RegionalManagerHistoryEntry[]>;
};

function emptyState(): DealerRegionalManagerOverridesState {
  return { byDealerId: {}, historyByDealer: {} };
}

function isoNow(): string {
  return new Date().toISOString();
}

function formatMetaRu(iso: string, actor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return `${iso.trim()} · ${actor}`;
  return `${m[3]}.${m[2]}.${m[1]} · ${actor}`;
}

function pushHistory(state: DealerRegionalManagerOverridesState, dealerId: string, body: string, byName: string): void {
  const at = isoNow();
  const ev: RegionalManagerHistoryEntry = {
    id: `drm-${dealerId}-${Date.now()}`,
    at,
    meta: formatMetaRu(at, byName),
    body,
  };
  const prev = state.historyByDealer[dealerId] ?? [];
  state.historyByDealer[dealerId] = [ev, ...prev].slice(0, 120);
}

export function loadDealerRegionalManagerOverridesState(): DealerRegionalManagerOverridesState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_REGIONAL_MANAGER_OVERRIDES_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<DealerRegionalManagerOverridesState>;
    return {
      byDealerId: p.byDealerId && typeof p.byDealerId === "object" ? p.byDealerId : {},
      historyByDealer: p.historyByDealer && typeof p.historyByDealer === "object" ? p.historyByDealer : {},
    };
  } catch {
    return emptyState();
  }
}

function saveState(state: DealerRegionalManagerOverridesState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_REGIONAL_MANAGER_OVERRIDES_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_REGIONAL_MANAGER_OVERRIDES_EVENT));
}

export function getRegionalManagerOverrideUserId(
  dealerId: string,
  state = loadDealerRegionalManagerOverridesState(),
): string | null {
  return state.byDealerId[dealerId]?.userId?.trim() || null;
}

export function getRegionalManagerOverrideDisplayName(
  dealerId: string,
  state = loadDealerRegionalManagerOverridesState(),
): string {
  return state.byDealerId[dealerId]?.displayName?.trim() ?? "";
}

/** @deprecated Используйте listRegionalManagerPickerUsers из users-picker-api */
export function listRegionalManagerPickerUsers(): { id: string; name: string; roleLabel: string }[] {
  return [];
}

/** Итоговая подпись: override или данные строки клиента. */
export function getDealerRegionalManagerEffectiveDisplay(
  row: DealerRow,
  state = loadDealerRegionalManagerOverridesState(),
): string {
  const name = getRegionalManagerOverrideDisplayName(row.id, state);
  if (name) return name;
  return getDealerRegionalManagerDisplay(row);
}

export function setDealerRegionalManagerOverride(
  dealerId: string,
  nextUserId: string | null,
  nextDisplayName: string | null,
  actorUserId: string,
  actorName: string,
): void {
  const state = loadDealerRegionalManagerOverridesState();
  const byDealerId = { ...state.byDealerId };
  const historyByDealer = { ...state.historyByDealer };
  const nextState: DealerRegionalManagerOverridesState = { byDealerId, historyByDealer };

  const prevUid = state.byDealerId[dealerId]?.userId ?? null;
  const prevName = state.byDealerId[dealerId]?.displayName?.trim() ?? "";

  if (!nextUserId?.trim()) {
    delete byDealerId[dealerId];
    if (prevUid) {
      pushHistory(
        nextState,
        dealerId,
        prevName ? `Сброшен региональный менеджер (было: ${prevName})` : "Сброшен региональный менеджер",
        actorName,
      );
    }
  } else {
    const nextName = (nextDisplayName ?? nextUserId).trim();
    byDealerId[dealerId] = {
      userId: nextUserId.trim(),
      displayName: nextName,
      updatedAt: isoNow(),
      updatedBy: actorUserId,
      updatedByName: actorName,
    };
    const body =
      prevUid && prevUid !== nextUserId
        ? `Изменён региональный менеджер: ${prevName} → ${nextName}`
        : `Назначен региональный менеджер: ${nextName}`;
    pushHistory(nextState, dealerId, body, actorName);
  }

  saveState(nextState);

  const rm = byDealerId[dealerId];
  void saveDealerFields(
    dealerId,
    {
      regional_manager_id: rm?.userId ?? null,
      regional_manager_name: rm?.displayName ?? null,
    },
    { fieldLabel: "Региональный менеджер", source: "dealer-regional-manager-overrides" },
  );
}

export function getDealerRegionalManagerHistoryEvents(
  dealerId: string,
  state = loadDealerRegionalManagerOverridesState(),
): RegionalManagerHistoryEntry[] {
  return [...(state.historyByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
