/**
 * GET /api/cron/sync-catalog-1c — Vercel cron хук.
 * Раз в час дёргает Yandex VM runner с пробросом DATABASE_URL_UNPOOLED (Neon),
 * чтобы импорт каталога шёл в обе БД одновременно (target=both).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.status(status).json(body);
}

function isCronAuthorized(req: VercelRequest): boolean {
  const cronH = req.headers["x-vercel-cron"];
  const cronV = Array.isArray(cronH) ? cronH[0] : cronH;
  if (typeof cronV === "string" && cronV.trim() === "1") return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers["authorization"];
    const av = Array.isArray(auth) ? auth[0] : auth;
    if (typeof av === "string" && av.trim() === `Bearer ${secret}`) return true;
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }
    if (!isCronAuthorized(req)) {
      sendJson(res, 401, { success: false, code: "UNAUTHORIZED" });
      return;
    }

    const runnerUrl = process.env.SYNC_1C_RUNNER_URL?.trim()?.replace(/\/$/, "");
    if (!runnerUrl) {
      sendJson(res, 503, { success: false, code: "RUNNER_NOT_CONFIGURED" });
      return;
    }

    const token = process.env.SYNC_RUNNER_TOKEN?.trim() ?? "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    // Пробрасываем Neon URL одноразово, чтобы импорт шёл в обе БД.
    const extraEnv: Record<string, string> = {};
    const neonUrl =
      process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.POSTGRES_URL_NON_POOLING?.trim();
    if (neonUrl) extraEnv.DATABASE_URL_UNPOOLED = neonUrl;

    const target = Object.keys(extraEnv).length ? "both" : "yandex";

    const r = await fetch(`${runnerUrl}/run/catalog`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        target,
        dry: false,
        extraEnv: Object.keys(extraEnv).length ? extraEnv : undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;

    if (!r.ok) {
      sendJson(res, r.status >= 400 && r.status < 600 ? r.status : 502, {
        success: false,
        code: String(json.code ?? "RUNNER_ERROR"),
        message: String(json.message ?? `Runner HTTP ${r.status}`),
        target,
      });
      return;
    }

    sendJson(res, 202, { success: true, target, runner: json });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[cron/sync-catalog-1c]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
