/**
 * GET /api/admin/purge-queue — корзина админа (Промт 386).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveCurrentUser, sendJson, type PoolLike } from "./admin/admin-auth.js";
import { roleHasPermission } from "./auth-rbac.js";
import type { UserRole } from "./auth.js";
import { computeAdminPurgeQueue } from "./db-scope-formula.js";

export async function handleAdminPurgeQueue(
  _req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<void> {
  const me = await resolveCurrentUser(pool, headers);
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return;
  }
  if (!roleHasPermission(me.role as UserRole, "admin.purge_dealer")) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только admin/director." });
    return;
  }
  const queue = await computeAdminPurgeQueue(pool);
  sendJson(res, 200, { success: true, ...queue } as unknown as Record<string, unknown>);
}
