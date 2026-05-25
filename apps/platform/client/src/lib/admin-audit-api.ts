/**
 * Клиентский доступ к `GET /api/admin/audit-list`.
 */

export type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: { id: string; email: string; fullName: string | null } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditListResult = { total: number; items: AuditItem[] };

function parseActor(raw: unknown): AuditItem["actor"] {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const email = typeof o.email === "string" ? o.email : null;
  if (!id || !email) return null;
  const fullName = o.fullName === null ? null : typeof o.fullName === "string" ? o.fullName : null;
  return { id, email, fullName };
}

function parseItem(raw: unknown): AuditItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const action = typeof r.action === "string" ? r.action : null;
  const entityType = typeof r.entityType === "string" ? r.entityType : null;
  const entityId = typeof r.entityId === "string" ? r.entityId : null;
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : null;
  if (!id || !action || !entityType || !entityId || !createdAt) return null;
  let metadata: Record<string, unknown> | null = null;
  if (r.metadata != null && typeof r.metadata === "object" && !Array.isArray(r.metadata)) {
    metadata = r.metadata as Record<string, unknown>;
  }
  return {
    id,
    action,
    entityType,
    entityId,
    actor: parseActor(r.actor),
    metadata,
    createdAt,
  };
}

export async function listAudit(query: {
  actor?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditListResult> {
  const sp = new URLSearchParams();
  if (query.actor) sp.set("actor", query.actor);
  if (query.action) sp.set("action", query.action);
  if (query.entityType) sp.set("entityType", query.entityType);
  if (query.entityId) sp.set("entityId", query.entityId);
  if (query.from) sp.set("from", query.from);
  if (query.to) sp.set("to", query.to);
  if (query.limit != null) sp.set("limit", String(query.limit));
  if (query.offset != null) sp.set("offset", String(query.offset));

  const qs = sp.toString();
  const url = `/api/admin/audit-list${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { method: "GET", credentials: "same-origin" });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok || j.success !== true) {
    const message = typeof j.message === "string" ? j.message : "Не удалось загрузить журнал.";
    throw new Error(message);
  }
  const total = typeof j.total === "number" ? j.total : Number(j.total);
  if (!Number.isFinite(total)) throw new Error("Некорректный ответ сервера.");
  const rawItems = j.items;
  if (!Array.isArray(rawItems)) throw new Error("Некорректный ответ сервера.");
  const items: AuditItem[] = [];
  for (const el of rawItems) {
    const it = parseItem(el);
    if (it) items.push(it);
  }
  return { total, items };
}
