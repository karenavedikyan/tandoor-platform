/**
 * HTTP API юрлиц дилера (полный набор полей, Промт 67).
 */

import type {
  DealerLegalEntitiesState,
  DealerLegalEntity,
  DealerLegalEntityHistoryEntry,
} from "@/lib/dealer-legal-entities";

export const DEALER_LEGAL_ENTITIES_MIGRATED_KEY_PREFIX = "tandoor-dealer-legal-entities-migrated-v1-";

type LegalEntityFullDto = {
  id: string;
  clientId: string;
  name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  legalAddress: string | null;
  actualAddress: string | null;
  entityType: string | null;
  primaryContact: string | null;
  phone: string | null;
  email: string | null;
  internalCode: string | null;
  status: string;
  comment: string | null;
  paymentForm?: string | null;
  paymentDelayDays?: number | null;
  creditLimitRub?: string | null;
  edoEnabled?: boolean | null;
  edoOperator?: string | null;
  updatedByUserId: string | null;
  updatedByName: string | null;
  source: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

type LegalEntityHistoryDto = {
  id: string;
  clientId: string;
  legalEntityId: string | null;
  at: string;
  meta: string | null;
  body: string;
  actorUserId: string | null;
  actorName: string | null;
};

export type LegalEntitiesListFullPayload = {
  entities: LegalEntityFullDto[];
  history: LegalEntityHistoryDto[];
};

type ApiOk<T> = { success: true } & T;
type ApiErr = { success: false; code?: string; message?: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function mapDtoToEntity(d: LegalEntityFullDto): DealerLegalEntity {
  return {
    id: d.id,
    internalCode: d.internalCode ?? undefined,
    entityType: d.entityType ?? undefined,
    name: d.name?.trim() || "—",
    inn: d.inn ?? undefined,
    kpp: d.kpp ?? undefined,
    ogrn: d.ogrn ?? undefined,
    legalAddress: d.legalAddress ?? undefined,
    actualAddress: d.actualAddress ?? undefined,
    primaryContact: d.primaryContact ?? undefined,
    phone: d.phone ?? undefined,
    email: d.email ?? undefined,
    status: (d.isArchived || d.status === "archived" ? "archived" : d.status) as DealerLegalEntity["status"],
    comment: d.comment ?? undefined,
    paymentForm: (d.paymentForm as DealerLegalEntity["paymentForm"]) ?? undefined,
    paymentDelayDays: d.paymentDelayDays ?? undefined,
    creditLimitRub: d.creditLimitRub ?? undefined,
    edoEnabled: d.edoEnabled ?? undefined,
    edoOperator: d.edoOperator ?? undefined,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    updatedBy: d.updatedByUserId ?? "",
    updatedByName: d.updatedByName ?? "",
  };
}

function mapHistoryDto(d: LegalEntityHistoryDto): DealerLegalEntityHistoryEntry {
  const name = d.actorName?.trim() || "—";
  const meta =
    d.meta?.trim() ||
    (() => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.at.trim());
      if (!m) return `${d.at.trim()} · ${name}`;
      return `${m[3]}.${m[2]}.${m[1]} · ${name}`;
    })();
  return { id: d.id, at: d.at, meta, body: d.body };
}

export function bundleListFullToState(clientId: string, payload: LegalEntitiesListFullPayload): DealerLegalEntitiesState {
  return {
    entitiesByDealer: {
      [clientId]: payload.entities.map(mapDtoToEntity),
    },
    historyByDealer: {
      [clientId]: payload.history.map(mapHistoryDto),
    },
  };
}

export async function fetchListFull(clientId: string): Promise<LegalEntitiesListFullPayload | null> {
  try {
    const res = await fetch(`/api/legal-entities/list-full?clientId=${encodeURIComponent(clientId)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<LegalEntitiesListFullPayload & { clientId: string }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return { entities: data.entities, history: data.history };
  } catch {
    return null;
  }
}

export async function apiCreateFull(body: Record<string, unknown>): Promise<{ ok: boolean; id?: string }> {
  const res = await fetch("/api/legal-entities/create-full", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false };
  const data = await parseJson<ApiOk<{ item: LegalEntityFullDto }> | ApiErr>(res);
  if (!data.success) return { ok: false };
  return { ok: true, id: data.item.id };
}

export async function apiPatchFull(id: string, body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/legal-entities/patch-full?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function apiArchiveLegalEntity(
  id: string,
  updatedBy: string,
  updatedByName: string,
): Promise<boolean> {
  const res = await fetch("/api/legal-entities/archive", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, updatedByUserId: updatedBy, updatedByName }),
  });
  return res.ok;
}

export async function apiDeleteLegalEntity(id: string): Promise<boolean> {
  const res = await fetch(`/api/legal-entities/delete?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok;
}

export async function apiBulkImport(body: Record<string, unknown>): Promise<{ ok: boolean; status: number }> {
  const res = await fetch("/api/legal-entities/bulk-import", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok || res.status === 409, status: res.status };
}

export function buildBulkImportPayloadFromLocal(
  clientId: string,
  local: DealerLegalEntitiesState,
): Record<string, unknown> {
  return {
    clientId,
    entities: local.entitiesByDealer[clientId] ?? [],
    history: local.historyByDealer[clientId] ?? [],
  };
}
