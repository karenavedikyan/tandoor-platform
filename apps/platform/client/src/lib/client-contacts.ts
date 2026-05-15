/**
 * Контакты клиента по scope: дилер, торговая точка, юрлицо (localStorage, без backend).
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getMergedDealerTradePoints } from "@/lib/dealer-trade-points-overrides";
import { getMergedDealerLegalEntities } from "@/lib/dealer-legal-entities";
import { canEditDealerLegalEntities } from "@/lib/dealer-legal-entities";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";

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

function isoNow(): string {
  return new Date().toISOString();
}

function formatMetaRu(iso: string, name: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return `${iso.trim()} · ${name}`;
  return `${m[3]}.${m[2]}.${m[1]} · ${name}`;
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

function pushDealerTimeline(state: ClientContactsState, dealerId: string, body: string, byName: string): void {
  const at = isoNow();
  const ev: ContactTimelineEntry = {
    id: `cct-d-${dealerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at,
    meta: formatMetaRu(at, byName),
    body,
  };
  const prev = state.dealerTimelineByDealer[dealerId] ?? [];
  state.dealerTimelineByDealer[dealerId] = [ev, ...prev].slice(0, 160);
}

function pushScopeTimeline(state: ClientContactsState, scopeKey: string, body: string, byName: string): void {
  const at = isoNow();
  const ev: ContactTimelineEntry = {
    id: `cct-s-${scopeKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at,
    meta: formatMetaRu(at, byName),
    body,
  };
  const prev = state.scopeTimelineByScopeKey[scopeKey] ?? [];
  state.scopeTimelineByScopeKey[scopeKey] = [ev, ...prev].slice(0, 120);
}

export function canEditClientContacts(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return canEditDealerLegalEntities(profile, dealer);
}

export function isClientContactActive(c: ClientContact): boolean {
  return c.isActual && !c.deleteRequestedAt;
}

function listActive(contacts: ClientContact[]): ClientContact[] {
  return contacts.filter(isClientContactActive);
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
  state: ClientContactsState = loadClientContactsState(),
): ClientContact[] {
  const key = legalEntityContactsStorageKey(dealerId, legalEntityId);
  return sortContactsPrimaryFirst([...(state.legalEntityContactsByKey[key] ?? [])]);
}

export function getDealerClientContacts(
  dealerId: string,
  state: ClientContactsState = loadClientContactsState(),
): ClientContact[] {
  return sortContactsPrimaryFirst([...(state.dealerContactsByDealer[dealerId] ?? [])]);
}

export function getTradePointClientContacts(
  dealerId: string,
  tradePointId: string,
  state: ClientContactsState = loadClientContactsState(),
): ClientContact[] {
  const key = tradePointContactsStorageKey(dealerId, tradePointId);
  return sortContactsPrimaryFirst([...(state.tradePointContactsByKey[key] ?? [])]);
}

export function getClientContactDealerHistoryEvents(
  dealerId: string,
  state: ClientContactsState = loadClientContactsState(),
): ContactTimelineEntry[] {
  return [...(state.dealerTimelineByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function getClientContactScopeHistoryEvents(
  scopeKey: string,
  state: ClientContactsState = loadClientContactsState(),
): ContactTimelineEntry[] {
  return [...(state.scopeTimelineByScopeKey[scopeKey] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

function newContactId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

/** Если в scope ещё нет активных контактов — новый становится основным. */
function ensurePrimaryWhenFirstInScope(list: ClientContact[], contact: ClientContact): ClientContact {
  if (listActive(list).length === 0) return { ...contact, isPrimary: true };
  return contact;
}

export function addLegalEntityContact(
  dealerId: string,
  legalEntityId: string,
  payload: Omit<ClientContact, "id" | "createdAt" | "updatedAt" | "createdBy" | "source"> & { source?: string },
  profile: ReleaseDemoProfile,
  options?: { legalEntityDisplayName?: string },
): void {
  const state = loadClientContactsState();
  const act = actor(profile);
  const key = legalEntityContactsStorageKey(dealerId, legalEntityId);
  const list = [...(state.legalEntityContactsByKey[key] ?? [])];
  const now = isoNow();
  let c: ClientContact = {
    id: newContactId(`lec-${dealerId}`),
    fullName: payload.fullName.trim(),
    role: payload.role?.trim() || undefined,
    phone: payload.phone?.trim() || undefined,
    whatsapp: payload.whatsapp?.trim() || undefined,
    telegram: payload.telegram?.trim() || undefined,
    email: payload.email?.trim() || undefined,
    comment: payload.comment?.trim() || undefined,
    isPrimary: Boolean(payload.isPrimary),
    isActual: payload.isActual !== false,
    source: payload.source ?? "manual",
    createdAt: now,
    updatedAt: now,
    createdBy: act.id,
    createdByName: act.name,
  };
  c = ensurePrimaryWhenFirstInScope(list, c);
  if (c.isPrimary) {
    for (let i = 0; i < list.length; i++) {
      if (isClientContactActive(list[i]!)) list[i] = { ...list[i]!, isPrimary: false };
    }
  }
  state.legalEntityContactsByKey[key] = [c, ...list];
  const leLabel = options?.legalEntityDisplayName?.trim() || legalEntityId;
  pushDealerTimeline(state, dealerId, `Добавлен контакт в юрлицо «${leLabel}»: ${c.fullName}`, act.name);
  pushScopeTimeline(
    state,
    clientContactScopeKeyLegalEntity(dealerId, legalEntityId),
    `Добавлен контакт: ${c.fullName}${payload.role?.trim() ? ` (${payload.role.trim()})` : ""}`,
    act.name,
  );
  saveClientContactsState(state);
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
  profile: ReleaseDemoProfile,
): void {
  const state = loadClientContactsState();
  const key = legalEntityContactsStorageKey(dealerId, legalEntityId);
  const list = [...(state.legalEntityContactsByKey[key] ?? [])];
  const idx = list.findIndex((c) => c.id === contactId);
  if (idx < 0) return;
  const cur = list[idx]!;
  const act = actor(profile);
  const now = isoNow();
  let next: ClientContact = {
    ...cur,
    fullName: patch.fullName != null ? patch.fullName.trim() : cur.fullName,
    role: patch.role !== undefined ? patch.role.trim() || undefined : cur.role,
    phone: patch.phone !== undefined ? patch.phone.trim() || undefined : cur.phone,
    whatsapp: patch.whatsapp !== undefined ? patch.whatsapp.trim() || undefined : cur.whatsapp,
    telegram: patch.telegram !== undefined ? patch.telegram.trim() || undefined : cur.telegram,
    email: patch.email !== undefined ? patch.email.trim() || undefined : cur.email,
    comment: patch.comment !== undefined ? patch.comment.trim() || undefined : cur.comment,
    isPrimary: patch.isPrimary ?? cur.isPrimary,
    isActual: patch.isActual ?? cur.isActual,
    updatedAt: now,
  };
  if (next.isPrimary) {
    for (let i = 0; i < list.length; i++) {
      if (i !== idx && isClientContactActive(list[i]!)) list[i] = { ...list[i]!, isPrimary: false };
    }
  }
  list[idx] = next;
  state.legalEntityContactsByKey[key] = list;
  pushDealerTimeline(state, dealerId, `Обновлён контакт юрлица: ${next.fullName}`, act.name);
  pushScopeTimeline(state, clientContactScopeKeyLegalEntity(dealerId, legalEntityId), `Обновлён контакт: ${next.fullName}`, act.name);
  saveClientContactsState(state);
}

export function setPrimaryLegalEntityContact(
  dealerId: string,
  legalEntityId: string,
  contactId: string,
  profile: ReleaseDemoProfile,
): void {
  const state = loadClientContactsState();
  const key = legalEntityContactsStorageKey(dealerId, legalEntityId);
  const list = [...(state.legalEntityContactsByKey[key] ?? [])];
  const act = actor(profile);
  const now = isoNow();
  const nextList = list.map((c) => {
    if (!isClientContactActive(c)) return c;
    if (c.id === contactId) return { ...c, isPrimary: true, updatedAt: now };
    return { ...c, isPrimary: false, updatedAt: now };
  });
  state.legalEntityContactsByKey[key] = nextList;
  const hit = nextList.find((c) => c.id === contactId);
  if (hit) {
    pushDealerTimeline(state, dealerId, `Основной контакт юрлица: ${hit.fullName}`, act.name);
    pushScopeTimeline(state, clientContactScopeKeyLegalEntity(dealerId, legalEntityId), `Назначен основной контакт: ${hit.fullName}`, act.name);
  }
  saveClientContactsState(state);
}

export function requestDeleteLegalEntityContact(
  dealerId: string,
  legalEntityId: string,
  contactId: string,
  reason: string,
  profile: ReleaseDemoProfile,
): void {
  const state = loadClientContactsState();
  const key = legalEntityContactsStorageKey(dealerId, legalEntityId);
  const list = [...(state.legalEntityContactsByKey[key] ?? [])];
  const idx = list.findIndex((c) => c.id === contactId);
  if (idx < 0) return;
  const act = actor(profile);
  const now = isoNow();
  const cur = list[idx]!;
  list[idx] = {
    ...cur,
    deleteRequestedAt: now,
    deleteRequestReason: reason.trim() || undefined,
    updatedAt: now,
  };
  state.legalEntityContactsByKey[key] = list;
  pushDealerTimeline(
    state,
    dealerId,
    `Запрошено снятие контакта юрлица «${cur.fullName}»${reason.trim() ? `: ${reason.trim()}` : ""}`,
    act.name,
  );
  pushScopeTimeline(
    state,
    clientContactScopeKeyLegalEntity(dealerId, legalEntityId),
    `Запрошено снятие контакта: ${cur.fullName}`,
    act.name,
  );
  saveClientContactsState(state);
}

function cloneContactFields(c: ClientContact): Omit<ClientContact, "id" | "createdAt" | "updatedAt" | "createdBy" | "createdByName" | "deleteRequestedAt" | "deleteRequestReason"> {
  return {
    fullName: c.fullName,
    role: c.role,
    phone: c.phone,
    whatsapp: c.whatsapp,
    telegram: c.telegram,
    email: c.email,
    comment: c.comment,
    isPrimary: false,
    isActual: true,
    source: "manual",
  };
}

function insertContactToDealerList(state: ClientContactsState, dealerId: string, base: ReturnType<typeof cloneContactFields>, profile: ReleaseDemoProfile): void {
  const act = actor(profile);
  const now = isoNow();
  const list = [...(state.dealerContactsByDealer[dealerId] ?? [])];
  let c: ClientContact = {
    ...base,
    id: newContactId(`dc-${dealerId}`),
    isPrimary: false,
    isActual: true,
    source: "manual",
    createdAt: now,
    updatedAt: now,
    createdBy: act.id,
    createdByName: act.name,
  };
  c = ensurePrimaryWhenFirstInScope(list, c);
  if (c.isPrimary) {
    for (let i = 0; i < list.length; i++) {
      if (isClientContactActive(list[i]!)) list[i] = { ...list[i]!, isPrimary: false };
    }
  }
  state.dealerContactsByDealer[dealerId] = [c, ...list];
}

function insertContactToTradePointList(
  state: ClientContactsState,
  dealerId: string,
  tradePointId: string,
  base: ReturnType<typeof cloneContactFields>,
  profile: ReleaseDemoProfile,
): void {
  const act = actor(profile);
  const now = isoNow();
  const key = tradePointContactsStorageKey(dealerId, tradePointId);
  const list = [...(state.tradePointContactsByKey[key] ?? [])];
  let c: ClientContact = {
    ...base,
    id: newContactId(`tpc-${dealerId}`),
    isPrimary: false,
    isActual: true,
    source: "manual",
    createdAt: now,
    updatedAt: now,
    createdBy: act.id,
    createdByName: act.name,
  };
  c = ensurePrimaryWhenFirstInScope(list, c);
  if (c.isPrimary) {
    for (let i = 0; i < list.length; i++) {
      if (isClientContactActive(list[i]!)) list[i] = { ...list[i]!, isPrimary: false };
    }
  }
  state.tradePointContactsByKey[key] = [c, ...list];
}

function insertContactToLegalEntityList(
  state: ClientContactsState,
  dealerId: string,
  legalEntityId: string,
  base: ReturnType<typeof cloneContactFields>,
  profile: ReleaseDemoProfile,
): void {
  const act = actor(profile);
  const now = isoNow();
  const key = legalEntityContactsStorageKey(dealerId, legalEntityId);
  const list = [...(state.legalEntityContactsByKey[key] ?? [])];
  let c: ClientContact = {
    ...base,
    id: newContactId(`lec-${dealerId}`),
    isPrimary: false,
    isActual: true,
    source: "manual",
    createdAt: now,
    updatedAt: now,
    createdBy: act.id,
    createdByName: act.name,
  };
  c = ensurePrimaryWhenFirstInScope(list, c);
  if (c.isPrimary) {
    for (let i = 0; i < list.length; i++) {
      if (isClientContactActive(list[i]!)) list[i] = { ...list[i]!, isPrimary: false };
    }
  }
  state.legalEntityContactsByKey[key] = [c, ...list];
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

function sourceLabelForCopy(row: DealerRow, source: ContactCopySource): string {
  if (source.type === "dealer") return "карточки дилера";
  if (source.type === "legalEntity" && source.legalEntityId) {
    const le = getMergedDealerLegalEntities(row).find((x) => x.id === source.legalEntityId);
    return `юрлица «${le?.name ?? source.legalEntityId}»`;
  }
  if (source.type === "tradePoint" && source.tradePointId) {
    const tp = getMergedDealerTradePoints(row, { includeArchived: true }).find((x) => x.point.id === source.tradePointId);
    return `торговой точки «${tp?.point.name ?? source.tradePointId}»`;
  }
  return "другого раздела";
}

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

export function copyContactToScopes(
  dealerId: string,
  source: ContactCopySource,
  destinations: ContactCopyDestinations,
  profile: ReleaseDemoProfile,
  row: DealerRow,
): { ok: boolean; error?: string } {
  const state = loadClientContactsState();
  const src = resolveSourceContact(state, dealerId, source);
  if (!src) return { ok: false, error: "Контакт не найден." };
  const base = cloneContactFields(src);
  const act = actor(profile);

  const targets: { kind: string; label: string; fn: () => void; scopeKey: string; scopeLine: string }[] = [];

  if (destinations.toDealer) {
    targets.push({
      kind: "dealer",
      label: "карточку дилера",
      fn: () => insertContactToDealerList(state, dealerId, base, profile),
      scopeKey: clientContactScopeKeyDealer(dealerId),
      scopeLine: `Добавлен контакт из ${sourceLabelForCopy(row, source)}: ${base.fullName}`,
    });
  }
  if (destinations.toAllLegalEntities) {
    const les = getMergedDealerLegalEntities(row).filter((e) => e.status !== "archived");
    for (const le of les) {
      const skipSelf =
        source.type === "legalEntity" && source.legalEntityId === le.id;
      if (skipSelf) continue;
      const id = le.id;
      targets.push({
        kind: "le",
        label: le.name,
        fn: () => insertContactToLegalEntityList(state, dealerId, id, base, profile),
        scopeKey: clientContactScopeKeyLegalEntity(dealerId, id),
        scopeLine: `Добавлен контакт из ${sourceLabelForCopy(row, source)}: ${base.fullName}`,
      });
    }
  }
  if (destinations.toAllTradePoints) {
    const tps = getMergedDealerTradePoints(row, { includeArchived: false });
    for (const { point } of tps) {
      const skipSelf = source.type === "tradePoint" && source.tradePointId === point.id;
      if (skipSelf) continue;
      targets.push({
        kind: "tp",
        label: point.name,
        fn: () => insertContactToTradePointList(state, dealerId, point.id, base, profile),
        scopeKey: clientContactScopeKeyTradePoint(dealerId, point.id),
        scopeLine: `Добавлен контакт из ${sourceLabelForCopy(row, source)}: ${base.fullName}`,
      });
    }
  }
  for (const leId of destinations.manualLegalEntityIds) {
    if (destinations.toAllLegalEntities) continue;
    const skipSelf = source.type === "legalEntity" && source.legalEntityId === leId;
    if (skipSelf) continue;
    const le = getMergedDealerLegalEntities(row).find((x) => x.id === leId);
    targets.push({
      kind: "le",
      label: le?.name ?? leId,
      fn: () => insertContactToLegalEntityList(state, dealerId, leId, base, profile),
      scopeKey: clientContactScopeKeyLegalEntity(dealerId, leId),
      scopeLine: `Добавлен контакт из ${sourceLabelForCopy(row, source)}: ${base.fullName}`,
    });
  }
  for (const tpId of destinations.manualTradePointIds) {
    if (destinations.toAllTradePoints) continue;
    const skipSelf = source.type === "tradePoint" && source.tradePointId === tpId;
    if (skipSelf) continue;
    const tp = getMergedDealerTradePoints(row, { includeArchived: true }).find((x) => x.point.id === tpId);
    targets.push({
      kind: "tp",
      label: tp?.point.name ?? tpId,
      fn: () => insertContactToTradePointList(state, dealerId, tpId, base, profile),
      scopeKey: clientContactScopeKeyTradePoint(dealerId, tpId),
      scopeLine: `Добавлен контакт из ${sourceLabelForCopy(row, source)}: ${base.fullName}`,
    });
  }

  if (targets.length === 0) return { ok: false, error: "Выберите хотя бы одно назначение." };

  for (const t of targets) t.fn();

  const leLabels = targets.filter((t) => t.kind === "le").map((t) => t.label);
  const tpLabels = targets.filter((t) => t.kind === "tp").map((t) => t.label);
  const hasDealer = targets.some((t) => t.kind === "dealer");
  const summaryParts: string[] = [];
  if (hasDealer) summaryParts.push("карточку дилера");
  if (leLabels.length) summaryParts.push(`юрлица: ${leLabels.join(", ")}`);
  if (tpLabels.length) summaryParts.push(`торговые точки: ${tpLabels.join(", ")}`);
  pushDealerTimeline(state, dealerId, `Контакт скопирован (${base.fullName}) — ${summaryParts.join("; ")}`, act.name);
  for (const t of targets) {
    pushScopeTimeline(state, t.scopeKey, t.scopeLine, act.name);
  }
  saveClientContactsState(state);
  return { ok: true };
}
