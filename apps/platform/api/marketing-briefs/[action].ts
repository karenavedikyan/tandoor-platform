/**
 * Marketing briefs API (Промт 102):
 *   GET  /api/marketing-briefs/list?status=&period=
 *   GET  /api/marketing-briefs/get?id=
 *   POST /api/marketing-briefs/create
 *   POST /api/marketing-briefs/update
 *   POST /api/marketing-briefs/publish
 *   POST /api/marketing-briefs/unpublish
 *   POST /api/marketing-briefs/archive
 *   POST /api/marketing-briefs/restore
 *   POST /api/marketing-briefs/delete
 *   GET  /api/marketing-briefs/public-get?id=  (public+published — без входа; иначе сессия)
 *
 * Публичная ссылка на бриф: /p/brief/:id (OG + SPA).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  handleBlocksCreate,
  handleBlocksDelete,
  handleBlocksList,
  handleBlocksReorder,
  handleBlocksUpdate,
  handleMarketingBriefsArchive,
  handleMarketingBriefsCreate,
  handleMarketingBriefsDelete,
  handleMarketingBriefsFeed,
  handleMarketingBriefsGet,
  handleMarketingBriefsMarkViewed,
  handleMarketingBriefsList,
  handleMarketingBriefsPublicGet,
  handleMarketingBriefsPublish,
  handleMarketingBriefsRestore,
  handleMarketingBriefsUnpublish,
  handleMarketingBriefsUpdate,
} from "../../shared/marketing-briefs-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const actionRaw = req.query.action;
    const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

    if (action === "public-get" && req.method === "GET") {
      const pool = getPool();
      if (!pool) {
        sendJson(res, 503, {
          success: false,
          code: "DB_UNAVAILABLE",
          message: "База данных недоступна.",
        });
        return;
      }
      await handleMarketingBriefsPublicGet(req, res, pool);
      return;
    }

    if (req.method !== "GET" && !enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
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

    if (action === "list" && req.method === "GET") {
      await handleMarketingBriefsList(req, res, pool, sessionUser);
      return;
    }
    if (action === "get" && req.method === "GET") {
      await handleMarketingBriefsGet(req, res, pool, sessionUser);
      return;
    }
    if (action === "feed" && req.method === "GET") {
      await handleMarketingBriefsFeed(req, res, pool, sessionUser);
      return;
    }
    if (action === "mark-viewed" && req.method === "POST") {
      await handleMarketingBriefsMarkViewed(req, res, pool, sessionUser);
      return;
    }
    if (action === "create" && req.method === "POST") {
      await handleMarketingBriefsCreate(req, res, pool, sessionUser);
      return;
    }
    if (action === "update" && req.method === "POST") {
      await handleMarketingBriefsUpdate(req, res, pool, sessionUser);
      return;
    }
    if (action === "publish" && req.method === "POST") {
      await handleMarketingBriefsPublish(req, res, pool, sessionUser);
      return;
    }
    if (action === "unpublish" && req.method === "POST") {
      await handleMarketingBriefsUnpublish(req, res, pool, sessionUser);
      return;
    }
    if (action === "archive" && req.method === "POST") {
      await handleMarketingBriefsArchive(req, res, pool, sessionUser);
      return;
    }
    if (action === "restore" && req.method === "POST") {
      await handleMarketingBriefsRestore(req, res, pool, sessionUser);
      return;
    }
    if (action === "delete" && req.method === "POST") {
      await handleMarketingBriefsDelete(req, res, pool, sessionUser);
      return;
    }
    if (action === "blocks-list" && req.method === "GET") {
      await handleBlocksList(req, res, pool, sessionUser);
      return;
    }
    if (action === "blocks-create" && req.method === "POST") {
      await handleBlocksCreate(req, res, pool, sessionUser);
      return;
    }
    if (action === "blocks-update" && req.method === "POST") {
      await handleBlocksUpdate(req, res, pool, sessionUser);
      return;
    }
    if (action === "blocks-reorder" && req.method === "POST") {
      await handleBlocksReorder(req, res, pool, sessionUser);
      return;
    }
    if (action === "blocks-delete" && req.method === "POST") {
      await handleBlocksDelete(req, res, pool, sessionUser);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут marketing-briefs." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[marketing-briefs-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
