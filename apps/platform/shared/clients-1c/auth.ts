import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../server/db/neon-client.js";
import {
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
  type DbUserRow,
} from "../admin/admin-auth.js";

export async function requireClients1cAdmin(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<DbUserRow | null> {
  const me = await resolveCurrentUser(pool, vercelHeaders(req));
  if (!me) {
    sendJson(res, 401, { ok: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return null;
  }
  if (me.role !== "admin") {
    sendJson(res, 403, { ok: false, code: "FORBIDDEN", message: "Только для администратора." });
    return null;
  }
  return me;
}
