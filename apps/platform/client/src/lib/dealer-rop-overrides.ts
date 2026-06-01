/**
 * Назначение РОП на карточке дилера (overrides: rop_id + rop_name).
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getDealerRopDisplay } from "@/lib/dealer-base-mock-data";
import { saveDealerFields } from "@/lib/use-dealer-field-saver";

export const DEALER_ROP_OVERRIDES_STORAGE_KEY = "tandoor-dealer-rop-overrides-v1";
export const DEALER_ROP_OVERRIDES_EVENT = "tandoor-dealer-rop-overrides-changed";

export type RopOverride = {
  userId: string;
  displayName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type DealerRopOverridesState = {
  byDealerId: Record<string, RopOverride>;
};

function emptyState(): DealerRopOverridesState {
  return { byDealerId: {} };
}

function isoNow(): string {
  return new Date().toISOString();
}

export function loadDealerRopOverridesState(): DealerRopOverridesState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_ROP_OVERRIDES_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<DealerRopOverridesState>;
    return { byDealerId: p.byDealerId && typeof p.byDealerId === "object" ? p.byDealerId : {} };
  } catch {
    return emptyState();
  }
}

function saveState(state: DealerRopOverridesState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_ROP_OVERRIDES_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_ROP_OVERRIDES_EVENT));
}

export function getRopOverrideUserId(
  dealerId: string,
  state = loadDealerRopOverridesState(),
): string | null {
  return state.byDealerId[dealerId]?.userId?.trim() || null;
}

export function getRopOverrideDisplayName(
  dealerId: string,
  state = loadDealerRopOverridesState(),
): string {
  return state.byDealerId[dealerId]?.displayName?.trim() ?? "";
}

export function getDealerRopEffectiveDisplay(
  row: DealerRow,
  state = loadDealerRopOverridesState(),
): string {
  const name = getRopOverrideDisplayName(row.id, state);
  if (name) return name;
  return getDealerRopDisplay(row);
}

export function setDealerRopOverride(
  dealerId: string,
  nextUserId: string | null,
  nextDisplayName: string | null,
  actorUserId: string,
  actorName: string,
): void {
  const state = loadDealerRopOverridesState();
  const byDealerId = { ...state.byDealerId };

  if (!nextUserId?.trim()) {
    delete byDealerId[dealerId];
  } else {
    byDealerId[dealerId] = {
      userId: nextUserId.trim(),
      displayName: (nextDisplayName ?? nextUserId).trim(),
      updatedAt: isoNow(),
      updatedBy: actorUserId,
      updatedByName: actorName,
    };
  }

  saveState({ byDealerId });

  const rop = byDealerId[dealerId];
  void saveDealerFields(
    dealerId,
    {
      rop_id: rop?.userId ?? null,
      rop_name: rop?.displayName ?? null,
    },
    { fieldLabel: "РОП", source: "dealer-rop-overrides" },
  );
}
