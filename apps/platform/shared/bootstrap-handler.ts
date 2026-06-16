/**
 * Сборка ответа GET /api/bootstrap (Промт 380).
 */

import type { PoolLike } from "./admin/admin-auth.js";
import { buildAuthMePayload } from "./auth-me-read.js";
import { buildBootstrapPayloadCore, type BootstrapResponse } from "./bootstrap-handler-core.js";
import { fetchMyClientCodes } from "./my-client-codes-handlers.js";
import { getFeatureFlags } from "../server/api/feature-flags-api.js";
import { createHash } from "node:crypto";

export type { BootstrapSection, BootstrapResponse } from "./bootstrap-handler-core.js";
export { bootstrapCacheKey } from "./bootstrap-handler-core.js";

async function loadActualizationState(userId: string, role: string): Promise<Record<string, unknown>> {
  const { loadActualizationStatePayload } = await import("../api/actualization/state.js");
  return loadActualizationStatePayload(userId, role);
}

export async function buildBootstrapPayload(
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<{ status: number; body: BootstrapResponse | { success: false; code: string; message?: string } }> {
  const authMe = await buildAuthMePayload(pool, headers);
  if (!authMe.success) {
    return { status: 401, body: { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." } };
  }

  const body = await buildBootstrapPayloadCore(pool, authMe.user, {
    fetchMyClientCodes: async (p, u) => fetchMyClientCodes(p, u) as unknown as Record<string, unknown>,
    getFeatureFlags: () => getFeatureFlags() as unknown as Record<string, unknown>,
    loadActualizationState,
  });

  return { status: 200, body };
}

export function hashQueryForCache(query: Record<string, unknown>): string {
  const json = JSON.stringify(query);
  return createHash("sha256").update(json).digest("hex").slice(0, 8);
}
