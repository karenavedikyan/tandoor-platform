/**
 * POST /api/marketing-briefs/download-pdf
 *
 * Отдельная serverless-функция. Статический import цепочки handler → renderer для Vercel nft.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import { handleDownloadPdf } from "../../server/marketing-briefs-pdf-handler.js";

export const config = {
  maxDuration: 30,
};

function safeEnvSnapshot(): Record<string, unknown> {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    vercel_region: process.env.VERCEL_REGION ?? null,
    vercel_env: process.env.VERCEL_ENV ?? null,
  };
}

function sendDebugError(
  res: VercelResponse,
  status: number,
  stage: string,
  err: unknown,
  extra: Record<string, unknown> = {},
): void {
  if (res.headersSent) return;
  const e = err as { name?: string; message?: string; stack?: string; code?: string };
  const payload = {
    error: "pdf_failed",
    stage,
    message: e?.message ?? String(err ?? "no error object"),
    name: e?.name ?? null,
    code: e?.code ?? null,
    stack: e?.stack ?? null,
    env: safeEnvSnapshot(),
    extra,
  };
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(payload));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendDebugError(res, 405, "method_check", new Error(`Method ${req.method} not allowed`));
      return;
    }

    if (!enforceCsrfOrigin(req)) {
      sendDebugError(res, 403, "csrf_check", new Error("CSRF rejected"));
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendDebugError(res, 503, "db_pool", new Error("Database pool unavailable"));
      return;
    }

    const headers = vercelHeaders(req);
    const me = await resolveCurrentUser(pool, headers);
    if (!me) {
      sendDebugError(res, 401, "auth", new Error("Authentication required"));
      return;
    }

    const sessionUser = { id: me.id, role: me.role, status: me.status };

    try {
      await handleDownloadPdf(req, res, pool, sessionUser);
    } catch (runErr) {
      if (!res.headersSent) {
        sendDebugError(res, 500, "handler_execution", runErr);
      } else {
        console.error("[download-pdf] handler threw after sending headers", runErr);
      }
    }
  } catch (outer) {
    if (!res.headersSent) {
      sendDebugError(res, 500, "outer_wrapper", outer);
    } else {
      console.error("[download-pdf] outer wrapper after headersSent", outer);
    }
  }
}
