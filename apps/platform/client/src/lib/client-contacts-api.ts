/**
 * HTTP API контактов клиента (Postgres).
 */

import type { ClientContact, ClientContactsState, ContactTimelineEntry } from "@/lib/client-contacts";

function legalEntityContactsStorageKey(dealerId: string, legalEntityId: string): string {
  return `${dealerId}|${legalEntityId}`;
}

function tradePointContactsStorageKey(dealerId: string, tradePointId: string): string {
  return `${dealerId}|${tradePointId}`;
}
type ClientContactRow = {
  id: string;
  clientId: string;
  scope: "dealer" | "legal_entity" | "trade_point";
  scopeRef: string | null;
  fullName: string;
  role: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
  email: string | null;
  comment: string | null;
  isPrimary: boolean;
  isActual: boolean;
  source: string;
  deleteRequestedAt: string | null;
  deleteRequestReason: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

type ClientContactEventRow = {
  id: string;
  clientId: string;
  scope: string | null;
  scopeRef: string | null;
  body: string;
  actorUserId: string | null;
  actorName: string | null;
  at: string;
};

export const CLIENT_CONTACTS_MIGRATED_KEY_PREFIX = "tandoor-client-contacts-migrated-v1-";

type ApiOk<T> = { success: true } & T;
type ApiErr = { success: false; code?: string; message?: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export type ClientContactsListPayload = {
  items: ClientContactRow[];
  dealerTimeline: ClientContactEventRow[];
  scopeTimelines: Record<string, ClientContactEventRow[]>;
};

function mapEventToTimeline(e: ClientContactEventRow): ContactTimelineEntry {
  const name = e.actorName?.trim() || "—";
  return {
    id: e.id,
    at: e.at,
    meta: formatMetaRu(e.at, name),
    body: e.body,
  };
}

function formatMetaRu(iso: string, name: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return `${iso.trim()} · ${name}`;
  return `${m[3]}.${m[2]}.${m[1]} · ${name}`;
}

function mapRowToContact(r: ClientContactRow): ClientContact {
  return {
    id: r.id,
    fullName: r.fullName,
    role: r.role ?? undefined,
    phone: r.phone ?? undefined,
    whatsapp: r.whatsapp ?? undefined,
    telegram: r.telegram ?? undefined,
    email: r.email ?? undefined,
    comment: r.comment ?? undefined,
    isPrimary: r.isPrimary,
    isActual: r.isActual,
    source: r.source,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    createdBy: r.createdByUserId ?? "",
    createdByName: r.createdByName ?? undefined,
    deleteRequestedAt: r.deleteRequestedAt ?? undefined,
    deleteRequestReason: r.deleteRequestReason ?? undefined,
  };
}

export function bundleListPayloadToState(clientId: string, payload: ClientContactsListPayload): ClientContactsState {
  const state = {
    dealerContactsByDealer: {} as Record<string, ClientContact[]>,
    tradePointContactsByKey: {} as Record<string, ClientContact[]>,
    legalEntityContactsByKey: {} as Record<string, ClientContact[]>,
    dealerTimelineByDealer: {} as Record<string, ContactTimelineEntry[]>,
    scopeTimelineByScopeKey: {} as Record<string, ContactTimelineEntry[]>,
  };

  for (const row of payload.items) {
    const c = mapRowToContact(row);
    if (row.scope === "dealer") {
      const list = state.dealerContactsByDealer[clientId] ?? [];
      state.dealerContactsByDealer[clientId] = [...list, c];
    } else if (row.scope === "legal_entity" && row.scopeRef) {
      const key = legalEntityContactsStorageKey(clientId, row.scopeRef);
      const list = state.legalEntityContactsByKey[key] ?? [];
      state.legalEntityContactsByKey[key] = [...list, c];
    } else if (row.scope === "trade_point" && row.scopeRef) {
      const key = tradePointContactsStorageKey(clientId, row.scopeRef);
      const list = state.tradePointContactsByKey[key] ?? [];
      state.tradePointContactsByKey[key] = [...list, c];
    }
  }

  state.dealerTimelineByDealer[clientId] = payload.dealerTimeline.map(mapEventToTimeline);
  for (const [scopeKey, events] of Object.entries(payload.scopeTimelines)) {
    state.scopeTimelineByScopeKey[scopeKey] = events.map(mapEventToTimeline);
  }

  return state;
}

export async function fetchClientContactsList(clientId: string): Promise<ClientContactsListPayload | null> {
  try {
    const res = await fetch(`/api/client-contacts/list?clientId=${encodeURIComponent(clientId)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<ClientContactsListPayload & { clientId: string }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return {
      items: data.items,
      dealerTimeline: data.dealerTimeline,
      scopeTimelines: data.scopeTimelines,
    };
  } catch {
    return null;
  }
}

export async function apiCreateContact(body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch("/api/client-contacts/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function apiPatchContact(body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch("/api/client-contacts/patch", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function apiSetPrimaryContact(id: string): Promise<boolean> {
  const res = await fetch("/api/client-contacts/set-primary", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return res.ok;
}

export async function apiRequestDeleteContact(id: string, reason: string): Promise<boolean> {
  const res = await fetch("/api/client-contacts/request-delete", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, reason }),
  });
  return res.ok;
}

export async function apiCopyContactToScopes(body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch("/api/client-contacts/copy-to-scopes", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function apiBulkImportContacts(body: Record<string, unknown>): Promise<{ ok: boolean; status: number }> {
  const res = await fetch("/api/client-contacts/bulk-import", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok || res.status === 409, status: res.status };
}

export function buildBulkImportPayloadFromLocal(
  clientId: string,
  local: ClientContactsState,
): Record<string, unknown> {
  const legalEntityContacts: Record<string, ClientContact[]> = {};
  for (const [key, list] of Object.entries(local.legalEntityContactsByKey)) {
    if (!key.startsWith(`${clientId}|`)) continue;
    const leId = key.slice(clientId.length + 1);
    legalEntityContacts[leId] = list;
  }
  const tradePointContacts: Record<string, ClientContact[]> = {};
  for (const [key, list] of Object.entries(local.tradePointContactsByKey)) {
    if (!key.startsWith(`${clientId}|`)) continue;
    const tpId = key.slice(clientId.length + 1);
    tradePointContacts[tpId] = list;
  }
  const scopeEvents: Record<string, ContactTimelineEntry[]> = {};
  for (const [scopeKey, events] of Object.entries(local.scopeTimelineByScopeKey)) {
    if (!scopeKey.includes(clientId)) continue;
    scopeEvents[scopeKey] = events;
  }
  return {
    clientId,
    dealerContacts: local.dealerContactsByDealer[clientId] ?? [],
    legalEntityContacts,
    tradePointContacts,
    dealerEvents: local.dealerTimelineByDealer[clientId] ?? [],
    scopeEvents,
  };
}

export function scopeApiFields(
  scope: "dealer" | "legalEntity" | "tradePoint",
  dealerId: string,
  refId?: string,
): { scope: string; scopeRef?: string } {
  if (scope === "dealer") return { scope: "dealer" };
  if (scope === "legalEntity") return { scope: "legal_entity", scopeRef: refId };
  return { scope: "trade_point", scopeRef: refId };
}
