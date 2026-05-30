/**
 * Рабочие правки карточки дилера (localStorage, без backend).
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import { upsertDealerOverrideStrict } from "@/lib/dealer-overrides-api";
import { handleOverridesStrictResult } from "@/lib/overrides-save-feedback";
import { makePendingId } from "@/lib/overrides-pending-sync";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";

export const DEALER_PROFILE_OVERRIDES_STORAGE_KEY = "tandoor-dealer-profile-overrides-v1";
export const DEALER_PROFILE_OVERRIDES_EVENT = "tandoor-dealer-profile-overrides-changed";

export type DealerProfileOverride = {
  displayName?: string;
  city?: string;
  mainContactName?: string;
  mainContactPhone?: string;
  mainContactEmail?: string;
  comment?: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type DealerProfileHistoryEntry = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

export type DealerProfileOverridesState = {
  overridesByDealer: Record<string, DealerProfileOverride>;
  historyByDealer: Record<string, DealerProfileHistoryEntry[]>;
};

function emptyState(): DealerProfileOverridesState {
  return { overridesByDealer: {}, historyByDealer: {} };
}

function isoNow(): string {
  return new Date().toISOString();
}

function formatMetaRu(iso: string, name: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return `${iso.trim()} · ${name}`;
  return `${m[3]}.${m[2]}.${m[1]} · ${name}`;
}

function pushHistory(state: DealerProfileOverridesState, dealerId: string, body: string, byName: string): void {
  const at = isoNow();
  const ev: DealerProfileHistoryEntry = {
    id: `dph-${dealerId}-${Date.now()}`,
    at,
    meta: formatMetaRu(at, byName),
    body,
  };
  const prev = state.historyByDealer[dealerId] ?? [];
  state.historyByDealer[dealerId] = [ev, ...prev].slice(0, 120);
}

export function loadDealerProfileOverridesState(): DealerProfileOverridesState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_PROFILE_OVERRIDES_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<DealerProfileOverridesState>;
    return {
      overridesByDealer:
        p.overridesByDealer && typeof p.overridesByDealer === "object" ? p.overridesByDealer : {},
      historyByDealer: p.historyByDealer && typeof p.historyByDealer === "object" ? p.historyByDealer : {},
    };
  } catch {
    return emptyState();
  }
}

export function saveDealerProfileOverridesState(state: DealerProfileOverridesState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_PROFILE_OVERRIDES_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_PROFILE_OVERRIDES_EVENT));
}

/** Слияние серверных оверрайдов поверх локального кеша (Промт 113). */
export function hydrateDealerProfileOverridesFromServer(
  fetched: Record<string, DealerProfileOverride>,
): void {
  const state = loadDealerProfileOverridesState();
  for (const [dealerId, row] of Object.entries(fetched)) {
    state.overridesByDealer[dealerId] = row;
  }
  saveDealerProfileOverridesState(state);
}

export function getDealerProfileOverride(
  dealerId: string,
  state: DealerProfileOverridesState = loadDealerProfileOverridesState(),
): DealerProfileOverride | undefined {
  return state.overridesByDealer[dealerId];
}

export type MergedDealerProfileView = {
  displayName: string;
  city: string;
  mainContactName: string;
  mainContactPhone: string;
  mainContactEmail: string;
  comment?: string;
};

export function getMergedDealerProfile(
  row: DealerRow,
  state: DealerProfileOverridesState = loadDealerProfileOverridesState(),
): MergedDealerProfileView {
  const o = getDealerProfileOverride(row.id, state);
  return {
    displayName: (o?.displayName ?? row.name).trim(),
    city: (o?.city ?? row.city).trim(),
    mainContactName: (o?.mainContactName ?? row.contacts.lpr).trim(),
    mainContactPhone: (o?.mainContactPhone ?? row.contacts.phone).trim(),
    mainContactEmail: (o?.mainContactEmail ?? row.contacts.email).trim(),
    comment: o?.comment?.trim() || undefined,
  };
}

export function getDealerRowWithProfileOverrides(
  row: DealerRow,
  state: DealerProfileOverridesState = loadDealerProfileOverridesState(),
): DealerRow {
  const v = getMergedDealerProfile(row, state);
  return {
    ...row,
    name: v.displayName,
    city: v.city,
    contacts: {
      ...row.contacts,
      lpr: v.mainContactName,
      phone: v.mainContactPhone,
      email: v.mainContactEmail,
    },
  };
}

export function canEditDealerProfile(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return canEditClientNextStep(profile, dealer);
}

export function updateDealerProfile(
  dealerId: string,
  patch: Partial<
    Pick<DealerProfileOverride, "displayName" | "city" | "mainContactName" | "mainContactPhone" | "mainContactEmail" | "comment">
  >,
  profile: ReleaseDemoProfile,
): void {
  const state = loadDealerProfileOverridesState();
  const now = isoNow();
  const act = { id: profile.personaUserId, name: userLabelFromProfile(profile) };
  const prev = state.overridesByDealer[dealerId] ?? {
    updatedAt: now,
    updatedBy: act.id,
    updatedByName: act.name,
  };
  const next: DealerProfileOverride = {
    ...prev,
    ...patch,
    updatedAt: now,
    updatedBy: act.id,
    updatedByName: act.name,
  };
  state.overridesByDealer[dealerId] = next;
  pushHistory(state, dealerId, "Обновлены данные дилера", act.name);
  saveDealerProfileOverridesState(state);

  const fields = {
    name: next.displayName ?? null,
    city: next.city ?? null,
    contact_name: next.mainContactName ?? null,
    contact_phone: next.mainContactPhone ?? null,
    contact_email: next.mainContactEmail ?? null,
    general_comment: next.comment ?? null,
  };
  void upsertDealerOverrideStrict(dealerId, fields).then((result) => {
    handleOverridesStrictResult(result, {
      pendingId: makePendingId("dealer-upsert", dealerId),
      pendingKind: "dealer-upsert",
      pendingPayload: { dealer_id: dealerId, fields },
      fieldLabel: "Профиль клиента",
    });
  });
}

export function getDealerProfileHistoryEvents(
  dealerId: string,
  state: DealerProfileOverridesState = loadDealerProfileOverridesState(),
): DealerProfileHistoryEntry[] {
  return [...(state.historyByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
