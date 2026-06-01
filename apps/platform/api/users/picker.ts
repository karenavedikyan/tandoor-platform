/**
 * GET /api/users/picker?role=rop|regional_manager
 * Список пользователей для dropdown (любой авторизованный active).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";

const PICKER_ROLES = new Set(["rop", "regional_manager"]);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me || me.status !== "active") {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    const roleRaw = req.query.role;
    const role = Array.isArray(roleRaw) ? String(roleRaw[0] ?? "") : String(roleRaw ?? "");
    if (!PICKER_ROLES.has(role)) {
      sendJson(res, 400, {
        success: false,
        code: "INVALID_ROLE",
        message: "Укажите role=rop или role=regional_manager.",
      });
      return;
    }

    const r = await pool.query<{ id: string; full_name: string; role: string; status: string }>(
      `SELECT id, full_name, role, status FROM users
       WHERE role = $1 AND status = 'active'
       ORDER BY full_name ASC`,
      [role],
    );

    sendJson(res, 200, {
      success: true,
      users: r.rows.map((row) => ({
        id: String(row.id),
        full_name: String(row.full_name),
        role: String(row.role),
        status: String(row.status),
      })),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[users/picker]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
