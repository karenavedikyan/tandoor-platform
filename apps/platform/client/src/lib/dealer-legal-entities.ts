/**
 * Юридические лица дилера (localStorage, без backend).
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getPassportLegalEntities } from "@/lib/dealer-card-release-signals";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

export const DEALER_LEGAL_ENTITIES_STORAGE_KEY = "tandoor-dealer-legal-entities-v1";
export const DEALER_LEGAL_ENTITIES_EVENT = "tandoor-dealer-legal-entities-changed";

export type DealerLegalEntityStatus = "main" | "additional" | "archived";

export type DealerLegalEntity = {
  id: string;
  name: string;
  inn?: string;
  kpp?: string;
  legalAddress?: string;
  status: DealerLegalEntityStatus;
  comment?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type MergedDealerLegalEntity = DealerLegalEntity & { isPassportSeed: boolean };

export type DealerLegalEntityHistoryEntry = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

export type DealerLegalEntitiesState = {
  entitiesByDealer: Record<string, DealerLegalEntity[]>;
  historyByDealer: Record<string, DealerLegalEntityHistoryEntry[]>;
};

function emptyState(): DealerLegalEntitiesState {
  return { entitiesByDealer: {}, historyByDealer: {} };
}

function isoNow(): string {
  return new Date().toISOString();
}

function formatMetaRu(iso: string, name: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return `${iso.trim()} · ${name}`;
  return `${m[3]}.${m[2]}.${m[1]} · ${name}`;
}

function pushHistory(
  state: DealerLegalEntitiesState,
  dealerId: string,
  body: string,
  updatedByName: string,
): void {
  const at = isoNow();
  const ev: DealerLegalEntityHistoryEntry = {
    id: `leh-${dealerId}-${Date.now()}`,
    at,
    meta: formatMetaRu(at, updatedByName),
    body,
  };
  const prev = state.historyByDealer[dealerId] ?? [];
  state.historyByDealer[dealerId] = [ev, ...prev].slice(0, 120);
}

export function loadDealerLegalEntitiesState(): DealerLegalEntitiesState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_LEGAL_ENTITIES_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<DealerLegalEntitiesState>;
    const entitiesByDealer =
      p.entitiesByDealer && typeof p.entitiesByDealer === "object" ? p.entitiesByDealer : {};
    const historyByDealer =
      p.historyByDealer && typeof p.historyByDealer === "object" ? p.historyByDealer : {};
    return { entitiesByDealer, historyByDealer };
  } catch {
    return emptyState();
  }
}

export function saveDealerLegalEntitiesState(state: DealerLegalEntitiesState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_LEGAL_ENTITIES_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_LEGAL_ENTITIES_EVENT));
}

export function getDealerLegalEntities(
  dealerId: string,
  state: DealerLegalEntitiesState = loadDealerLegalEntitiesState(),
): DealerLegalEntity[] {
  return [...(state.entitiesByDealer[dealerId] ?? [])];
}

/** Объединяет юрлица из localStorage и справочные названия из релиза (паспорт). */
export function getMergedDealerLegalEntities(
  row: DealerRow,
  state: DealerLegalEntitiesState = loadDealerLegalEntitiesState(),
): MergedDealerLegalEntity[] {
  const stored = getDealerLegalEntities(row.id, state);
  const storedNames = new Set(stored.map((e) => e.name.trim().toLowerCase()));
  const passport = getPassportLegalEntities(row);
  const seeds: MergedDealerLegalEntity[] = passport
    .filter((p) => !storedNames.has(p.name.trim().toLowerCase()))
    .map((p) => ({
      id: `passport:${p.legalEntityId}`,
      name: p.name,
      status: "main" as const,
      createdAt: "",
      updatedAt: "",
      updatedBy: "",
      updatedByName: "",
      isPassportSeed: true,
    }));
  return [...stored.map((e) => ({ ...e, isPassportSeed: false })), ...seeds];
}

export function canEditDealerLegalEntities(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return canEditClientNextStep(profile, dealer);
}

export function getDealerLegalEntityHistoryEvents(
  dealerId: string,
  state: DealerLegalEntitiesState = loadDealerLegalEntitiesState(),
): DealerLegalEntityHistoryEntry[] {
  return [...(state.historyByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function addDealerLegalEntity(
  dealerId: string,
  payload: {
    name: string;
    inn?: string;
    kpp?: string;
    legalAddress?: string;
    status: DealerLegalEntityStatus;
    comment?: string;
    updatedBy: string;
    updatedByName: string;
  },
): void {
  const name = payload.name.trim();
  if (!name) return;
  const state = loadDealerLegalEntitiesState();
  const now = isoNow();
  const id = `le-${dealerId}-${Date.now()}`;
  const entity: DealerLegalEntity = {
    id,
    name,
    inn: payload.inn?.trim() || undefined,
    kpp: payload.kpp?.trim() || undefined,
    legalAddress: payload.legalAddress?.trim() || undefined,
    status: payload.status,
    comment: payload.comment?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    updatedBy: payload.updatedBy,
    updatedByName: payload.updatedByName,
  };
  const prev = state.entitiesByDealer[dealerId] ?? [];
  state.entitiesByDealer[dealerId] = [entity, ...prev];
  pushHistory(state, dealerId, `Добавлено юрлицо: ${name}`, payload.updatedByName);
  saveDealerLegalEntitiesState(state);
}

export function updateDealerLegalEntity(
  dealerId: string,
  entityId: string,
  patch: Partial<
    Pick<DealerLegalEntity, "name" | "inn" | "kpp" | "legalAddress" | "status" | "comment">
  >,
  updatedBy: string,
  updatedByName: string,
): void {
  if (entityId.startsWith("passport:")) return;
  const state = loadDealerLegalEntitiesState();
  const list = state.entitiesByDealer[dealerId] ?? [];
  const idx = list.findIndex((e) => e.id === entityId);
  if (idx < 0) return;
  const cur = list[idx]!;
  const now = isoNow();
  const next: DealerLegalEntity = {
    ...cur,
    name: patch.name != null ? patch.name.trim() : cur.name,
    inn: patch.inn !== undefined ? patch.inn.trim() || undefined : cur.inn,
    kpp: patch.kpp !== undefined ? patch.kpp.trim() || undefined : cur.kpp,
    legalAddress: patch.legalAddress !== undefined ? patch.legalAddress.trim() || undefined : cur.legalAddress,
    status: patch.status ?? cur.status,
    comment: patch.comment !== undefined ? patch.comment.trim() || undefined : cur.comment,
    updatedAt: now,
    updatedBy,
    updatedByName,
  };
  list[idx] = next;
  state.entitiesByDealer[dealerId] = list;
  pushHistory(state, dealerId, `Обновлено юрлицо: ${next.name}`, updatedByName);
  saveDealerLegalEntitiesState(state);
}

export function archiveDealerLegalEntity(dealerId: string, entityId: string, updatedBy: string, updatedByName: string): void {
  if (entityId.startsWith("passport:")) return;
  const state = loadDealerLegalEntitiesState();
  const list = [...(state.entitiesByDealer[dealerId] ?? [])];
  const idx = list.findIndex((e) => e.id === entityId);
  if (idx < 0) return;
  const cur = list[idx]!;
  const now = isoNow();
  list[idx] = { ...cur, status: "archived", updatedAt: now, updatedBy, updatedByName };
  state.entitiesByDealer[dealerId] = list;
  pushHistory(state, dealerId, `Юрлицо архивировано: ${cur.name}`, updatedByName);
  saveDealerLegalEntitiesState(state);
}

/** Полное удаление записи из хранилища (без события в истории — используйте архив для аудита). */
export function deleteDealerLegalEntity(dealerId: string, entityId: string): void {
  if (entityId.startsWith("passport:")) return;
  const state = loadDealerLegalEntitiesState();
  const list = state.entitiesByDealer[dealerId] ?? [];
  state.entitiesByDealer[dealerId] = list.filter((e) => e.id !== entityId);
  saveDealerLegalEntitiesState(state);
}
