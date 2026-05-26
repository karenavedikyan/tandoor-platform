/**
 * POST /api/admin/seed/clients-assignments — отдельная Vercel-функция (тяжёлые импорты release-client-seed*).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SALES_TEAMS, getSalesUserById } from "../../../client/src/lib/sales-control-data";
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
