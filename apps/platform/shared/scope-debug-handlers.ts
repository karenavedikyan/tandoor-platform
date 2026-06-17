/**
 * GET /api/admin/scope-debug — разложение scope и счётчиков сайдбара (Промт 383).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  resolveCurrentUser,
  sendJson,
  type DbUserRow,
  type PoolLike,
} from "./admin/admin-auth.js";
import { buildScopeDebugPayload } from "./scope-debug-core.js";

export type { ScopeDebugPayload, ScopeDebugTeamRow } from "./scope-debug-core.js";
export { buildScopeDebugPayload } from "./scope-debug-core.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function queryStringParam(req: VercelRequest, key: string): string {
  const raw = req.query[key];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) return raw[0].trim();
  return "";
}

async function loadTargetUser(
  pool: PoolLike,
  userId: string | null,
  email: string | null,
): Promise<DbUserRow | null> {
  if (userId) {
    const r = await pool.query<DbUserRow>(
      `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at
       FROM users WHERE id = $1::uuid LIMIT 1`,
      [userId],
    );
    return r.rows[0] ?? null;
  }
  if (email) {
    const r = await pool.query<DbUserRow>(
      `SELECT id, email, full_name, phone, role, status, must_change_password, last_login_at, created_at
       FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    );
    return r.rows[0] ?? null;
  }
  return null;
}

export async function handleScopeDebugRequest(
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
  if (!["admin", "director"].includes(me.role) || me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Доступно director и admin." });
    return;
  }

  const userId = queryStringParam(req, "user_id") || queryStringParam(req, "userId");
  const email = queryStringParam(req, "email");
  if (!userId && !email) {
    sendJson(res, 400, {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Укажите user_id или email.",
    });
    return;
  }
  if (userId && !UUID_RE.test(userId)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Некорректный user_id." });
    return;
  }

  const target = await loadTargetUser(pool, userId || null, email || null);
  if (!target) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
    return;
  }

  const payload = await buildScopeDebugPayload(pool, target);
  sendJson(res, 200, payload as unknown as Record<string, unknown>);
}
