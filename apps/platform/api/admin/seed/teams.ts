/**
 * POST /api/admin/seed/teams — отдельная Vercel-функция (тяжёлый импорт sales-control-data).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SALES_TEAMS, SALES_USERS, getSalesUserById } from "../../../client/src/lib/sales-control-data";
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
