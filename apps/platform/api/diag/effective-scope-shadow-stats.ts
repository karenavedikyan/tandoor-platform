/**
 * Промт 435b: синхронный отчёт shadow vs legacy для admin/director.
 * GET /api/diag/effective-scope-shadow-stats?userId=…&role=…
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { UserRole } from "../../shared/auth.js";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import { resolveScopeCodesMeta } from "../../shared/db-scope-formula.js";
import {
  diffScopeSets,
  legacyReleaseCodesToExternalKeys,
  loadShadowExternalKeysForUser,
} from "../../shared/effective-scope-shadow.js";

const ALLOWED_ROLES: ReadonlySet<UserRole> = new Set([
  "admin",
  "director",
  "rop",
  "regional_manager",
  "manager",
  "marketer",
  "analyst",
  "category_manager",
]);

function parseRole(raw: string | undefined): UserRole | null {
  const r = raw?.trim();
  if (!r || !ALLOWED_ROLES.has(r as UserRole)) return null;
  return r as UserRole;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED" });
      return;
    }
    if (me.role !== "admin" && me.role !== "director") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN" });
      return;
    }

    const userIdParam = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    const targetUserId = userIdParam || me.id;

    let targetRole = parseRole(typeof req.query.role === "string" ? req.query.role : undefined);
    if (!targetRole) {
      const userQ = await pool.query<{ role: UserRole }>(
        `SELECT role FROM users WHERE id = $1::uuid LIMIT 1`,
        [targetUserId],
      );
      targetRole = userQ.rows[0]?.role ?? null;
    }
    if (!targetRole) {
      sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
      return;
    }

    const meta = await resolveScopeCodesMeta(pool, targetUserId, targetRole);
    const shadowKeys = await loadShadowExternalKeysForUser(pool, targetUserId);
    const legacyKeys = legacyReleaseCodesToExternalKeys(meta.allCodes);
    const diff = diffScopeSets(legacyKeys, shadowKeys, 50);

    sendJson(res, 200, {
      success: true,
      userId: targetUserId,
      role: targetRole,
      legacy: { all_codes: meta.allCodes.length, full_catalog: meta.fullCatalog },
      shadow: { external_keys: shadowKeys.size },
      diff,
      equal: diff.missing_in_shadow.length === 0 && diff.extra_in_shadow.length === 0,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[diag/effective-scope-shadow-stats]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
