/**
 * Admin audit UI (Промт 430): read-only list across audit tables.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../server/db/neon-client.js";
import { resolveCurrentUser, sendJson, type DbUserRow } from "./admin-auth.js";

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

export type AuditListQuery = {
  source: AuditSource;
  actorUserId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  clientCode?: string;
  dealerId?: string;
  responsibleRole?: string;
  route?: string;
  responseStatus?: number;
};

export const AUDIT_SOURCES: { id: AuditSource; label: string }[] = [
  { id: "general", label: "Общий журнал" },
  { id: "client_assignments", label: "Назначения клиентов" },
  { id: "dealer_responsibility", label: "Ответственные дилера" },
  { id: "scope_diagnostics", label: "Диагностика scope" },
  { id: "overrides_api", label: "Overrides API" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUDIT_SOURCES_SET = new Set<string>(AUDIT_SOURCES.map((s) => s.id));

function qs(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0]!.trim();
  return undefined;
}

function parseIsoMs(raw: string | undefined, label: string): { ok: true; ms: number } | { ok: false; message: string } {
  if (raw == null || raw === "") return { ok: true, ms: NaN };
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return { ok: false, message: `Некорректная дата «${label}».` };
  return { ok: true, ms: t };
}

function userDisplayName(fullName: string | null | undefined, email: string | null | undefined): string {
  const n = fullName?.trim();
  if (n) return n;
  const e = email?.trim();
  if (e) return e;
  return "—";
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p != null && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      return { raw };
    }
  }
  return {};
}

function buildGeneralSummary(
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> | null,
): string {
  const meta = metadata ?? {};
  if (action.includes("impersonate")) {
    const target =
      (typeof meta.targetEmail === "string" && meta.targetEmail) ||
      (typeof meta.targetUserId === "string" && meta.targetUserId) ||
      entityId;
    return `${action} → ${target}`;
  }
  if (action.includes("bulk")) {
    const ids = meta.dealerIds ?? meta.tpIds ?? meta.ids;
    if (Array.isArray(ids)) return `${action} → ${ids.length} записей`;
    if (typeof meta.count === "number") return `${action} → ${meta.count} записей`;
    if (typeof meta.dealerCount === "number") return `${action} → ${meta.dealerCount} дилеров`;
  }
  if (entityType && entityId) return `${action} · ${entityType} · ${entityId}`;
  if (entityType) return `${action} · ${entityType}`;
  return action;
}

export function parseAuditListQuery(q: Record<string, unknown>): AuditListQuery | { error: string } {
  const sourceRaw = qs(q.source);
  if (!sourceRaw || !AUDIT_SOURCES_SET.has(sourceRaw)) {
    return { error: "Укажите корректный source." };
  }
  const source = sourceRaw as AuditSource;

  const actorUserId = qs(q.actorUserId) ?? qs(q.actor);
  if (actorUserId != null && actorUserId !== "" && !UUID_RE.test(actorUserId)) {
    return { error: "Некорректный фильтр по актору." };
  }

  const fromRaw = qs(q.from);
  const toRaw = qs(q.to);
  const fromParsed = parseIsoMs(fromRaw, "с");
  if (!fromParsed.ok) return { error: fromParsed.message };
  const toParsed = parseIsoMs(toRaw, "по");
  if (!toParsed.ok) return { error: toParsed.message };

  let limit = 50;
  const limitRaw = qs(q.limit);
  if (limitRaw != null && limitRaw !== "") {
    const n = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 200) return { error: "Параметр limit должен быть от 1 до 200." };
    limit = n;
  }

  let offset = 0;
  const offsetRaw = qs(q.offset);
  if (offsetRaw != null && offsetRaw !== "") {
    const n = Number.parseInt(offsetRaw, 10);
    if (!Number.isFinite(n) || n < 0) return { error: "Параметр offset должен быть неотрицательным." };
    offset = n;
  }

  const responseStatusRaw = qs(q.responseStatus);
  let responseStatus: number | undefined;
  if (responseStatusRaw != null && responseStatusRaw !== "") {
    const n = Number.parseInt(responseStatusRaw, 10);
    if (!Number.isFinite(n)) return { error: "Некорректный responseStatus." };
    responseStatus = n;
  }

  return {
    source,
    actorUserId: actorUserId || undefined,
    from: fromRaw && Number.isFinite(fromParsed.ms) ? new Date(fromParsed.ms).toISOString() : undefined,
    to: toRaw && Number.isFinite(toParsed.ms) ? new Date(toParsed.ms).toISOString() : undefined,
    limit,
    offset,
    action: qs(q.action),
    entityType: qs(q.entityType),
    entityId: qs(q.entityId),
    clientCode: qs(q.clientCode),
    dealerId: qs(q.dealerId),
    responsibleRole: qs(q.responsibleRole),
    route: qs(q.route),
    responseStatus,
  };
}

export function canAccessAdminAudit(role: string): boolean {
  return role === "admin" || role === "director";
}

type WhereBuild = { whereSql: string; params: unknown[] };

function appendTimeRange(
  column: string,
  from: string | undefined,
  to: string | undefined,
  parts: string[],
  params: unknown[],
): void {
  if (from) {
    params.push(from);
    parts.push(`${column} >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    parts.push(`${column} <= $${params.length}::timestamptz`);
  }
}

function appendEq(parts: string[], params: unknown[], column: string, value: string | undefined): void {
  if (!value) return;
  params.push(value);
  parts.push(`${column} = $${params.length}`);
}

function appendEqUuid(parts: string[], params: unknown[], column: string, value: string | undefined): void {
  if (!value) return;
  params.push(value);
  parts.push(`${column} = $${params.length}::uuid`);
}

function buildGeneralWhere(query: AuditListQuery): WhereBuild {
  const parts: string[] = [];
  const params: unknown[] = [];
  appendEqUuid(parts, params, "al.actor_user_id", query.actorUserId);
  appendEq(parts, params, "al.action", query.action);
  appendEq(parts, params, "al.entity_type", query.entityType);
  appendEq(parts, params, "al.entity_id", query.entityId);
  appendTimeRange("al.created_at", query.from, query.to, parts, params);
  return { whereSql: parts.length ? parts.join(" AND ") : "TRUE", params };
}

function buildClientAssignmentsWhere(query: AuditListQuery): WhereBuild {
  const parts: string[] = [];
  const params: unknown[] = [];
  appendEqUuid(parts, params, "cah.actor_user_id", query.actorUserId);
  appendEq(parts, params, "cah.client_code", query.clientCode);
  appendTimeRange("cah.created_at", query.from, query.to, parts, params);
  return { whereSql: parts.length ? parts.join(" AND ") : "TRUE", params };
}

function buildDealerResponsibilityWhere(query: AuditListQuery): WhereBuild {
  const parts: string[] = [];
  const params: unknown[] = [];
  appendEqUuid(parts, params, "drh.actor_user_id", query.actorUserId);
  appendEq(parts, params, "drh.dealer_id", query.dealerId);
  appendEq(parts, params, "drh.responsible_role", query.responsibleRole);
  appendTimeRange("drh.created_at", query.from, query.to, parts, params);
  return { whereSql: parts.length ? parts.join(" AND ") : "TRUE", params };
}

function buildScopeDiagnosticsWhere(query: AuditListQuery): WhereBuild {
  const parts: string[] = [];
  const params: unknown[] = [];
  appendEqUuid(parts, params, "rsal.user_id", query.actorUserId);
  appendTimeRange("rsal.occurred_at", query.from, query.to, parts, params);
  return { whereSql: parts.length ? parts.join(" AND ") : "TRUE", params };
}

function buildOverridesApiWhere(query: AuditListQuery): WhereBuild {
  const parts: string[] = [];
  const params: unknown[] = [];
  appendEqUuid(parts, params, "oal.actor_user_id", query.actorUserId);
  appendEq(parts, params, "oal.route", query.route);
  if (query.responseStatus != null) {
    params.push(query.responseStatus);
    parts.push(`oal.response_status = $${params.length}`);
  }
  appendTimeRange("oal.created_at", query.from, query.to, parts, params);
  return { whereSql: parts.length ? parts.join(" AND ") : "TRUE", params };
}

function mapActorFields(row: {
  actor_user_id?: string | null;
  actor_full_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
}): Pick<AuditRowDto, "actorUserId" | "actorFullName" | "actorEmail" | "actorRole"> {
  return {
    actorUserId: row.actor_user_id != null ? String(row.actor_user_id) : null,
    actorFullName: row.actor_full_name != null ? String(row.actor_full_name) : null,
    actorEmail: row.actor_email != null ? String(row.actor_email) : null,
    actorRole: row.actor_role != null ? String(row.actor_role) : null,
  };
}

export async function fetchAuditList(
  pool: PoolLike,
  query: AuditListQuery,
): Promise<{ source: AuditSource; rows: AuditRowDto[]; total: number; limit: number; offset: number }> {
  switch (query.source) {
    case "general":
      return fetchGeneralAudit(pool, query);
    case "client_assignments":
      return fetchClientAssignmentsAudit(pool, query);
    case "dealer_responsibility":
      return fetchDealerResponsibilityAudit(pool, query);
    case "scope_diagnostics":
      return fetchScopeDiagnosticsAudit(pool, query);
    case "overrides_api":
      return fetchOverridesApiAudit(pool, query);
    default:
      return { source: query.source, rows: [], total: 0, limit: query.limit, offset: query.offset };
  }
}

async function fetchGeneralAudit(pool: PoolLike, query: AuditListQuery) {
  const { whereSql, params } = buildGeneralWhere(query);
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM audit_log al WHERE ${whereSql}`,
    params,
  );
  const total = countRes.rows[0]?.n ?? 0;
  const listParams = [...params, query.limit, query.offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const rows = await pool.query<{
    id: string;
    actor_user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    metadata: unknown;
    created_at: string;
    actor_full_name: string | null;
    actor_email: string | null;
    actor_role: string | null;
  }>(
    `SELECT al.id, al.actor_user_id, al.action, al.entity_type, al.entity_id, al.metadata, al.created_at,
            u.full_name AS actor_full_name, u.email AS actor_email, u.role AS actor_role
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.actor_user_id
      WHERE ${whereSql}
      ORDER BY al.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  );
  const mapped = rows.rows.map((r) => {
    const metadata = asRecord(r.metadata);
    return {
      id: r.id,
      occurredAt: r.created_at,
      ...mapActorFields(r),
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      summary: buildGeneralSummary(r.action, r.entity_type, r.entity_id, metadata),
      details: { ...metadata, entityType: r.entity_type, entityId: r.entity_id, action: r.action },
    } satisfies AuditRowDto;
  });
  return { source: query.source, rows: mapped, total, limit: query.limit, offset: query.offset };
}

async function fetchClientAssignmentsAudit(pool: PoolLike, query: AuditListQuery) {
  const { whereSql, params } = buildClientAssignmentsWhere(query);
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM client_assignment_history cah WHERE ${whereSql}`,
    params,
  );
  const total = countRes.rows[0]?.n ?? 0;
  const listParams = [...params, query.limit, query.offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const rows = await pool.query<{
    id: string;
    client_code: string;
    from_user_id: string | null;
    to_user_id: string;
    actor_user_id: string | null;
    reason: string | null;
    created_at: string;
    from_full_name: string | null;
    from_email: string | null;
    to_full_name: string | null;
    to_email: string | null;
    actor_full_name: string | null;
    actor_email: string | null;
    actor_role: string | null;
  }>(
    `SELECT cah.id, cah.client_code, cah.from_user_id, cah.to_user_id, cah.actor_user_id, cah.reason, cah.created_at,
            fu.full_name AS from_full_name, fu.email AS from_email,
            tu.full_name AS to_full_name, tu.email AS to_email,
            au.full_name AS actor_full_name, au.email AS actor_email, au.role AS actor_role
       FROM client_assignment_history cah
       LEFT JOIN users fu ON fu.id = cah.from_user_id
       LEFT JOIN users tu ON tu.id = cah.to_user_id
       LEFT JOIN users au ON au.id = cah.actor_user_id
      WHERE ${whereSql}
      ORDER BY cah.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  );
  const mapped = rows.rows.map((r) => {
    const fromName = userDisplayName(r.from_full_name, r.from_email);
    const toName = userDisplayName(r.to_full_name, r.to_email);
    const details = {
      clientCode: r.client_code,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      fromFullName: r.from_full_name,
      fromEmail: r.from_email,
      toFullName: r.to_full_name,
      toEmail: r.to_email,
      reason: r.reason,
    };
    return {
      id: r.id,
      occurredAt: r.created_at,
      ...mapActorFields(r),
      action: "client_assignment",
      entityType: "client",
      entityId: r.client_code,
      summary: `Клиент ${r.client_code}: ${fromName} → ${toName}`,
      details,
    } satisfies AuditRowDto;
  });
  return { source: query.source, rows: mapped, total, limit: query.limit, offset: query.offset };
}

async function fetchDealerResponsibilityAudit(pool: PoolLike, query: AuditListQuery) {
  const { whereSql, params } = buildDealerResponsibilityWhere(query);
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM dealer_responsibility_history drh WHERE ${whereSql}`,
    params,
  );
  const total = countRes.rows[0]?.n ?? 0;
  const listParams = [...params, query.limit, query.offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const rows = await pool.query<{
    id: string;
    dealer_id: string;
    responsible_role: string;
    from_user_id: string | null;
    to_user_id: string | null;
    actor_user_id: string;
    reason: string | null;
    created_at: string;
    from_full_name: string | null;
    from_email: string | null;
    to_full_name: string | null;
    to_email: string | null;
    actor_full_name: string | null;
    actor_email: string | null;
    actor_role: string | null;
  }>(
    `SELECT drh.id, drh.dealer_id, drh.responsible_role, drh.from_user_id, drh.to_user_id, drh.actor_user_id, drh.reason, drh.created_at,
            fu.full_name AS from_full_name, fu.email AS from_email,
            tu.full_name AS to_full_name, tu.email AS to_email,
            au.full_name AS actor_full_name, au.email AS actor_email, au.role AS actor_role
       FROM dealer_responsibility_history drh
       LEFT JOIN users fu ON fu.id = drh.from_user_id
       LEFT JOIN users tu ON tu.id = drh.to_user_id
       LEFT JOIN users au ON au.id = drh.actor_user_id
      WHERE ${whereSql}
      ORDER BY drh.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  );
  const mapped = rows.rows.map((r) => {
    const fromName = userDisplayName(r.from_full_name, r.from_email);
    const toName = userDisplayName(r.to_full_name, r.to_email);
    const details = {
      dealerId: r.dealer_id,
      responsibleRole: r.responsible_role,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      fromFullName: r.from_full_name,
      fromEmail: r.from_email,
      toFullName: r.to_full_name,
      toEmail: r.to_email,
      reason: r.reason,
    };
    return {
      id: r.id,
      occurredAt: r.created_at,
      ...mapActorFields(r),
      action: "dealer_responsibility_change",
      entityType: "dealer",
      entityId: r.dealer_id,
      summary: `Дилер ${r.dealer_id} [${r.responsible_role}]: ${fromName} → ${toName}`,
      details,
    } satisfies AuditRowDto;
  });
  return { source: query.source, rows: mapped, total, limit: query.limit, offset: query.offset };
}

async function fetchScopeDiagnosticsAudit(pool: PoolLike, query: AuditListQuery) {
  const { whereSql, params } = buildScopeDiagnosticsWhere(query);
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM real_scope_audit_log rsal WHERE ${whereSql}`,
    params,
  );
  const total = countRes.rows[0]?.n ?? 0;
  const listParams = [...params, query.limit, query.offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const rows = await pool.query<{
    id: string;
    occurred_at: string;
    user_id: string | null;
    call_site: string;
    profile_role: string;
    persona_user_id: string;
    real_user_id: string | null;
    reason: string;
    event_count: number;
    actor_full_name: string | null;
    actor_email: string | null;
    actor_role: string | null;
  }>(
    `SELECT rsal.id, rsal.occurred_at, rsal.user_id, rsal.call_site, rsal.profile_role, rsal.persona_user_id,
            rsal.real_user_id, rsal.reason, rsal.event_count,
            u.full_name AS actor_full_name, u.email AS actor_email, u.role AS actor_role
       FROM real_scope_audit_log rsal
       LEFT JOIN users u ON u.id = rsal.user_id
      WHERE ${whereSql}
      ORDER BY rsal.occurred_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  );
  const mapped = rows.rows.map((r) => {
    const details = {
      callSite: r.call_site,
      profileRole: r.profile_role,
      personaUserId: r.persona_user_id,
      realUserId: r.real_user_id,
      reason: r.reason,
      eventCount: r.event_count,
    };
    return {
      id: r.id,
      occurredAt: r.occurred_at,
      actorUserId: r.user_id,
      actorFullName: r.actor_full_name,
      actorEmail: r.actor_email,
      actorRole: r.actor_role,
      action: "scope_mismatch",
      entityType: "scope",
      entityId: r.call_site,
      summary: `${r.call_site}: разошлись mock vs real (${r.event_count})`,
      details,
    } satisfies AuditRowDto;
  });
  return { source: query.source, rows: mapped, total, limit: query.limit, offset: query.offset };
}

async function fetchOverridesApiAudit(pool: PoolLike, query: AuditListQuery) {
  const { whereSql, params } = buildOverridesApiWhere(query);
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM overrides_api_access_log oal WHERE ${whereSql}`,
    params,
  );
  const total = countRes.rows[0]?.n ?? 0;
  const listParams = [...params, query.limit, query.offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const rows = await pool.query<{
    id: string;
    route: string;
    method: string;
    actor_user_id: string | null;
    body_summary: unknown;
    response_status: number | null;
    response_code: string | null;
    duration_ms: number | null;
    created_at: string;
    actor_full_name: string | null;
    actor_email: string | null;
    actor_role: string | null;
  }>(
    `SELECT oal.id, oal.route, oal.method, oal.actor_user_id, oal.body_summary, oal.response_status, oal.response_code,
            oal.duration_ms, oal.created_at,
            u.full_name AS actor_full_name, u.email AS actor_email, u.role AS actor_role
       FROM overrides_api_access_log oal
       LEFT JOIN users u ON u.id = oal.actor_user_id
      WHERE ${whereSql}
      ORDER BY oal.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  );
  const mapped = rows.rows.map((r) => {
    const details = {
      route: r.route,
      method: r.method,
      bodySummary: asRecord(r.body_summary),
      responseStatus: r.response_status,
      responseCode: r.response_code,
      durationMs: r.duration_ms,
    };
    const status = r.response_status != null ? String(r.response_status) : "—";
    const duration = r.duration_ms != null ? String(r.duration_ms) : "—";
    return {
      id: r.id,
      occurredAt: r.created_at,
      ...mapActorFields(r),
      action: r.method,
      entityType: "api",
      entityId: r.route,
      summary: `${r.method} ${r.route} → ${status} (${duration}ms)`,
      details,
    } satisfies AuditRowDto;
  });
  return { source: query.source, rows: mapped, total, limit: query.limit, offset: query.offset };
}

export async function handleAdminAuditList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active" || !canAccessAdminAudit(me.role)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }

  const parsed = parseAuditListQuery((req.query ?? {}) as Record<string, unknown>);
  if ("error" in parsed) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: parsed.error });
    return;
  }

  try {
    const result = await fetchAuditList(pool, parsed);
    sendJson(res, 200, { success: true, ...result });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin/audit] list", m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}

export async function handleAdminAuditSources(
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.status !== "active" || !canAccessAdminAudit(me.role)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return;
  }
  sendJson(res, 200, { success: true, sources: AUDIT_SOURCES });
}

export type { DbUserRow };
