import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../_shared/admin-auth";
import { handleClientAssignmentHistory } from "../client-assignments-handlers";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
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
  await handleClientAssignmentHistory(req, res, pool, me);
}
