/**
 * Назначение ответственного регионального менеджера (MVP: localStorage, отдельно от РОП и менеджера).
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getDealerRegionalManagerDisplay } from "@/lib/dealer-base-mock-data";
import { upsertDealerOverrideStrict } from "@/lib/dealer-overrides-api";
import { handleOverridesStrictResult } from "@/lib/overrides-save-feedback";
import { makePendingId } from "@/lib/overrides-pending-sync";
import { getSalesUserById, SALES_USERS } from "@/lib/sales-control-data";

export const DEALER_REGIONAL_MANAGER_OVERRIDES_STORAGE_KEY = "tandoor-dealer-regional-manager-overrides-v1";
export const DEALER_REGIONAL_MANAGER_OVERRIDES_EVENT = "tandoor-dealer-regional-manager-overrides-changed";

export type RegionalManagerOverride = {
  /** id из SALES_USERS */
  userId: string;
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
  const uid = state.byDealerId[dealerId]?.userId?.trim();
  if (!uid) return null;
  return getSalesUserById(uid) ? uid : null;
}

/** Список сотрудников для выбора (mock-справочник). */
export function listRegionalManagerPickerUsers(): { id: string; name: string; roleLabel: string }[] {
  const roleLabel: Record<string, string> = {
    sales_director: "Руководитель продаж",
    team_lead: "Руководитель команды",
    sales_manager: "Менеджер",
    marketer: "Маркетолог",
    analyst: "Аналитик",
  };
  return [...SALES_USERS]
    .map((u) => ({
      id: u.id,
      name: u.name,
      roleLabel: roleLabel[u.role] ?? u.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));
}

/** Итоговая подпись: override (по id сотрудника) или данные строки клиента. */
export function getDealerRegionalManagerEffectiveDisplay(
  row: DealerRow,
  state = loadDealerRegionalManagerOverridesState(),
): string {
  const uid = getRegionalManagerOverrideUserId(row.id, state);
  if (uid) {
    const u = getSalesUserById(uid);
    if (u?.name?.trim()) return u.name.trim();
  }
  return getDealerRegionalManagerDisplay(row);
}

export function setDealerRegionalManagerOverride(
  dealerId: string,
  nextUserId: string | null,
  actorUserId: string,
  actorName: string,
): void {
  const state = loadDealerRegionalManagerOverridesState();
  const byDealerId = { ...state.byDealerId };
  const historyByDealer = { ...state.historyByDealer };
  const nextState: DealerRegionalManagerOverridesState = { byDealerId, historyByDealer };

  const prevUid = state.byDealerId[dealerId]?.userId ?? null;
  const prevName = prevUid ? getSalesUserById(prevUid)?.name?.trim() ?? prevUid : "";

  if (!nextUserId || !getSalesUserById(nextUserId)) {
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
    const nextName = getSalesUserById(nextUserId)?.name?.trim() ?? nextUserId;
    byDealerId[dealerId] = {
      userId: nextUserId,
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
  const fields = {
    regional_manager_id: rm?.userId ?? null,
    regional_manager_name: rm ? getSalesUserById(rm.userId)?.name?.trim() ?? rm.userId : null,
  };
  void upsertDealerOverrideStrict(dealerId, fields).then((result) => {
    handleOverridesStrictResult(result, {
      pendingId: makePendingId("dealer-upsert", dealerId),
      pendingKind: "dealer-upsert",
      pendingPayload: { dealer_id: dealerId, fields },
      fieldLabel: "Региональный менеджер",
    });
  });
}

export function getDealerRegionalManagerHistoryEvents(
  dealerId: string,
  state = loadDealerRegionalManagerOverridesState(),
): RegionalManagerHistoryEntry[] {
  return [...(state.historyByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
