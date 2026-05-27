/**
 * Контакты клиента в Postgres (Промт 66).
 */

export type ClientContactScope = "dealer" | "legal_entity" | "trade_point";

export type ClientContactRow = {
  id: string;
  clientId: string;
  scope: ClientContactScope;
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

export type ClientContactEventRow = {
  id: string;
  clientId: string;
  scope: string | null;
  scopeRef: string | null;
  body: string;
  actorUserId: string | null;
  actorName: string | null;
  at: string;
};

export function mapClientContactRow(r: Record<string, unknown>): ClientContactRow {
  return {
    id: String(r.id),
    clientId: String(r.client_id),
    scope: String(r.scope) as ClientContactScope,
    scopeRef: r.scope_ref != null ? String(r.scope_ref) : null,
    fullName: String(r.full_name),
    role: r.role != null ? String(r.role) : null,
    phone: r.phone != null ? String(r.phone) : null,
    whatsapp: r.whatsapp != null ? String(r.whatsapp) : null,
    telegram: r.telegram != null ? String(r.telegram) : null,
    email: r.email != null ? String(r.email) : null,
    comment: r.comment != null ? String(r.comment) : null,
    isPrimary: Boolean(r.is_primary),
    isActual: Boolean(r.is_actual),
    source: String(r.source ?? "manual"),
    deleteRequestedAt: r.delete_requested_at != null ? String(r.delete_requested_at) : null,
    deleteRequestReason: r.delete_request_reason != null ? String(r.delete_request_reason) : null,
    createdByUserId: r.created_by_user_id != null ? String(r.created_by_user_id) : null,
    createdByName: r.created_by_name != null ? String(r.created_by_name) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapClientContactEventRow(r: Record<string, unknown>): ClientContactEventRow {
  return {
    id: String(r.id),
    clientId: String(r.client_id),
    scope: r.scope != null ? String(r.scope) : null,
    scopeRef: r.scope_ref != null ? String(r.scope_ref) : null,
    body: String(r.body),
    actorUserId: r.actor_user_id != null ? String(r.actor_user_id) : null,
    actorName: r.actor_name != null ? String(r.actor_name) : null,
    at: String(r.at),
  };
}

export function scopeKeyFromParts(clientId: string, scope: ClientContactScope | null, scopeRef: string | null): string {
  if (scope === "legal_entity" && scopeRef) return `legalEntity:${clientId}|${scopeRef}`;
  if (scope === "trade_point" && scopeRef) return `tradePoint:${clientId}|${scopeRef}`;
  return `dealer:${clientId}`;
}

export function parseScopeKey(scopeKey: string): { scope: ClientContactScope | null; scopeRef: string | null } {
  if (scopeKey.startsWith("legalEntity:")) {
    const parts = scopeKey.slice("legalEntity:".length).split("|");
    return { scope: "legal_entity", scopeRef: parts[1] ?? null };
  }
  if (scopeKey.startsWith("tradePoint:")) {
    const parts = scopeKey.slice("tradePoint:".length).split("|");
    return { scope: "trade_point", scopeRef: parts[1] ?? null };
  }
  if (scopeKey.startsWith("dealer:")) return { scope: "dealer", scopeRef: null };
  return { scope: null, scopeRef: null };
}
