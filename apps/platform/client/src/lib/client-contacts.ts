/**
 * Контакты клиента по scope: дилер, торговая точка, юрлицо.
 * Чтение: Postgres (кеш) → fallback localStorage. Запись: API.
 */

import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { getMergedDealerTradePoints } from "@/lib/dealer-trade-points-overrides";
import { getMergedDealerLegalEntities } from "@/lib/dealer-legal-entities";
import { canEditDealerLegalEntities } from "@/lib/dealer-legal-entities";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import {
  apiCopyContactToScopes,
  apiCreateContact,
  apiPatchContact,
  apiRequestDeleteContact,
  apiSetPrimaryContact,
  scopeApiFields,
} from "@/lib/client-contacts-api";
import { refreshDbContactsForDealer, resolveContactsStateForDealer } from "@/lib/client-contacts-db-cache";

export const CLIENT_CONTACTS_STORAGE_KEY = "tandoor-client-contacts-v1";
export const CLIENT_CONTACTS_EVENT = "tandoor-client-contacts-changed";

export type ClientContact = {
  id: string;
  fullName: string;
  role?: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  email?: string;
  comment?: string;
  isPrimary: boolean;
  isActual: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName?: string;
  deleteRequestedAt?: string;
  deleteRequestReason?: string;
};

export type ContactTimelineEntry = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

export type ClientContactsState = {
  dealerContactsByDealer: Record<string, ClientContact[]>;
  tradePointContactsByKey: Record<string, ClientContact[]>;
  legalEntityContactsByKey: Record<string, ClientContact[]>;
  dealerTimelineByDealer: Record<string, ContactTimelineEntry[]>;
  scopeTimelineByScopeKey: Record<string, ContactTimelineEntry[]>;
};

function emptyState(): ClientContactsState {
  return {
    dealerContactsByDealer: {},
    tradePointContactsByKey: {},
    legalEntityContactsByKey: {},
    dealerTimelineByDealer: {},
    scopeTimelineByScopeKey: {},
  };
}

export function legalEntityContactsStorageKey(dealerId: string, legalEntityId: string): string {
  return `${dealerId}|${legalEntityId}`;
}

export function tradePointContactsStorageKey(dealerId: string, tradePointId: string): string {
  return `${dealerId}|${tradePointId}`;
}

/** Ключ scope для аудита (не совпадает с ключом map для юрлица). */
export function clientContactScopeKeyLegalEntity(dealerId: string, legalEntityId: string): string {
  return `legalEntity:${dealerId}|${legalEntityId}`;
}

export function clientContactScopeKeyTradePoint(dealerId: string, tradePointId: string): string {
  return `tradePoint:${dealerId}|${tradePointId}`;
}

export function clientContactScopeKeyDealer(dealerId: string): string {
  return `dealer:${dealerId}`;
}

export function loadClientContactsState(): ClientContactsState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(CLIENT_CONTACTS_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<ClientContactsState>;
    return {
      dealerContactsByDealer:
        p.dealerContactsByDealer && typeof p.dealerContactsByDealer === "object" ? p.dealerContactsByDealer : {},
      tradePointContactsByKey:
        p.tradePointContactsByKey && typeof p.tradePointContactsByKey === "object" ? p.tradePointContactsByKey : {},
      legalEntityContactsByKey:
        p.legalEntityContactsByKey && typeof p.legalEntityContactsByKey === "object" ? p.legalEntityContactsByKey : {},
      dealerTimelineByDealer:
        p.dealerTimelineByDealer && typeof p.dealerTimelineByDealer === "object" ? p.dealerTimelineByDealer : {},
      scopeTimelineByScopeKey:
        p.scopeTimelineByScopeKey && typeof p.scopeTimelineByScopeKey === "object" ? p.scopeTimelineByScopeKey : {},
    };
  } catch {
    return emptyState();
  }
}

export function saveClientContactsState(state: ClientContactsState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(CLIENT_CONTACTS_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(CLIENT_CONTACTS_EVENT));
}

function actor(profile: ReleaseDemoProfile): { id: string; name: string } {
  return { id: profile.personaUserId, name: userLabelFromProfile(profile) };
}

function apiActorFields(profile: ReleaseDemoProfile): { actorUserId: string; actorName: string } {
  const a = actor(profile);
  return { actorUserId: a.id, actorName: a.name };
}

function fireAndRefresh(dealerId: string, run: () => Promise<boolean>): void {
  void run().then((ok) => {
    if (ok) void refreshDbContactsForDealer(dealerId);
  });
}

function dealerIdFromScopeKey(scopeKey: string): string | null {
  if (scopeKey.startsWith("dealer:")) return scopeKey.slice("dealer:".length) || null;
  const m = /^(?:legalEntity|tradePoint):([^|]+)/.exec(scopeKey);
  return m?.[1] ?? null;
}

function resolveState(dealerId: string, state?: ClientContactsState): ClientContactsState {
  return resolveContactsStateForDealer(dealerId, state);
}

export function canEditClientContacts(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return canEditDealerLegalEntities(profile, dealer);
}

export function isClientContactActive(c: ClientContact): boolean {
  return c.isActual && !c.deleteRequestedAt;
}

function sortContactsPrimaryFirst(contacts: ClientContact[]): ClientContact[] {
  return [...contacts].sort((a, b) => {
    const ap = a.isPrimary && isClientContactActive(a) ? 0 : 1;
    const bp = b.isPrimary && isClientContactActive(b) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export function getLegalEntityContacts(
  dealerId: string,
  legalEntityId: string,
  state?: ClientContactsState,
): ClientContact[] {
  const st = resolveState(dealerId, state);
  const key = legalEntityContactsStorageKey(dealerId, legalEntityId);
  return sortContactsPrimaryFirst([...(st.legalEntityContactsByKey[key] ?? [])]);
}

export function getDealerClientContacts(dealerId: string, state?: ClientContactsState): ClientContact[] {
  const st = resolveState(dealerId, state);
  return sortContactsPrimaryFirst([...(st.dealerContactsByDealer[dealerId] ?? [])]);
}

export function getTradePointClientContacts(
  dealerId: string,
  tradePointId: string,
  state?: ClientContactsState,
): ClientContact[] {
  const st = resolveState(dealerId, state);
  const key = tradePointContactsStorageKey(dealerId, tradePointId);
  return sortContactsPrimaryFirst([...(st.tradePointContactsByKey[key] ?? [])]);
}

/** Контакты карточки дилера (сортировка: основной активный сверху). */
export function getDealerContacts(row: DealerRow, state?: ClientContactsState): ClientContact[] {
  return getDealerClientContacts(row.id, state);
}

/** Контакты торговой точки. */
export function getTradePointContacts(
  row: DealerRow,
  tradePoint: Pick<DealerTradePoint, "id">,
  state?: ClientContactsState,
): ClientContact[] {
  return getTradePointClientContacts(row.id, tradePoint.id, state);
}

export function getClientContactDealerHistoryEvents(dealerId: string, state?: ClientContactsState): ContactTimelineEntry[] {
  const st = resolveState(dealerId, state);
  return [...(st.dealerTimelineByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function getClientContactScopeHistoryEvents(scopeKey: string, state?: ClientContactsState): ContactTimelineEntry[] {
  const dealerId = dealerIdFromScopeKey(scopeKey);
  const st = dealerId ? resolveState(dealerId, state) : state ?? loadClientContactsState();
  return [...(st.scopeTimelineByScopeKey[scopeKey] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function addLegalEntityContact(
  dealerId: string,
  legalEntityId: string,
  payload: Omit<ClientContact, "id" | "createdAt" | "updatedAt" | "createdBy" | "source"> & { source?: string },
  profile: ReleaseDemoProfile,
  _options?: { legalEntityDisplayName?: string },
): void {
  fireAndRefresh(dealerId, () =>
    apiCreateContact({
      clientId: dealerId,
      ...scopeApiFields("legalEntity", dealerId, legalEntityId),
      fullName: payload.fullName,
      role: payload.role,
      phone: payload.phone,
      whatsapp: payload.whatsapp,
      telegram: payload.telegram,
      email: payload.email,
      comment: payload.comment,
      isPrimary: payload.isPrimary,
      isActual: payload.isActual,
      ...apiActorFields(profile),
    }),
  );
}

export function updateLegalEntityContact(
  dealerId: string,
  legalEntityId: string,
  contactId: string,
  patch: Partial<
    Pick<
      ClientContact,
      | "fullName"
      | "role"
      | "phone"
      | "whatsapp"
      | "telegram"
      | "email"
      | "comment"
      | "isPrimary"
      | "isActual"
    >
  >,
  _profile: ReleaseDemoProfile,
): void {
  void legalEntityId;
  fireAndRefresh(dealerId, () => apiPatchContact({ id: contactId, ...patch }));
}

export function setPrimaryLegalEntityContact(
  dealerId: string,
  _legalEntityId: string,
  contactId: string,
  _profile: ReleaseDemoProfile,
): void {
  fireAndRefresh(dealerId, () => apiSetPrimaryContact(contactId));
}

export function requestDeleteLegalEntityContact(
  dealerId: string,
  _legalEntityId: string,
  contactId: string,
  reason: string,
  _profile: ReleaseDemoProfile,
): void {
  fireAndRefresh(dealerId, () => apiRequestDeleteContact(contactId, reason));
}

export function addDealerContact(
  dealerId: string,
  payload: Omit<ClientContact, "id" | "createdAt" | "updatedAt" | "createdBy" | "source"> & { source?: string },
  profile: ReleaseDemoProfile,
): void {
  fireAndRefresh(dealerId, () =>
    apiCreateContact({
      clientId: dealerId,
      ...scopeApiFields("dealer", dealerId),
      fullName: payload.fullName,
      role: payload.role,
      phone: payload.phone,
      whatsapp: payload.whatsapp,
      telegram: payload.telegram,
      email: payload.email,
      comment: payload.comment,
      isPrimary: payload.isPrimary,
      isActual: payload.isActual,
      ...apiActorFields(profile),
    }),
  );
}

export function updateDealerContact(
  dealerId: string,
  contactId: string,
  patch: Partial<
    Pick<
      ClientContact,
      | "fullName"
      | "role"
      | "phone"
      | "whatsapp"
      | "telegram"
      | "email"
      | "comment"
      | "isPrimary"
      | "isActual"
    >
  >,
  _profile: ReleaseDemoProfile,
): void {
  fireAndRefresh(dealerId, () => apiPatchContact({ id: contactId, ...patch }));
}

export function setPrimaryDealerContact(dealerId: string, contactId: string, _profile: ReleaseDemoProfile): void {
  fireAndRefresh(dealerId, () => apiSetPrimaryContact(contactId));
}

export function requestDeleteDealerContact(dealerId: string, contactId: string, reason: string, _profile: ReleaseDemoProfile): void {
  fireAndRefresh(dealerId, () => apiRequestDeleteContact(contactId, reason));
}

export function addTradePointContact(
  dealerId: string,
  tradePointId: string,
  payload: Omit<ClientContact, "id" | "createdAt" | "updatedAt" | "createdBy" | "source"> & { source?: string },
  profile: ReleaseDemoProfile,
  _options?: { tradePointDisplayName?: string },
): void {
  fireAndRefresh(dealerId, () =>
    apiCreateContact({
      clientId: dealerId,
      ...scopeApiFields("tradePoint", dealerId, tradePointId),
      fullName: payload.fullName,
      role: payload.role,
      phone: payload.phone,
      whatsapp: payload.whatsapp,
      telegram: payload.telegram,
      email: payload.email,
      comment: payload.comment,
      isPrimary: payload.isPrimary,
      isActual: payload.isActual,
      ...apiActorFields(profile),
    }),
  );
}

export function updateTradePointContact(
  dealerId: string,
  _tradePointId: string,
  contactId: string,
  patch: Partial<
    Pick<
      ClientContact,
      | "fullName"
      | "role"
      | "phone"
      | "whatsapp"
      | "telegram"
      | "email"
      | "comment"
      | "isPrimary"
      | "isActual"
    >
  >,
  _profile: ReleaseDemoProfile,
): void {
  fireAndRefresh(dealerId, () => apiPatchContact({ id: contactId, ...patch }));
}

export function setPrimaryTradePointContact(
  dealerId: string,
  _tradePointId: string,
  contactId: string,
  _profile: ReleaseDemoProfile,
): void {
  fireAndRefresh(dealerId, () => apiSetPrimaryContact(contactId));
}

export function requestDeleteTradePointContact(
  dealerId: string,
  _tradePointId: string,
  contactId: string,
  reason: string,
  _profile: ReleaseDemoProfile,
): void {
  fireAndRefresh(dealerId, () => apiRequestDeleteContact(contactId, reason));
}

export type ContactCopySourceType = "dealer" | "legalEntity" | "tradePoint";

export type ContactCopySource = {
  type: ContactCopySourceType;
  contactId: string;
  legalEntityId?: string;
  tradePointId?: string;
};

export type ContactCopyDestinations = {
  toDealer: boolean;
  toAllLegalEntities: boolean;
  toAllTradePoints: boolean;
  manualLegalEntityIds: string[];
  manualTradePointIds: string[];
};

function resolveSourceContact(state: ClientContactsState, dealerId: string, source: ContactCopySource): ClientContact | undefined {
  if (source.type === "dealer") {
    return (state.dealerContactsByDealer[dealerId] ?? []).find((c) => c.id === source.contactId);
  }
  if (source.type === "legalEntity" && source.legalEntityId) {
    const key = legalEntityContactsStorageKey(dealerId, source.legalEntityId);
    return (state.legalEntityContactsByKey[key] ?? []).find((c) => c.id === source.contactId);
  }
  if (source.type === "tradePoint" && source.tradePointId) {
    const key = tradePointContactsStorageKey(dealerId, source.tradePointId);
    return (state.tradePointContactsByKey[key] ?? []).find((c) => c.id === source.contactId);
  }
  return undefined;
}

function countCopyDestinations(
  source: ContactCopySource,
  destinations: ContactCopyDestinations,
  row: DealerRow,
): { count: number; tradePointIds?: string[] } {
  let count = 0;
  if (destinations.toDealer && source.type !== "dealer") count += 1;

  if (destinations.toAllLegalEntities) {
    for (const le of getMergedDealerLegalEntities(row).filter((e) => e.status !== "archived")) {
      if (source.type === "legalEntity" && source.legalEntityId === le.id) continue;
      count += 1;
    }
  }

  const tradePointIds: string[] = [];
  if (destinations.toAllTradePoints) {
    for (const { point } of getMergedDealerTradePoints(row, { includeArchived: false })) {
      if (source.type === "tradePoint" && source.tradePointId === point.id) continue;
      tradePointIds.push(point.id);
      count += 1;
    }
  }

  for (const leId of destinations.manualLegalEntityIds) {
    if (destinations.toAllLegalEntities) continue;
    if (source.type === "legalEntity" && source.legalEntityId === leId) continue;
    count += 1;
  }
  for (const tpId of destinations.manualTradePointIds) {
    if (destinations.toAllTradePoints) continue;
    if (source.type === "tradePoint" && source.tradePointId === tpId) continue;
    count += 1;
  }

  return {
    count,
    tradePointIds: destinations.toAllTradePoints ? tradePointIds : undefined,
  };
}

export function copyContactToScopes(
  dealerId: string,
  source: ContactCopySource,
  destinations: ContactCopyDestinations,
  profile: ReleaseDemoProfile,
  row: DealerRow,
): { ok: boolean; error?: string } {
  const state = resolveContactsStateForDealer(dealerId);
  const src = resolveSourceContact(state, dealerId, source);
  if (!src) return { ok: false, error: "Контакт не найден." };

  const { count, tradePointIds } = countCopyDestinations(source, destinations, row);
  if (count === 0) return { ok: false, error: "Выберите хотя бы одно назначение." };

  fireAndRefresh(dealerId, () =>
    apiCopyContactToScopes({
      clientId: dealerId,
      sourceContactId: source.contactId,
      destinations,
      ...(tradePointIds ? { tradePointIds } : {}),
      ...apiActorFields(profile),
    }),
  );
  return { ok: true };
}
