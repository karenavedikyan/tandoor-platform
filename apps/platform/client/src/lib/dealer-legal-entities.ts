/**
 * Юридические лица дилера.
 * Чтение: Postgres (кеш) → fallback localStorage. Запись: API.
 */

import type { DealerRow } from "./dealer-base-mock-data.js";
import { getPassportLegalEntities, type PassportLegalEntity } from "./dealer-card-release-signals.js";
import { canEditClientNextStep } from "./client-next-step-data.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import {
  apiArchiveLegalEntity,
  apiCreateFull,
  apiDeleteLegalEntity,
  apiPatchFull,
  apiUnarchiveLegalEntity,
} from "./dealer-legal-entities-api.js";
import type { LegalEntityPaymentForm, LegalEntityUpsertFields } from "./legal-entities-payment-api.js";
import {
  getDbLegalEntitiesStateForDealer,
  notifyDealerLegalEntitiesChanged,
  refreshDbLegalEntitiesForDealer,
  replaceLegalEntityIdInCache,
  resolveLegalEntitiesStateForDealer,
  setDbLegalEntitiesStateForDealer,
  upsertOptimisticLegalEntity,
} from "./dealer-legal-entities-db-cache.js";

export const DEALER_LEGAL_ENTITIES_STORAGE_KEY = "tandoor-dealer-legal-entities-v1";
export const DEALER_LEGAL_ENTITIES_EVENT = "tandoor-dealer-legal-entities-changed";

export const LEGAL_ENTITY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLegalEntityServerUuid(id: string): boolean {
  return LEGAL_ENTITY_UUID_RE.test(id);
}

export function normalizeLegalEntityInn(v: string | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function normalizeInternalCode(v: string | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** Сопоставление UI-записи с серверным UUID по списку из Postgres-кеша. */
export function resolveServerLegalEntityIdFromList(
  entity: Pick<DealerLegalEntity, "id" | "name" | "inn" | "internalCode">,
  serverEntities: DealerLegalEntity[],
): string | null {
  if (isLegalEntityServerUuid(entity.id)) return entity.id;

  const internalCode = normalizeInternalCode(entity.internalCode);
  if (internalCode) {
    const byCode = serverEntities.find(
      (e) => isLegalEntityServerUuid(e.id) && normalizeInternalCode(e.internalCode) === internalCode,
    );
    if (byCode) return byCode.id;
  }

  const inn = normalizeLegalEntityInn(entity.inn);
  if (inn) {
    const byInnMatches = serverEntities.filter(
      (e) => isLegalEntityServerUuid(e.id) && normalizeLegalEntityInn(e.inn) === inn,
    );
    if (byInnMatches.length === 1) return byInnMatches[0]!.id;
  }

  const nameKey = entity.name.trim().toLowerCase();
  if (nameKey && nameKey !== "—") {
    const byNameMatches = serverEntities.filter(
      (e) => isLegalEntityServerUuid(e.id) && e.name.trim().toLowerCase() === nameKey,
    );
    if (byNameMatches.length === 1) return byNameMatches[0]!.id;
  }

  return null;
}

export function resolveServerLegalEntityId(
  dealerId: string,
  entity: Pick<DealerLegalEntity, "id" | "name" | "inn" | "internalCode">,
): string | null {
  return resolveServerLegalEntityIdFromList(entity, getDealerLegalEntities(dealerId));
}

function applyArchivedStatusInCache(
  dealerId: string,
  entity: Pick<DealerLegalEntity, "id" | "internalCode">,
  serverId: string,
): void {
  const st = getDbLegalEntitiesStateForDealer(dealerId);
  if (!st) return;
  const list = st.entitiesByDealer[dealerId] ?? [];
  const codeKey = normalizeInternalCode(entity.internalCode);
  const nextList = list.map((e) => {
    const matches =
      e.id === entity.id ||
      e.id === serverId ||
      (codeKey !== "" && normalizeInternalCode(e.internalCode) === codeKey);
    if (!matches) return e;
    return { ...e, id: serverId, status: "archived" as const };
  });
  setDbLegalEntitiesStateForDealer(dealerId, {
    ...st,
    entitiesByDealer: { ...st.entitiesByDealer, [dealerId]: nextList },
  });
  notifyDealerLegalEntitiesChanged();
}

/** Обновить кеш ЮЛ дилера после мутации (архив/восстановление). */
export async function refreshDealerLegalEntitiesAfterMutation(dealerId: string): Promise<void> {
  await refreshDbLegalEntitiesForDealer(dealerId);
  notifyDealerLegalEntitiesChanged();
}

export type DealerLegalEntityPaymentFields = {
  paymentForm?: LegalEntityPaymentForm | null;
  paymentDelayDays?: number | null;
  creditLimitRub?: string | null;
  edoEnabled?: boolean | null;
  edoOperator?: string | null;
};

export function paymentFieldsToFullApiBody(payment: LegalEntityUpsertFields | undefined): Record<string, unknown> {
  if (!payment) return {};
  return {
    paymentForm: payment.paymentForm ?? null,
    paymentDelayDays: payment.paymentDelayDays ?? null,
    creditLimitRub: payment.creditLimitRub ?? null,
    edoEnabled: payment.edoEnabled ?? null,
    edoOperator: payment.edoOperator ?? null,
  };
}

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
  paymentForm?: LegalEntityPaymentForm | null;
  paymentDelayDays?: number | null;
  creditLimitRub?: string | null;
  edoEnabled?: boolean | null;
  edoOperator?: string | null;
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
  return dedupStoredLegalEntities(st.entitiesByDealer[dealerId] ?? []);
}

/**
 * Схлопывает optimistic/DB-двойников: одна и та же запись может временно
 * присутствовать дважды (optimistic le-... + серверная UUID с тем же internalCode).
 * Сохраняем серверную запись (UUID) при конфликте по internalCode.
 */
function dedupStoredLegalEntities(list: DealerLegalEntity[]): DealerLegalEntity[] {
  const byCode = new Map<string, number>();
  const out: DealerLegalEntity[] = [];
  for (const e of list) {
    const code = normalizeInternalCode(e.internalCode);
    if (!code) {
      out.push(e);
      continue;
    }
    const existingIdx = byCode.get(code);
    if (existingIdx == null) {
      byCode.set(code, out.length);
      out.push(e);
      continue;
    }
    const existing = out[existingIdx]!;
    // Предпочитаем серверную (UUID) запись optimistic le-... дублю.
    if (!isLegalEntityServerUuid(existing.id) && isLegalEntityServerUuid(e.id)) {
      out[existingIdx] = e;
    }
  }
  return out;
}

function normalizeEntityName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isPassportSeedCoveredByStored(p: PassportLegalEntity, stored: DealerLegalEntity[]): boolean {
  const storedNames = new Set(
    stored.map((e) => normalizeEntityName(e.name)).filter(Boolean) as string[],
  );
  const name = normalizeEntityName(p.name);
  if (!name) return true;
  return storedNames.has(name);
}

/** Объединяет юрлица из Postgres-кеша и справочные названия из релиза (паспорт). */
export function getMergedDealerLegalEntities(row: DealerRow, state?: DealerLegalEntitiesState): MergedDealerLegalEntity[] {
  const st = state ?? resolveState(row.id);
  const stored = getDealerLegalEntities(row.id, st);
  const passport = getPassportLegalEntities(row);

  const seeds: MergedDealerLegalEntity[] = passport
    .filter((p) => !isPassportSeedCoveredByStored(p, stored))
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
  } & DealerLegalEntityPaymentFields,
  paymentPatch?: LegalEntityUpsertFields,
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
    paymentForm: payload.paymentForm,
    paymentDelayDays: payload.paymentDelayDays,
    creditLimitRub: payload.creditLimitRub,
    edoEnabled: payload.edoEnabled,
    edoOperator: payload.edoOperator,
    createdAt: now,
    updatedAt: now,
    updatedBy: payload.updatedBy,
    updatedByName: payload.updatedByName,
  });

  const paymentUpsert =
    paymentPatch ??
    buildLegalEntityPaymentUpsert({
      paymentForm: payload.paymentForm,
      paymentDelayDays: payload.paymentDelayDays,
      creditLimitRub: payload.creditLimitRub,
      edoEnabled: payload.edoEnabled,
      edoOperator: payload.edoOperator,
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
    ...paymentFieldsToFullApiBody(paymentUpsert),
  }).then(async (r) => {
    if (r.ok && r.id) {
      replaceLegalEntityIdInCache(dealerId, optimisticId, r.id);
    }
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
    > &
      DealerLegalEntityPaymentFields
  >,
  updatedBy: string,
  updatedByName: string,
  paymentPatch?: LegalEntityUpsertFields,
): void {
  if (entityId.startsWith("passport:")) return;
  const paymentUpsert =
    paymentPatch ??
    buildLegalEntityPaymentUpsert({
      paymentForm: patch.paymentForm,
      paymentDelayDays: patch.paymentDelayDays,
      creditLimitRub: patch.creditLimitRub,
      edoEnabled: patch.edoEnabled,
      edoOperator: patch.edoOperator,
    });
  fireAndRefresh(dealerId, async () => {
    return apiPatchFull(entityId, {
      ...patch,
      ...paymentFieldsToFullApiBody(paymentUpsert),
      updatedByUserId: updatedBy,
      updatedByName,
    });
  });
}

export function buildLegalEntityPaymentUpsert(
  fields: DealerLegalEntityPaymentFields & {
    paymentDelayDays?: number | null | string;
    creditLimitRub?: string | null | number;
  },
): LegalEntityUpsertFields | undefined {
  const hasAny =
    fields.paymentForm != null ||
    fields.paymentDelayDays != null ||
    fields.creditLimitRub != null ||
    fields.edoEnabled != null ||
    (fields.edoOperator != null && fields.edoOperator.trim() !== "");
  if (!hasAny) return undefined;

  let delay: number | null = null;
  if (fields.paymentDelayDays != null && String(fields.paymentDelayDays).trim() !== "") {
    const n = Number(fields.paymentDelayDays);
    delay = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
  }

  let limit: number | null = null;
  if (fields.creditLimitRub != null && String(fields.creditLimitRub).trim() !== "") {
    const n = Number(String(fields.creditLimitRub).replace(/\s/g, "").replace(",", "."));
    limit = Number.isFinite(n) ? n : null;
  }

  return {
    paymentForm: fields.paymentForm ?? null,
    paymentDelayDays: delay,
    creditLimitRub: limit,
    edoEnabled: fields.edoEnabled ?? null,
    edoOperator: fields.edoEnabled ? fields.edoOperator?.trim() || null : null,
  };
}

/** Создаёт запись в Postgres при отсутствии UUID (overlay / passport / optimistic id). */
export async function ensureServerLegalEntityId(
  dealerId: string,
  entity: MergedDealerLegalEntity,
  updatedBy: string,
  updatedByName: string,
): Promise<string | null> {
  await refreshDbLegalEntitiesForDealer(dealerId);
  let resolved = resolveServerLegalEntityId(dealerId, entity);
  if (resolved) return resolved;

  const internalCode = normalizeInternalCode(entity.internalCode);
  if (internalCode) {
    await refreshDbLegalEntitiesForDealer(dealerId);
    const serverEntities = getDealerLegalEntities(dealerId);
    resolved = resolveServerLegalEntityIdFromList(entity, serverEntities);
    if (resolved) return resolved;

    const byCode = serverEntities.find(
      (e) => isLegalEntityServerUuid(e.id) && normalizeInternalCode(e.internalCode) === internalCode,
    );
    if (byCode) return byCode.id;
    // Запись с таким internalCode ещё не существует на сервере — продолжаем к созданию ниже.
    // Серверный дедуп (handleLegalEntitiesCreateFull → findExistingForDedup по internal_code)
    // защитит от появления дубля, если запись всё же есть.
  }

  const inn = normalizeLegalEntityInn(entity.inn);
  if (inn) {
    const byInnMatches = getDealerLegalEntities(dealerId).filter(
      (e) => isLegalEntityServerUuid(e.id) && normalizeLegalEntityInn(e.inn) === inn,
    );
    if (byInnMatches.length === 1) return byInnMatches[0]!.id;
    if (byInnMatches.length > 1) return null;
  }

  const name = entity.name.trim();
  if (!name || name === "—") return null;

  const status: DealerLegalEntityStatus = entity.status === "archived" ? "additional" : entity.status;

  const paymentUpsert = buildLegalEntityPaymentUpsert({
    paymentForm: entity.paymentForm,
    paymentDelayDays: entity.paymentDelayDays,
    creditLimitRub: entity.creditLimitRub,
    edoEnabled: entity.edoEnabled,
    edoOperator: entity.edoOperator,
  });

  const created = await apiCreateFull({
    clientId: dealerId,
    name,
    inn: entity.inn,
    kpp: entity.kpp,
    ogrn: entity.ogrn,
    legalAddress: entity.legalAddress,
    actualAddress: entity.actualAddress,
    entityType: entity.entityType,
    primaryContact: entity.primaryContact,
    phone: entity.phone,
    email: entity.email,
    internalCode: entity.internalCode,
    status,
    comment: entity.comment,
    updatedByUserId: updatedBy,
    updatedByName,
    ...paymentFieldsToFullApiBody(paymentUpsert),
  });
  if (!created.ok || !created.id) return null;

  if (!isLegalEntityServerUuid(entity.id)) {
    replaceLegalEntityIdInCache(dealerId, entity.id, created.id);
  }
  await refreshDbLegalEntitiesForDealer(dealerId);
  return created.id;
}

async function resolveServerLegalEntityIdForArchive(
  dealerId: string,
  entity: MergedDealerLegalEntity,
  updatedBy: string,
  updatedByName: string,
): Promise<string | null> {
  await refreshDbLegalEntitiesForDealer(dealerId);
  const resolved = resolveServerLegalEntityIdFromList(entity, getDealerLegalEntities(dealerId));
  if (resolved) return resolved;

  const hasIdentity = isLegalEntityServerUuid(entity.id) || Boolean(entity.internalCode?.trim());
  if (hasIdentity) return null;

  return ensureServerLegalEntityId(dealerId, entity, updatedBy, updatedByName);
}

export async function archiveDealerLegalEntityAsync(
  dealerId: string,
  entity: MergedDealerLegalEntity,
  updatedBy: string,
  updatedByName: string,
  options?: { skipRefresh?: boolean },
): Promise<boolean> {
  const serverId = await resolveServerLegalEntityIdForArchive(dealerId, entity, updatedBy, updatedByName);
  if (!serverId) return false;
  const ok = await apiArchiveLegalEntity(serverId, updatedBy, updatedByName);
  if (ok) {
    applyArchivedStatusInCache(dealerId, entity, serverId);
    if (!options?.skipRefresh) await refreshDealerLegalEntitiesAfterMutation(dealerId);
  }
  return ok;
}

export async function unarchiveDealerLegalEntityAsync(
  dealerId: string,
  entity: MergedDealerLegalEntity,
  updatedBy: string,
  updatedByName: string,
): Promise<boolean> {
  await refreshDbLegalEntitiesForDealer(dealerId);
  const serverId = resolveServerLegalEntityId(dealerId, entity) ?? (isLegalEntityServerUuid(entity.id) ? entity.id : null);
  if (!serverId) return false;
  const ok = await apiUnarchiveLegalEntity(serverId, updatedBy, updatedByName);
  if (ok) await refreshDbLegalEntitiesForDealer(dealerId);
  return ok;
}

/** @deprecated Используйте archiveDealerLegalEntityAsync */
export function archiveDealerLegalEntity(dealerId: string, entityId: string, updatedBy: string, updatedByName: string): void {
  if (entityId.startsWith("passport:")) return;
  fireAndRefresh(dealerId, () => apiArchiveLegalEntity(entityId, updatedBy, updatedByName));
}

/** Полное удаление записи из хранилища (без события в истории — используйте архив для аудита). */
export function deleteDealerLegalEntity(dealerId: string, entityId: string): void {
  if (entityId.startsWith("passport:")) return;
  fireAndRefresh(dealerId, () => apiDeleteLegalEntity(entityId));
}
