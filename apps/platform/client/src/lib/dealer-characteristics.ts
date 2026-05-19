/**
 * Редактируемые характеристики клиента (да / нет + примечание).
 * Хранится в localStorage, без backend. Подменяет рабочие признаки склада и
 * программ (спецусловия, Tandoor Club, кешбек агента) на странице карточки и в дилерской базе.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";

export const DEALER_CHARACTERISTICS_STORAGE_KEY = "tandoor-dealer-characteristics-v1";
export const DEALER_CHARACTERISTICS_EVENT = "tandoor-dealer-characteristics-changed";

export type DealerCharacteristicId =
  | "has_warehouse"
  | "has_hardware_warehouse"
  | "is_franchise"
  | "has_special_conditions"
  | "has_tandoor_club"
  | "has_cashback_agent";

export type DealerCharacteristicValue = "yes" | "no" | "unset";

export const DEALER_CHARACTERISTIC_IDS: DealerCharacteristicId[] = [
  "has_warehouse",
  "has_hardware_warehouse",
  "is_franchise",
  "has_special_conditions",
  "has_tandoor_club",
  "has_cashback_agent",
];

export const DEALER_CHARACTERISTIC_LABELS: Record<DealerCharacteristicId, string> = {
  has_warehouse: "Есть склад",
  has_hardware_warehouse: "Есть склад фурнитуры",
  is_franchise: "Франшиза",
  has_special_conditions: "Спецусловия",
  has_tandoor_club: "Tandoor Club",
  has_cashback_agent: "Кешбек агент",
};

export type DealerCharacteristicEntry = {
  value: DealerCharacteristicValue;
  note?: string;
};

export type DealerCharacteristicsOverride = {
  characteristics: Partial<Record<DealerCharacteristicId, DealerCharacteristicEntry>>;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type DealerCharacteristicsHistoryEntry = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

export type DealerCharacteristicsState = {
  overridesByDealer: Record<string, DealerCharacteristicsOverride>;
  historyByDealer: Record<string, DealerCharacteristicsHistoryEntry[]>;
};

function emptyState(): DealerCharacteristicsState {
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

function pushHistory(state: DealerCharacteristicsState, dealerId: string, body: string, byName: string): void {
  const at = isoNow();
  const ev: DealerCharacteristicsHistoryEntry = {
    id: `dch-${dealerId}-${Date.now()}`,
    at,
    meta: formatMetaRu(at, byName),
    body,
  };
  const prev = state.historyByDealer[dealerId] ?? [];
  state.historyByDealer[dealerId] = [ev, ...prev].slice(0, 120);
}

export function loadDealerCharacteristicsState(): DealerCharacteristicsState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_CHARACTERISTICS_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<DealerCharacteristicsState>;
    return {
      overridesByDealer:
        p.overridesByDealer && typeof p.overridesByDealer === "object" ? p.overridesByDealer : {},
      historyByDealer: p.historyByDealer && typeof p.historyByDealer === "object" ? p.historyByDealer : {},
    };
  } catch {
    return emptyState();
  }
}

export function saveDealerCharacteristicsState(state: DealerCharacteristicsState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_CHARACTERISTICS_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_CHARACTERISTICS_EVENT));
}

export function getDealerCharacteristicsOverride(
  dealerId: string,
  state: DealerCharacteristicsState = loadDealerCharacteristicsState(),
): DealerCharacteristicsOverride | undefined {
  return state.overridesByDealer[dealerId];
}

export function getDealerCharacteristicEntry(
  dealerId: string,
  id: DealerCharacteristicId,
  state: DealerCharacteristicsState = loadDealerCharacteristicsState(),
): DealerCharacteristicEntry | undefined {
  return state.overridesByDealer[dealerId]?.characteristics[id];
}

export function getDealerCharacteristicValue(
  dealerId: string,
  id: DealerCharacteristicId,
  state: DealerCharacteristicsState = loadDealerCharacteristicsState(),
): DealerCharacteristicValue {
  return state.overridesByDealer[dealerId]?.characteristics[id]?.value ?? "unset";
}

export function canEditDealerCharacteristics(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return canEditClientNextStep(profile, dealer);
}

function characteristicValueLabel(v: DealerCharacteristicValue): string {
  if (v === "yes") return "да";
  if (v === "no") return "нет";
  return "не указано";
}

function diffSummary(
  prev: DealerCharacteristicsOverride | undefined,
  next: Partial<Record<DealerCharacteristicId, DealerCharacteristicEntry>>,
): string {
  const lines: string[] = [];
  for (const id of DEALER_CHARACTERISTIC_IDS) {
    const before = prev?.characteristics[id];
    const after = next[id];
    if (!after && !before) continue;
    if (!after) continue;
    const valueChanged = (before?.value ?? "unset") !== (after.value ?? "unset");
    const noteChanged = (before?.note ?? "").trim() !== (after.note ?? "").trim();
    if (!valueChanged && !noteChanged) continue;
    const label = DEALER_CHARACTERISTIC_LABELS[id];
    const parts: string[] = [];
    if (valueChanged) parts.push(characteristicValueLabel(after.value ?? "unset"));
    if (noteChanged) {
      const n = (after.note ?? "").trim();
      parts.push(n ? `примечание: ${n}` : "примечание очищено");
    }
    lines.push(`${label} — ${parts.join("; ")}`);
  }
  return lines.length > 0 ? `Характеристики клиента обновлены: ${lines.join(" · ")}` : "Характеристики клиента обновлены";
}

export function updateDealerCharacteristics(
  dealerId: string,
  patch: Partial<Record<DealerCharacteristicId, DealerCharacteristicEntry>>,
  profile: ReleaseDemoProfile,
): void {
  const state = loadDealerCharacteristicsState();
  const now = isoNow();
  const act = { id: profile.personaUserId, name: userLabelFromProfile(profile) };
  const prev = state.overridesByDealer[dealerId];
  const mergedChars: Partial<Record<DealerCharacteristicId, DealerCharacteristicEntry>> = {
    ...(prev?.characteristics ?? {}),
  };
  for (const id of DEALER_CHARACTERISTIC_IDS) {
    const entry = patch[id];
    if (!entry) continue;
    const value: DealerCharacteristicValue = entry.value ?? "unset";
    const note = (entry.note ?? "").trim();
    if (value === "unset" && !note) {
      delete mergedChars[id];
    } else {
      mergedChars[id] = { value, note: note || undefined };
    }
  }
  const summary = diffSummary(prev, patch);
  const next: DealerCharacteristicsOverride = {
    characteristics: mergedChars,
    updatedAt: now,
    updatedBy: act.id,
    updatedByName: act.name,
  };
  state.overridesByDealer[dealerId] = next;
  pushHistory(state, dealerId, summary, act.name);
  saveDealerCharacteristicsState(state);
}

export function getDealerCharacteristicsHistoryEvents(
  dealerId: string,
  state: DealerCharacteristicsState = loadDealerCharacteristicsState(),
): DealerCharacteristicsHistoryEntry[] {
  return [...(state.historyByDealer[dealerId] ?? [])].sort((a, b) =>
    a.at < b.at ? 1 : a.at > b.at ? -1 : 0,
  );
}
