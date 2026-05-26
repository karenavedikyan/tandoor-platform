/**
 * POST /api/admin/seed/teams           — seed teams + memberships из SALES_TEAMS/SALES_USERS
 * POST /api/admin/seed/clients-assignments — seed client_assignments из RELEASE_CLIENT_ROWS*
 *
 * Объединено в одну serverless-функцию через dynamic route [kind] из-за лимита Hobby (12 функций).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SALES_TEAMS, SALES_USERS, getSalesUserById } from "../../../client/src/lib/sales-control-data";
import { RELEASE_CLIENT_ROWS } from "../../../client/src/lib/release-client-seed.generated";
import { RELEASE_CLIENT_ROWS_KOTENEVA } from "../../../client/src/lib/release-client-seed-koteneva.generated";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../_shared/admin-auth";

export const config = { maxDuration: 60 };

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function mergedClientRows(): Array<{ code: string; teamId: string; managerName: string }> {
  const kotCodes = new Set(RELEASE_CLIENT_ROWS_KOTENEVA.map((r) => r.code).filter(Boolean));
  const base = RELEASE_CLIENT_ROWS.filter((r) => !r.code || !kotCodes.has(r.code));
  return [...base, ...RELEASE_CLIENT_ROWS_KOTENEVA].map((r) => ({
    code: r.code,
    teamId: r.teamId,
    managerName: r.managerName,
  }));
}

async function handleSeedTeams(
  req: VercelRequest,
  res: VercelResponse,
  pool: ReturnType<typeof getPool>,
  me: { id: string; role: string; status: string },
): Promise<void> {
  if (!pool) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  const unresolvedFullNames: string[] = [];
  let teamsInserted = 0;
  let membershipsInserted = 0;

  const nameToUserId = new Map<string, string>();
  const allUsers = await pool.query<{ id: string; full_name: string; role: string }>(
    `SELECT id, full_name, role FROM users WHERE status = 'active'`,
  );
  for (const u of allUsers.rows) {
    nameToUserId.set(normName(String(u.full_name)), String(u.id));
  }

  for (const st of SALES_TEAMS) {
    const lead = getSalesUserById(st.leadId);
    if (!lead) {
      unresolvedFullNames.push(`lead:${st.leadId}`);
      continue;
    }
    const ropId = nameToUserId.get(normName(lead.name));
    if (!ropId) {
      unresolvedFullNames.push(lead.name);
      continue;
    }
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO teams (name, rop_user_id) VALUES ($1, $2::uuid)
       ON CONFLICT (name) DO NOTHING
       RETURNING id`,
      [st.name, ropId],
    );
    if (ins.rows.length > 0) teamsInserted += 1;
  }

  const mockTeamToUuid = new Map<string, string>();
  for (const st of SALES_TEAMS) {
    const r = await pool.query<{ id: string }>(`SELECT id FROM teams WHERE name = $1 LIMIT 1`, [st.name]);
    if (r.rows[0]) mockTeamToUuid.set(st.id, String(r.rows[0].id));
  }

  const membershipRoles = new Set(["team_lead", "sales_manager", "regional_manager"]);
  for (const su of SALES_USERS) {
    if (!membershipRoles.has(su.role)) continue;
    if (!su.teamId) continue;
    const dbTeamId = mockTeamToUuid.get(su.teamId);
    if (!dbTeamId) continue;
    const uid = nameToUserId.get(normName(su.name));
    if (!uid) {
      unresolvedFullNames.push(su.name);
      continue;
    }
    const ur = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id = $1::uuid`, [uid]);
    const platformRole = String(ur.rows[0]?.role ?? "manager");
    const ins = await pool.query<{ user_id: string }>(
      `INSERT INTO user_team_memberships (user_id, team_id, role_in_team)
       VALUES ($1::uuid, $2::uuid, $3)
       ON CONFLICT (user_id, team_id) DO NOTHING
       RETURNING user_id`,
      [uid, dbTeamId, platformRole],
    );
    if (ins.rows.length > 0) membershipsInserted += 1;
  }

  sendJson(res, 200, {
    success: true,
    teamsInserted,
    membershipsInserted,
    unresolvedFullNames,
  });
}

async function handleSeedClientsAssignments(
  req: VercelRequest,
  res: VercelResponse,
  pool: ReturnType<typeof getPool>,
  me: { id: string; role: string; status: string },
): Promise<void> {
  if (!pool) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  const nameToUserId = new Map<string, string>();
  const allUsers = await pool.query<{ id: string; full_name: string }>(`SELECT id, full_name FROM users WHERE status = 'active'`);
  for (const u of allUsers.rows) {
    nameToUserId.set(normName(String(u.full_name)), String(u.id));
  }

  const mockTeamToDbTeamId = new Map<string, string>();
  for (const st of SALES_TEAMS) {
    const lead = getSalesUserById(st.leadId);
    if (!lead) continue;
    const ropUid = nameToUserId.get(normName(lead.name));
    if (!ropUid) continue;
    const tr = await pool.query<{ id: string }>(
      `SELECT id FROM teams WHERE rop_user_id = $1::uuid AND name = $2 LIMIT 1`,
      [ropUid, st.name],
    );
    if (tr.rows[0]) mockTeamToDbTeamId.set(st.id, String(tr.rows[0].id));
  }

  const rows = mergedClientRows();
  const unresolvedClientCodes: string[] = [];
  let clientsSeeded = 0;
  let clientsSkipped = 0;

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const row of slice) {
      const mgrId = nameToUserId.get(normName(row.managerName));
      if (!mgrId) {
        unresolvedClientCodes.push(row.code);
        clientsSkipped += 1;
        continue;
      }
      const tid = mockTeamToDbTeamId.get(row.teamId);
      if (!tid) {
        unresolvedClientCodes.push(row.code);
        clientsSkipped += 1;
        continue;
      }
      values.push(`($${p++}, $${p++}::uuid, $${p++}::uuid)`);
      params.push(row.code, mgrId, tid);
    }
    if (values.length === 0) continue;
    const sql = `INSERT INTO client_assignments (client_code, responsible_user_id, team_id) VALUES ${values.join(", ")}
      ON CONFLICT (client_code) DO NOTHING
      RETURNING client_code, responsible_user_id, team_id`;
    const ins = await pool.query<{ client_code: string; responsible_user_id: string; team_id: string | null }>(sql, params);
    clientsSeeded += ins.rows.length;
    for (const r of ins.rows) {
      await pool.query(
        `INSERT INTO client_assignment_history (client_code, from_user_id, to_user_id, to_team_id, actor_user_id, reason)
         VALUES ($1, NULL, $2::uuid, $3::uuid, $4::uuid, $5)`,
        [r.client_code, r.responsible_user_id, r.team_id, me.id, "initial-seed"],
      );
    }
  }

  sendJson(res, 200, {
    success: true,
    clientsSeeded,
    clientsSkipped,
    unresolvedClientCodes,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
    return;
  }
  if (!enforceCsrfOrigin(req)) {
    sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
    return;
  }
  const pool = getPool();
  if (!pool) {
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    return;
  }
  const headers = vercelHeaders(req);
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (me.role !== "admin" || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только администратор." });
    return;
  }

  const kindRaw = req.query.kind;
  const kind = Array.isArray(kindRaw) ? String(kindRaw[0] ?? "") : String(kindRaw ?? "");

  if (kind === "teams") {
    await handleSeedTeams(req, res, pool, me);
    return;
  }
  if (kind === "clients-assignments") {
    await handleSeedClientsAssignments(req, res, pool, me);
    return;
  }
  sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный seed-маршрут." });
}
