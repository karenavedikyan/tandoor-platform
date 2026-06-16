/**
 * Handlers: активность команды (Промт 378).
 * Читаем `users.activity_summary` + `client_assignments`, без агрегации event-таблиц в list API.
 */

import type { PoolLike } from "./admin/admin-auth.js";
import type {
  ActivitySummaryJson,
  RefreshActivitySummaryResult,
  TeamActivityEventRow,
  TeamActivityEventsResponse,
  TeamActivityListResponse,
  TeamActivityRange,
  TeamActivityRow,
  TeamActivityTeamOption,
} from "./team-activity-types.js";
import {
  getTeamActivityCached,
  setTeamActivityCached,
  teamActivityCacheKey,
} from "./team-activity-cache.js";

export type TeamActivitySessionUser = {
  id: string;
  role: string;
  status: string;
};

const LIST_ROLES = new Set(["director", "admin", "rop", "regional_manager"]);
const MANAGER_BLOCKED = new Set(["manager", "sales_manager"]);

export function canAccessTeamActivity(role: string): boolean {
  return LIST_ROLES.has(role);
}

export function isTeamActivityManagerForbidden(role: string): boolean {
  return MANAGER_BLOCKED.has(role) || role === "manager";
}

export function parseTeamActivityRange(raw: string | undefined): TeamActivityRange {
  return raw === "30d" ? "30d" : "7d";
}

function daysSinceActivity(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function parseActivitySummary(raw: unknown): ActivitySummaryJson {
  if (!raw || typeof raw !== "object") return {};
  return raw as ActivitySummaryJson;
}

function metricsFromSummary(summary: ActivitySummaryJson, range: TeamActivityRange) {
  const s = range === "30d" ? "30d" : "7d";
  const eventsOverrides = Number(summary[`events_overrides_${s}` as keyof ActivitySummaryJson] ?? 0);
  const eventsContacts = Number(summary[`events_contacts_${s}` as keyof ActivitySummaryJson] ?? 0);
  const eventsTp = Number(summary[`events_tp_${s}` as keyof ActivitySummaryJson] ?? 0);
  const eventsTotal = Number(summary[`events_${s}` as keyof ActivitySummaryJson] ?? eventsOverrides + eventsContacts + eventsTp);
  const clientsTouched = Number(summary[`clients_touched_${s}` as keyof ActivitySummaryJson] ?? 0);
  return { eventsTotal, eventsOverrides, eventsContacts, eventsTp, clientsTouched };
}

type DbUserRow = {
  user_id: string;
  full_name: string;
  role: string;
  last_login_at: string | null;
  activity_summary: unknown;
  activity_summary_updated_at: string | null;
  team_id: string | null;
  team_name: string | null;
  clients_count: number;
};

function mapDbRow(row: DbUserRow, range: TeamActivityRange): TeamActivityRow {
  const summary = parseActivitySummary(row.activity_summary);
  const m = metricsFromSummary(summary, range);
  const lastActivity = summary.last_activity_at ?? null;
  return {
    user_id: String(row.user_id),
    full_name: String(row.full_name),
    role: String(row.role),
    team_id: row.team_id ? String(row.team_id) : null,
    team_name: row.team_name ? String(row.team_name) : null,
    clients_count: Number(row.clients_count) || 0,
    events_total: m.eventsTotal,
    events_overrides: m.eventsOverrides,
    events_contacts: m.eventsContacts,
    events_tp: m.eventsTp,
    clients_touched: m.clientsTouched,
    last_activity_at: lastActivity,
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    days_since_activity: daysSinceActivity(lastActivity),
  };
}

const BASE_USER_SELECT = `
  SELECT
    u.id AS user_id,
    u.full_name,
    u.role,
    u.last_login_at,
    u.activity_summary,
    u.activity_summary_updated_at,
    tm.team_id,
    tm.team_name,
    COALESCE(cc.clients_count, 0)::int AS clients_count
  FROM users u
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS clients_count
    FROM client_assignments ca
    WHERE ca.responsible_user_id = u.id
  ) cc ON true
  LEFT JOIN LATERAL (
    SELECT t.id AS team_id, t.name AS team_name
    FROM client_assignments ca
    INNER JOIN teams t ON t.id = ca.team_id
    WHERE ca.responsible_user_id = u.id
    ORDER BY ca.updated_at DESC NULLS LAST
    LIMIT 1
  ) tm ON true
`;

async function fetchTeamsForDirector(pool: PoolLike): Promise<TeamActivityTeamOption[]> {
  const r = await pool.query<{ team_id: string; team_name: string }>(
    `SELECT id AS team_id, name AS team_name FROM teams ORDER BY name ASC`,
  );
  return r.rows.map((row) => ({ team_id: String(row.team_id), team_name: String(row.team_name) }));
}

async function queryTeamActivityRows(
  pool: PoolLike,
  me: TeamActivitySessionUser,
  range: TeamActivityRange,
  teamId: string | null,
): Promise<{ rows: TeamActivityRow[]; generated_at: string; teams: TeamActivityTeamOption[] }> {
  const role = me.role;
  let sql = `${BASE_USER_SELECT} WHERE u.status = 'active'`;
  const params: unknown[] = [];

  let teams: TeamActivityTeamOption[] = [];

  if (role === "regional_manager") {
    sql += ` AND u.id = $1::uuid`;
    params.push(me.id);
  } else if (role === "rop") {
    sql += `
      AND u.role = 'manager'
      AND u.id IN (
        SELECT DISTINCT ca.responsible_user_id
        FROM client_assignments ca
        INNER JOIN teams t ON t.id = ca.team_id
        WHERE t.rop_user_id = $1::uuid
      )`;
    params.push(me.id);
  } else if (role === "director" || role === "admin") {
    sql += ` AND u.role IN ('manager', 'regional_manager')`;
    teams = await fetchTeamsForDirector(pool);
    if (teamId) {
      params.push(teamId);
      sql += `
        AND u.id IN (
          SELECT DISTINCT ca.responsible_user_id
          FROM client_assignments ca
          WHERE ca.team_id = $${params.length}::uuid
        )`;
    }
  } else {
    return { rows: [], generated_at: new Date().toISOString(), teams: [] };
  }

  sql += ` ORDER BY u.full_name ASC`;

  const r = await pool.query<DbUserRow>(sql, params);
  const mapped = r.rows.map((row) => mapDbRow(row, range));
  mapped.sort((a, b) => b.events_total - a.events_total || a.full_name.localeCompare(b.full_name, "ru"));

  const generatedAt =
    r.rows
      .map((row) => row.activity_summary_updated_at)
      .filter(Boolean)
      .sort()
      .pop() ?? new Date().toISOString();

  return { rows: mapped, generated_at: String(generatedAt), teams };
}

export async function fetchTeamActivity(
  pool: PoolLike,
  me: TeamActivitySessionUser,
  opts: { range?: string; teamId?: string | null; useCache?: boolean },
): Promise<{ payload: TeamActivityListResponse; cacheHit: boolean }> {
  if (!canAccessTeamActivity(me.role)) {
    throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
  }
  if (me.status !== "active") {
    throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
  }

  const range = parseTeamActivityRange(opts.range);
  const teamId = opts.teamId?.trim() || null;
  const cacheKey = teamActivityCacheKey([
    "team-activity",
    me.role,
    me.id,
    range,
    teamId ?? "all",
  ]);

  if (opts.useCache !== false) {
    const cached = getTeamActivityCached<TeamActivityListResponse>(cacheKey);
    if (cached) return { payload: cached, cacheHit: true };
  }

  const { rows, generated_at, teams } = await queryTeamActivityRows(pool, me, range, teamId);
  const payload: TeamActivityListResponse = {
    success: true,
    range,
    teams: me.role === "director" || me.role === "admin" ? teams : [],
    rows,
    generated_at,
  };
  setTeamActivityCached(cacheKey, payload);
  return { payload, cacheHit: false };
}

export async function canViewTeamActivityUser(
  pool: PoolLike,
  viewer: TeamActivitySessionUser,
  targetUserId: string,
): Promise<boolean> {
  if (!canAccessTeamActivity(viewer.role)) return false;
  if (viewer.role === "regional_manager") return viewer.id === targetUserId;
  if (viewer.role === "rop") {
    const r = await pool.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM client_assignments ca
       INNER JOIN teams t ON t.id = ca.team_id
       WHERE t.rop_user_id = $1::uuid AND ca.responsible_user_id = $2::uuid
       LIMIT 1`,
      [viewer.id, targetUserId],
    );
    return r.rows.length > 0;
  }
  if (viewer.role === "director" || viewer.role === "admin") return true;
  return false;
}

function rangeIntervalDays(range: TeamActivityRange): number {
  return range === "30d" ? 29 : 6;
}

export async function fetchTeamActivityEvents(
  pool: PoolLike,
  viewer: TeamActivitySessionUser,
  targetUserId: string,
  opts: { range?: string; limit?: number },
): Promise<TeamActivityEventsResponse> {
  if (!canAccessTeamActivity(viewer.role)) {
    throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
  }
  const allowed = await canViewTeamActivityUser(pool, viewer, targetUserId);
  if (!allowed) throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });

  const range = parseTeamActivityRange(opts.range);
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
  const days = rangeIntervalDays(range);

  const r = await pool.query<TeamActivityEventRow & { at: Date | string }>(
    `SELECT at, type, dealer_id, client_id, field, body_preview FROM (
       SELECT changed_at AS at, 'override'::text AS type, dealer_id, NULL::text AS client_id,
              field, NULL::text AS body_preview
       FROM dealer_override_events
       WHERE changed_by = $1::uuid
         AND changed_at >= (now() AT TIME ZONE 'Europe/Moscow')::date - $3::int * INTERVAL '1 day'
       UNION ALL
       SELECT at, 'contact'::text, NULL::text, client_id, NULL::text,
              LEFT(body, 100)
       FROM client_contact_events
       WHERE actor_user_id = $1::uuid
         AND at >= (now() AT TIME ZONE 'Europe/Moscow')::date - $3::int * INTERVAL '1 day'
       UNION ALL
       SELECT updated_at AS at, 'tp'::text, dealer_id, NULL::text, NULL::text, NULL::text
       FROM trade_point_overrides
       WHERE updated_by = $1::uuid
         AND updated_at >= (now() AT TIME ZONE 'Europe/Moscow')::date - $3::int * INTERVAL '1 day'
     ) ev
     ORDER BY at DESC
     LIMIT $2`,
    [targetUserId, limit, days],
  );

  return {
    success: true,
    user_id: targetUserId,
    range,
    events: r.rows.map((row) => ({
      at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
      type: row.type as TeamActivityEventRow["type"],
      dealer_id: row.dealer_id ? String(row.dealer_id) : null,
      client_id: row.client_id ? String(row.client_id) : null,
      field: row.field ? String(row.field) : null,
      body_preview: row.body_preview ? String(row.body_preview) : null,
    })),
  };
}

const REFRESH_DAILY_SQL = `
TRUNCATE public.manager_activity_daily;
INSERT INTO public.manager_activity_daily (user_id, day, events_overrides, events_contacts, events_tp, clients_touched, updated_at)
WITH ov AS (
  SELECT changed_by AS user_id, (changed_at AT TIME ZONE 'Europe/Moscow')::date AS day,
         COUNT(*)::int AS events_overrides, COUNT(DISTINCT dealer_id)::int AS clients_touched
  FROM public.dealer_override_events WHERE changed_by IS NOT NULL GROUP BY 1,2
),
cc AS (
  SELECT actor_user_id AS user_id, (at AT TIME ZONE 'Europe/Moscow')::date AS day,
         COUNT(*)::int AS events_contacts, COUNT(DISTINCT client_id)::int AS clients_touched
  FROM public.client_contact_events WHERE actor_user_id IS NOT NULL GROUP BY 1,2
),
tp AS (
  SELECT updated_by AS user_id, (updated_at AT TIME ZONE 'Europe/Moscow')::date AS day,
         COUNT(*)::int AS events_tp, COUNT(DISTINCT dealer_id)::int AS clients_touched
  FROM public.trade_point_overrides WHERE updated_by IS NOT NULL GROUP BY 1,2
),
u AS (
  SELECT user_id, day FROM ov
  UNION SELECT user_id, day FROM cc
  UNION SELECT user_id, day FROM tp
)
SELECT u.user_id, u.day,
       COALESCE(ov.events_overrides, 0),
       COALESCE(cc.events_contacts, 0),
       COALESCE(tp.events_tp, 0),
       GREATEST(COALESCE(ov.clients_touched,0), COALESCE(cc.clients_touched,0), COALESCE(tp.clients_touched,0)),
       now()
FROM u
LEFT JOIN ov USING (user_id, day)
LEFT JOIN cc USING (user_id, day)
LEFT JOIN tp USING (user_id, day);
`;

const REFRESH_SUMMARY_SQL = `
WITH last_act AS (
  SELECT user_id, MAX(t) AS last_activity_at FROM (
    SELECT changed_by AS user_id, MAX(changed_at) AS t FROM public.dealer_override_events WHERE changed_by IS NOT NULL GROUP BY 1
    UNION ALL SELECT actor_user_id, MAX(at) FROM public.client_contact_events WHERE actor_user_id IS NOT NULL GROUP BY 1
    UNION ALL SELECT updated_by, MAX(updated_at) FROM public.trade_point_overrides WHERE updated_by IS NOT NULL GROUP BY 1
    UNION ALL SELECT updated_by, MAX(updated_at) FROM public.dealer_overrides WHERE updated_by IS NOT NULL GROUP BY 1
  ) x GROUP BY user_id
),
agg7 AS (
  SELECT user_id, SUM(events_overrides)::int AS ev_ov, SUM(events_contacts)::int AS ev_cc,
         SUM(events_tp)::int AS ev_tp, MAX(clients_touched)::int AS clients_touched
  FROM public.manager_activity_daily
  WHERE day >= (now() AT TIME ZONE 'Europe/Moscow')::date - INTERVAL '6 days' GROUP BY user_id
),
agg30 AS (
  SELECT user_id, SUM(events_overrides)::int AS ev_ov, SUM(events_contacts)::int AS ev_cc,
         SUM(events_tp)::int AS ev_tp, MAX(clients_touched)::int AS clients_touched
  FROM public.manager_activity_daily
  WHERE day >= (now() AT TIME ZONE 'Europe/Moscow')::date - INTERVAL '29 days' GROUP BY user_id
)
UPDATE public.users u
SET activity_summary = jsonb_build_object(
      'events_7d', COALESCE(a7.ev_ov,0) + COALESCE(a7.ev_cc,0) + COALESCE(a7.ev_tp,0),
      'events_overrides_7d', COALESCE(a7.ev_ov,0),
      'events_contacts_7d', COALESCE(a7.ev_cc,0),
      'events_tp_7d', COALESCE(a7.ev_tp,0),
      'clients_touched_7d', COALESCE(a7.clients_touched,0),
      'events_30d', COALESCE(a30.ev_ov,0) + COALESCE(a30.ev_cc,0) + COALESCE(a30.ev_tp,0),
      'events_overrides_30d', COALESCE(a30.ev_ov,0),
      'events_contacts_30d', COALESCE(a30.ev_cc,0),
      'events_tp_30d', COALESCE(a30.ev_tp,0),
      'clients_touched_30d', COALESCE(a30.clients_touched,0),
      'last_activity_at', la.last_activity_at
    ),
    activity_summary_updated_at = now()
FROM (SELECT id FROM public.users) ids
LEFT JOIN agg7 a7 ON a7.user_id = ids.id
LEFT JOIN agg30 a30 ON a30.user_id = ids.id
LEFT JOIN last_act la ON la.user_id = ids.id
WHERE u.id = ids.id;
`;

export async function refreshActivitySummary(pool: PoolLike): Promise<RefreshActivitySummaryResult> {
  const started = Date.now();
  await pool.query(REFRESH_DAILY_SQL);
  const countDaily = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM public.manager_activity_daily`);
  const updateRes = await pool.query(REFRESH_SUMMARY_SQL);
  const usersUpdated = updateRes.rowCount ?? 0;
  const duration_ms = Date.now() - started;
  const rows_in_daily = Number(countDaily.rows[0]?.c ?? 0);

  console.log("[cron/refresh-activity-summary]", { rows_in_daily, users_updated: usersUpdated, duration_ms });

  return { success: true, rows_in_daily, users_updated: usersUpdated, duration_ms };
}

/** Экспорт SQL для smoke-тестов (не Seq Scan на list API). */
export const TEAM_ACTIVITY_LIST_SQL_MARKERS = {
  usesActivitySummary: "u.activity_summary",
  usesClientAssignmentsCount: "client_assignments",
  avoidsOverrideEvents: "dealer_override_events",
} as const;
