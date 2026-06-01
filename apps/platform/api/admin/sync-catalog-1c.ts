/**
 * POST /api/admin/sync-catalog-1c — запуск импорта catalog1.xml на Yandex VM runner.
 * Body: { target?: "both"|"neon"|"yandex", dry?: boolean }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";

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

    const runnerUrl = process.env.SYNC_1C_RUNNER_URL?.trim()?.replace(/\/$/, "");
    if (!runnerUrl) {
      sendJson(res, 503, {
        success: false,
        code: "RUNNER_NOT_CONFIGURED",
        message: "SYNC_1C_RUNNER_URL не настроен (Yandex VM runner).",
      });
      return;
    }

    const body = (req.body ?? {}) as { target?: string; dry?: boolean };
    const target = body.target === "neon" || body.target === "yandex" ? body.target : "both";
    const dry = body.dry === true;

    const token = process.env.SYNC_RUNNER_TOKEN?.trim() ?? "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    // Пробрасываем Neon URL на раннер одноразово в body, чтобы VM видел его только в момент импорта
    // и только при запуске из Vercel (cron на VM без этого будет импортировать только в Yandex — бэкап-ветвь).
    const extraEnv: Record<string, string> = {};
    if (target === "both" || target === "neon") {
      const neonUrl = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.POSTGRES_URL_NON_POOLING?.trim();
      if (neonUrl) extraEnv.DATABASE_URL_UNPOOLED = neonUrl;
    }

    const r = await fetch(`${runnerUrl}/run/catalog`, {
      method: "POST",
      headers,
      body: JSON.stringify({ target, dry, extraEnv: Object.keys(extraEnv).length ? extraEnv : undefined }),
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      sendJson(res, r.status >= 400 && r.status < 600 ? r.status : 502, {
        success: false,
        code: String(json.code ?? "RUNNER_ERROR"),
        message: String(json.message ?? `Runner HTTP ${r.status}`),
        runner: json,
      });
      return;
    }

    sendJson(res, 202, {
      success: true,
      message: dry ? "Dry-run запущен на VM" : "Импорт каталога запущен на VM",
      runner: json,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[sync-catalog-1c]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
