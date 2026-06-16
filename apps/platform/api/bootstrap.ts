/**
 * GET /api/bootstrap — единый ответ для первого рендера authenticated shell (Промт 380).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, vercelHeaders, sendJson } from "../shared/admin/admin-auth.js";
import { serveCachedJson, userScopedCacheKey } from "../shared/api-cache-middleware.js";
import { buildBootstrapPayload } from "../shared/bootstrap-handler.js";
import { resolveSessionUserRow } from "../shared/auth-me-read.js";

const TTL_MS = 30_000;
const MAX_AGE_SEC = 30;
const SWR_SEC = 120;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
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
    const row = await resolveSessionUserRow(pool, headers);
    if (!row) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    const cacheKey = userScopedCacheKey("bootstrap", row.id, row.role);

    await serveCachedJson(req, res, 200, {
      cacheKey,
      ttlMs: TTL_MS,
      maxAgeSec: MAX_AGE_SEC,
      staleWhileRevalidateSec: SWR_SEC,
      buildBody: async () => {
        const built = await buildBootstrapPayload(pool, headers);
        if (built.status !== 200) {
          throw new Error("bootstrap_build_failed");
        }
        return built.body;
      },
      shouldCache: (body, status) => status === 200 && body != null && typeof body === "object",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/bootstrap]", m.slice(0, 200));
    if (!res.headersSent) {
      sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
    }
  }
}

// re-export for tests
export { bootstrapCacheKey } from "../shared/bootstrap-handler.js";
