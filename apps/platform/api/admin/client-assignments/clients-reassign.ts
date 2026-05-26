import type { VercelRequest, VercelResponse } from "@vercel/node";
import { enforceCsrfOrigin, getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../_shared/admin-auth";
import { handleClientsReassign } from "../client-assignments-handlers";

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
  await handleClientsReassign(req, res, pool, me);
}
