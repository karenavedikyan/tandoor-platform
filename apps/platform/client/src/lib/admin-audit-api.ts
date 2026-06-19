/**
 * Клиентский доступ к `/api/admin/audit/list`.
 */

export type AuditSource =
  | "general"
  | "client_assignments"
  | "dealer_responsibility"
  | "scope_diagnostics"
  | "overrides_api";

export type AuditRowDto = {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorFullName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  details: Record<string, unknown>;
};

export type AuditListResult = {
  source: AuditSource;
  rows: AuditRowDto[];
  total: number;
  limit: number;
  offset: number;
};

export const AUDIT_SOURCE_OPTIONS: { id: AuditSource; label: string }[] = [
  { id: "general", label: "Общий журнал" },
  { id: "client_assignments", label: "Назначения клиентов" },
  { id: "dealer_responsibility", label: "Ответственные дилера" },
  { id: "scope_diagnostics", label: "Диагностика scope" },
  { id: "overrides_api", label: "Overrides API" },
];

function parseRow(raw: unknown): AuditRowDto | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const occurredAt = typeof r.occurredAt === "string" ? r.occurredAt : null;
  const action = typeof r.action === "string" ? r.action : null;
  const summary = typeof r.summary === "string" ? r.summary : null;
  if (!id || !occurredAt || !action || summary == null) return null;
  const details =
    r.details != null && typeof r.details === "object" && !Array.isArray(r.details)
      ? (r.details as Record<string, unknown>)
      : {};
  return {
    id,
    occurredAt,
    actorUserId: r.actorUserId === null ? null : typeof r.actorUserId === "string" ? r.actorUserId : null,
    actorFullName: r.actorFullName === null ? null : typeof r.actorFullName === "string" ? r.actorFullName : null,
    actorEmail: r.actorEmail === null ? null : typeof r.actorEmail === "string" ? r.actorEmail : null,
    actorRole: r.actorRole === null ? null : typeof r.actorRole === "string" ? r.actorRole : null,
    action,
    entityType: r.entityType === null ? null : typeof r.entityType === "string" ? r.entityType : null,
    entityId: r.entityId === null ? null : typeof r.entityId === "string" ? r.entityId : null,
    summary,
    details,
  };
}

export async function listAdminAudit(query: {
  source: AuditSource;
  actorUserId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  clientCode?: string;
  dealerId?: string;
  responsibleRole?: string;
  route?: string;
  responseStatus?: number;
}): Promise<AuditListResult> {
  const sp = new URLSearchParams();
  sp.set("source", query.source);
  if (query.actorUserId) sp.set("actorUserId", query.actorUserId);
  if (query.from) sp.set("from", query.from);
  if (query.to) sp.set("to", query.to);
  if (query.limit != null) sp.set("limit", String(query.limit));
  if (query.offset != null) sp.set("offset", String(query.offset));
  if (query.action) sp.set("action", query.action);
  if (query.entityType) sp.set("entityType", query.entityType);
  if (query.entityId) sp.set("entityId", query.entityId);
  if (query.clientCode) sp.set("clientCode", query.clientCode);
  if (query.dealerId) sp.set("dealerId", query.dealerId);
  if (query.responsibleRole) sp.set("responsibleRole", query.responsibleRole);
  if (query.route) sp.set("route", query.route);
  if (query.responseStatus != null) sp.set("responseStatus", String(query.responseStatus));

  const res = await fetch(`/api/admin/audit/list?${sp.toString()}`, { method: "GET", credentials: "same-origin" });
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok || j.success !== true) {
    const message = typeof j.message === "string" ? j.message : "Не удалось загрузить журнал.";
    throw new Error(message);
  }
  const source = typeof j.source === "string" ? (j.source as AuditSource) : query.source;
  const total = typeof j.total === "number" ? j.total : Number(j.total);
  const limit = typeof j.limit === "number" ? j.limit : Number(j.limit);
  const offset = typeof j.offset === "number" ? j.offset : Number(j.offset);
  if (!Number.isFinite(total) || !Number.isFinite(limit) || !Number.isFinite(offset)) {
    throw new Error("Некорректный ответ сервера.");
  }
  const rawRows = j.rows;
  if (!Array.isArray(rawRows)) throw new Error("Некорректный ответ сервера.");
  const rows: AuditRowDto[] = [];
  for (const el of rawRows) {
    const row = parseRow(el);
    if (row) rows.push(row);
  }
  return { source, rows, total, limit, offset };
}

/** @deprecated use listAdminAudit */
export type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: { id: string; email: string; fullName: string | null } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

/** @deprecated use listAdminAudit */
export async function listAudit(query: {
  actor?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; items: AuditItem[] }> {
  const result = await listAdminAudit({
    source: "general",
    actorUserId: query.actor,
    action: query.action,
    entityType: query.entityType,
    entityId: query.entityId,
    from: query.from,
    to: query.to,
    limit: query.limit,
    offset: query.offset,
  });
  const items: AuditItem[] = result.rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType ?? "",
    entityId: r.entityId ?? "",
    actor:
      r.actorUserId && r.actorEmail
        ? { id: r.actorUserId, email: r.actorEmail, fullName: r.actorFullName }
        : null,
    metadata: r.details,
    createdAt: r.occurredAt,
  }));
  return { total: result.total, items };
}

export function downloadAuditCsv(rows: AuditRowDto[]): void {
  const header = ["occurredAt", "actor", "actorRole", "action", "entityType", "entityId", "summary", "detailsJson"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const r of rows) {
    const actor = r.actorFullName?.trim() || r.actorEmail?.trim() || r.actorUserId || "system";
    lines.push(
      [
        escape(r.occurredAt),
        escape(actor),
        escape(r.actorRole ?? ""),
        escape(r.action),
        escape(r.entityType ?? ""),
        escape(r.entityId ?? ""),
        escape(r.summary),
        escape(JSON.stringify(r.details)),
      ].join(","),
    );
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
