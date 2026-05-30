/**
 * POST /api/marketing-briefs/download-pdf
 *
 * Отдельная serverless-функция: не смешивать с [action].ts, иначе @react-pdf/renderer
 * инициализируется при каждом list/get и ломает весь роутер.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import { handleMarketingBriefsDownloadPdf } from "../../server/marketing-briefs-pdf-handler.js";

export const config = {
  maxDuration: 30,
  includeFiles: [
    "../../server/fonts/**",
    "../../server/marketing-brief-pdf.*",
    "../../server/marketing-briefs-pdf-handler.js",
  ],
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
      return;
    }

    if (!enforceCsrfOrigin(req)) {
      sendJson(res, 403, {
        success: false,
        code: "CSRF_REJECTED",
        message: "Недопустимый источник запроса.",
      });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, {
        success: false,
        code: "DB_UNAVAILABLE",
        message: "База данных недоступна.",
      });
      return;
    }

    const headers = vercelHeaders(req);
    const me = await resolveCurrentUser(pool, headers);
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    const sessionUser = { id: me.id, role: me.role, status: me.status };
    await handleMarketingBriefsDownloadPdf(req, res, pool, sessionUser);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[marketing-briefs/download-pdf] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
