/**
 * Юридические лица дилера.
 * Чтение: Postgres (кеш) → fallback localStorage. Запись: API.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getPassportLegalEntities } from "@/lib/dealer-card-release-signals";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  apiArchiveLegalEntity,
  apiCreateFull,
  apiDeleteLegalEntity,
  apiPatchFull,
} from "@/lib/dealer-legal-entities-api";
import {
  refreshDbLegalEntitiesForDealer,
  replaceLegalEntityIdInCache,
  resolveLegalEntitiesStateForDealer,
  upsertOptimisticLegalEntity,
} from "@/lib/dealer-legal-entities-db-cache";

export const DEALER_LEGAL_ENTITIES_STORAGE_KEY = "tandoor-dealer-legal-entities-v1";
export const DEALER_LEGAL_ENTITIES_EVENT = "tandoor-dealer-legal-entities-changed";

export type DealerLegalEntityStatus = "main" | "additional" | "archived";

export type DealerLegalEntity = {
  id: string;
  /** Отображаемый код TND-LE-000001 для записей актуализации. */
  internalCode?: string;
  /** ООО | ИП | self_employed | other */
  entityType?: string;
  name: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  legalAddress?: string;
  /** Фактический адрес (актуализация / расширенная карточка). */
  actualAddress?: string;
  primaryContact?: string;
  phone?: string;
  email?: string;
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

function scanMaxLegalEntityCode(list: DealerLegalEntity[]): number {
  let max = 0;
  for (const e of list) {
    const m = /^TND-LE-(\d{1,9})$/i.exec(e.internalCode?.trim() ?? "");
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return max;
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

export function allocateNextLegalEntityCodeLocal(): string {
  const st = loadDealerLegalEntitiesState();
  let max = 0;
  for (const list of Object.values(st.entitiesByDealer)) {
    max = Math.max(max, scanMaxLegalEntityCode(list));
  }
  const n = max + 1;
  return `TND-LE-${String(n).padStart(6, "0")}`;
}

function resolveState(dealerId: string, state?: DealerLegalEntitiesState): DealerLegalEntitiesState {
  return resolveLegalEntitiesStateForDealer(dealerId, state);
}

export function getDealerLegalEntities(dealerId: string, state?: DealerLegalEntitiesState): DealerLegalEntity[] {
  const st = state ?? resolveState(dealerId);
  return [...(st.entitiesByDealer[dealerId] ?? [])];
}

/** Объединяет юрлица из localStorage и справочные названия из релиза (паспорт). */
export function getMergedDealerLegalEntities(row: DealerRow, state?: DealerLegalEntitiesState): MergedDealerLegalEntity[] {
  const st = state ?? resolveState(row.id);
  const stored = getDealerLegalEntities(row.id, st);
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
  state?: DealerLegalEntitiesState,
): DealerLegalEntityHistoryEntry[] {
  const st = state ?? resolveState(dealerId);
  return [...(st.historyByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

function fireAndRefresh(dealerId: string, run: () => Promise<{ ok: boolean; id?: string } | boolean>): void {
  void Promise.resolve(run()).then((result) => {
    const ok = typeof result === "boolean" ? result : result.ok;
    if (ok) void refreshDbLegalEntitiesForDealer(dealerId);
  });
}

export function addDealerLegalEntity(
  dealerId: string,
  payload: {
    name: string;
    inn?: string;
    kpp?: string;
    ogrn?: string;
    legalAddress?: string;
    actualAddress?: string;
    entityType?: string;
    primaryContact?: string;
    phone?: string;
    email?: string;
    internalCode?: string;
    status: DealerLegalEntityStatus;
    comment?: string;
    updatedBy: string;
    updatedByName: string;
  },
): string | undefined {
  const name = payload.name.trim();
  if (!name) return undefined;

  const now = new Date().toISOString();
  const optimisticId = `le-${dealerId}-${Date.now()}`;
  const internalCode = payload.internalCode?.trim() || allocateNextLegalEntityCodeLocal();
  upsertOptimisticLegalEntity(dealerId, {
    id: optimisticId,
    internalCode,
    entityType: payload.entityType,
    name,
    inn: payload.inn,
    kpp: payload.kpp,
    ogrn: payload.ogrn,
    legalAddress: payload.legalAddress,
    actualAddress: payload.actualAddress,
    primaryContact: payload.primaryContact,
    phone: payload.phone,
    email: payload.email,
    status: payload.status,
    comment: payload.comment,
    createdAt: now,
    updatedAt: now,
    updatedBy: payload.updatedBy,
    updatedByName: payload.updatedByName,
  });

  void apiCreateFull({
    clientId: dealerId,
    name,
    inn: payload.inn,
    kpp: payload.kpp,
    ogrn: payload.ogrn,
    legalAddress: payload.legalAddress,
    actualAddress: payload.actualAddress,
    entityType: payload.entityType,
    primaryContact: payload.primaryContact,
    phone: payload.phone,
    email: payload.email,
    internalCode,
    status: payload.status,
    comment: payload.comment,
    updatedByUserId: payload.updatedBy,
    updatedByName: payload.updatedByName,
  }).then((r) => {
    if (r.ok && r.id) replaceLegalEntityIdInCache(dealerId, optimisticId, r.id);
    if (r.ok) void refreshDbLegalEntitiesForDealer(dealerId);
  });

  return optimisticId;
}

export function updateDealerLegalEntity(
  dealerId: string,
  entityId: string,
  patch: Partial<
    Pick<
      DealerLegalEntity,
      | "name"
      | "inn"
      | "kpp"
      | "ogrn"
      | "legalAddress"
      | "actualAddress"
      | "entityType"
      | "primaryContact"
      | "phone"
      | "email"
      | "internalCode"
      | "status"
      | "comment"
    >
  >,
  updatedBy: string,
  updatedByName: string,
): void {
  if (entityId.startsWith("passport:")) return;
  fireAndRefresh(dealerId, () =>
    apiPatchFull(entityId, {
      ...patch,
      updatedByUserId: updatedBy,
      updatedByName,
    }),
  );
}

export function archiveDealerLegalEntity(dealerId: string, entityId: string, updatedBy: string, updatedByName: string): void {
  if (entityId.startsWith("passport:")) return;
  fireAndRefresh(dealerId, () => apiArchiveLegalEntity(entityId, updatedBy, updatedByName));
}

/** Полное удаление записи из хранилища (без события в истории — используйте архив для аудита). */
export function deleteDealerLegalEntity(dealerId: string, entityId: string): void {
  if (entityId.startsWith("passport:")) return;
  fireAndRefresh(dealerId, () => apiDeleteLegalEntity(entityId));
}
