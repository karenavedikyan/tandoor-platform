/**
 * POST /api/admin/sync-catalog-1c-photos
 * Body: { target?: "both"|"neon"|"yandex", dry?: boolean, limit?: number }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import { buildNeonExtraEnv, callRunner, type CatalogRunnerTarget } from "../../shared/sync-catalog-runner.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
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
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (me.role !== "admin") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для администратора." });
      return;
    }

    const body = (req.body ?? {}) as { target?: string; dry?: boolean; limit?: number };
    const target: CatalogRunnerTarget =
      body.target === "neon" || body.target === "yandex" ? body.target : "both";
    const dry = body.dry === true;
    const limitNum = Number(body.limit);
    const limit =
      Number.isFinite(limitNum) && limitNum > 0 ? Math.min(Math.floor(limitNum), 2000) : 500;

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!blobToken && !dry) {
      sendJson(res, 503, {
        success: false,
        code: "BLOB_NOT_CONFIGURED",
        message: "BLOB_READ_WRITE_TOKEN не настроен.",
      });
      return;
    }

    const extraEnv = buildNeonExtraEnv(target);
    if (blobToken) extraEnv.BLOB_READ_WRITE_TOKEN = blobToken;

    const proxyUrl = process.env.PG_PROXY_URL?.trim() || process.env.YANDEX_PROXY_URL?.trim();
    const proxyToken = process.env.PG_PROXY_TOKEN?.trim() || process.env.YANDEX_PROXY_TOKEN?.trim();
    if (proxyUrl) extraEnv.PG_PROXY_URL = proxyUrl;
    if (proxyToken) extraEnv.PG_PROXY_TOKEN = proxyToken;

    const ftpUser = process.env.FTP_USER?.trim();
    const ftpPassword = process.env.FTP_PASSWORD?.trim();
    if (ftpUser) extraEnv.FTP_USER = ftpUser;
    if (ftpPassword) extraEnv.FTP_PASSWORD = ftpPassword;

    const r = await callRunner("/run/photos", {
      target,
      dry,
      limit,
      extraEnv: Object.keys(extraEnv).length ? extraEnv : undefined,
    });

    if (!r.ok) {
      sendJson(res, r.status >= 400 && r.status < 600 ? r.status : 502, {
        success: false,
        code: String(r.json.code ?? "RUNNER_ERROR"),
        message: String(r.json.message ?? `Runner HTTP ${r.status}`),
        runner: r.json,
      });
      return;
    }

    sendJson(res, 202, {
      success: true,
      message: dry ? "Dry-run загрузки фото запущен на VM" : `Загрузка до ${limit} фото запущена на VM`,
      limit,
      target,
      runner: r.json,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[sync-catalog-1c-photos]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
