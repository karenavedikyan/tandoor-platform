// MIGRATION-ONLY ENDPOINT
// Этот файл — временный, для одноразового бэкапа Neon БД перед миграцией на Yandex.
// Будет удалён в промте 81 после успешной миграции.
// НЕ использовать в обычном production-флоу.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../../shared/admin/admin-auth.js";
import { dumpNeonToBlob } from "../../../server/db-migrate/dump-neon.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "method-not-allowed" });
      return;
    }

    const secretCheck = migrationSecretOk(req);
    if (secretCheck === "disabled") {
      sendJson(res, 503, { error: "endpoint disabled" });
      return;
    }
    if (!secretCheck) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 500, { error: "env-not-configured", missing: ["DATABASE_URL"] });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me || me.role !== "admin" || me.status !== "active") {
      sendJson(res, 403, { error: "unauthorized" });
      return;
    }

    const sourceUrl =
      process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim() || "";
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
    const missing: string[] = [];
    if (!sourceUrl) missing.push("DATABASE_URL_UNPOOLED|DATABASE_URL");
    if (!blobToken) missing.push("BLOB_READ_WRITE_TOKEN");
    if (missing.length > 0) {
      sendJson(res, 500, { error: "env-not-configured", missing });
      return;
    }

    const result = await dumpNeonToBlob({ sourceUrl, blobToken });
    sendJson(res, 200, result as unknown as Record<string, unknown>);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[db-migrate/dump]", message);
    sendJson(res, 500, { error: "dump-failed", message });
  }
}
