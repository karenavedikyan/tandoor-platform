/**
 * Комментарии клиента и ТТ (Postgres) — Промт 69.
 */

export type ClientCommentScope = "dealer" | "trade_point";

export type ClientCommentRow = {
  id: string;
  clientId: string;
  scope: ClientCommentScope;
  scopeRef: string | null;
  type: string;
  body: string;
  isDeleted: boolean;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

const COMMENT_TYPES = new Set(["general", "problem", "competitor"]);

export function parseCommentType(raw: unknown, scope: ClientCommentScope): string {
  if (scope === "trade_point") return "general";
  if (typeof raw !== "string") return "general";
  const t = raw.trim();
  return COMMENT_TYPES.has(t) ? t : "general";
}

export function mapClientCommentRow(r: Record<string, unknown>): ClientCommentRow {
  const scope = String(r.scope) as ClientCommentScope;
  return {
    id: String(r.id),
    clientId: String(r.client_id),
    scope,
    scopeRef: r.scope_ref != null ? String(r.scope_ref) : null,
    type: String(r.type ?? "general"),
    body: String(r.body),
    isDeleted: Boolean(r.is_deleted),
    createdByUserId: r.created_by_user_id != null ? String(r.created_by_user_id) : null,
    createdByName: r.created_by_name != null ? String(r.created_by_name) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}
