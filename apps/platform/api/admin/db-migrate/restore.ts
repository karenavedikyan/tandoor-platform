// MIGRATION-ONLY ENDPOINT
// Восстановление дампа Neon (JSONL.gz в Blob) в Yandex PostgreSQL.
// Будет удалён после успешной миграции.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../../shared/admin/admin-auth.js";
import {
  restoreYandexFromBlob,
  type RestoreMode,
} from "../../../server/db-migrate/restore-yandex.js";

export const config = {
  maxDuration: 300,
};

function migrationSecretOk(req: VercelRequest): boolean | "disabled" {
  const expected = process.env.MIGRATION_DUMP_SECRET?.trim();
  if (!expected) return "disabled";
  const got = req.headers["x-migration-secret"];
  const header = Array.isArray(got) ? got[0] : got;
  return typeof header === "string" && header === expected;
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function isValidBlobUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith("https://") && url.endsWith(".jsonl.gz");
}

function isValidMode(mode: unknown): mode is RestoreMode {
  return mode === "truncate-and-load" || mode === "append";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { ok: false, error: "method-not-allowed" });
      return;
    }

    const secretCheck = migrationSecretOk(req);
    if (secretCheck === "disabled") {
      sendJson(res, 503, { ok: false, error: "endpoint disabled" });
      return;
    }
    if (!secretCheck) {
      sendJson(res, 401, { ok: false, error: "unauthorized" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 500, { ok: false, error: "env-not-configured", missing: ["DATABASE_URL"] });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me || me.role !== "admin" || me.status !== "active") {
      sendJson(res, 403, { ok: false, error: "unauthorized" });
      return;
    }

    const body = parseBody(req);
    const blobUrl = body.blobUrl;
    const mode = body.mode ?? "truncate-and-load";

    if (!isValidBlobUrl(blobUrl)) {
      sendJson(res, 400, {
        ok: false,
        error: "invalid-blob-url",
        message: "blobUrl must be https://…/*.jsonl.gz",
      });
      return;
    }
    if (!isValidMode(mode)) {
      sendJson(res, 400, { ok: false, error: "invalid-mode" });
      return;
    }

    if (!process.env.PG_PROXY_URL || !process.env.PG_PROXY_TOKEN) {
      sendJson(res, 500, {
        ok: false,
        error: "env-not-configured",
        missing: [
          ...(process.env.PG_PROXY_URL ? [] : ["PG_PROXY_URL"]),
          ...(process.env.PG_PROXY_TOKEN ? [] : ["PG_PROXY_TOKEN"]),
        ],
      });
      return;
    }

    const result = await restoreYandexFromBlob({ blobUrl, mode });
    sendJson(res, 200, {
      ok: true,
      partial: result.errors.length > 0,
      result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[db-migrate/restore]", message);
    sendJson(res, 500, { ok: false, error: "restore-failed", message });
  }
}
