/**
 * GET /api/config/feature-flags — серверные feature flags для клиента.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendJson } from "../../shared/admin/admin-auth.js";
import { globalCacheKey, serveCachedJson } from "../../shared/api-cache-middleware.js";
import { getFeatureFlags } from "../../server/api/feature-flags-api.js";

const TTL_MS = 300_000;
const MAX_AGE_SEC = 300;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
    return;
  }

  await serveCachedJson(req, res, 200, {
    cacheKey: globalCacheKey("feature-flags"),
    ttlMs: TTL_MS,
    maxAgeSec: MAX_AGE_SEC,
    buildBody: async () => getFeatureFlags(),
  });
}
