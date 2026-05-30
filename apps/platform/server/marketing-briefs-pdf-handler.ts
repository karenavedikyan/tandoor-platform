/**
 * PDF download handler — isolated from shared/handlers so Vercel bundles
 * marketing-brief-pdf via static import (dynamic import from shared is not traced).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../shared/admin/admin-auth.js";
import { canManageMarketingBriefsServer } from "../shared/marketing-briefs-access.js";
import {
  buildBriefPdfContentDisposition,
  buildBriefPdfFilename,
} from "../shared/marketing-brief-pdf-filename.js";
import {
  mapMarketingBriefBlockRow,
  mapMarketingBriefRow,
  type MarketingBriefBlockRow,
  type MarketingBriefRow,
} from "../shared/marketing-briefs-types.js";
import { renderBriefPdf } from "./marketing-brief-pdf.js";

type SessionUser = { id: string; role: string; status: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function parseUuid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

async function fetchBriefById(pool: PoolLike, id: string): Promise<MarketingBriefRow | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT b.*, u.full_name AS author_name
     FROM marketing_briefs b
     LEFT JOIN users u ON u.id = b.created_by
     WHERE b.id = $1::uuid
     LIMIT 1`,
    [id],
  );
  return r.rows[0] ? mapMarketingBriefRow(r.rows[0]) : null;
}

async function fetchBlocksForBrief(pool: PoolLike, briefId: string): Promise<MarketingBriefBlockRow[]> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM marketing_brief_blocks WHERE brief_id = $1::uuid ORDER BY order_index ASC`,
    [briefId],
  );
  return r.rows.map((row) => mapMarketingBriefBlockRow(row));
}

function canReadBrief(me: SessionUser, brief: MarketingBriefRow): boolean {
  if (brief.status === "published") return true;
  return canManageMarketingBriefsServer(me.role);
}

export async function handleMarketingBriefsDownloadPdf(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const id = parseUuid(body.id);
  if (!id) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите id." });
    return;
  }

  const brief = await fetchBriefById(pool, id);
  if (!brief || !canReadBrief(me, brief)) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Бриф не найден." });
    return;
  }

  const blocks = await fetchBlocksForBrief(pool, id);
  const theme = body.theme === "dark" ? "dark" : "light";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const proto =
    String(req.headers["x-forwarded-proto"] || "https").split(",")[0]?.trim() || "https";
  const origin = host ? `${proto}://${host}` : undefined;

  try {
    const buffer = await renderBriefPdf({ brief, blocks, theme, origin });
    const filename = buildBriefPdfFilename(brief);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", buildBriefPdfContentDisposition(filename));
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buffer);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error && e.stack ? e.stack : "";
    const name = e instanceof Error ? e.name : "Unknown";

    console.error("[marketing-briefs] download-pdf failed", {
      briefId: id,
      theme,
      message,
      stack,
      blocksCount: blocks.length,
      blocksTypes: blocks.map((b) => b.type),
    });

    sendJson(res, 500, {
      success: false,
      code: "PDF_ERROR",
      message: "Не удалось сформировать PDF.",
      ...(process.env.VERCEL_ENV !== "production"
        ? {
            debug: {
              name,
              message,
              stack: stack.split("\n").slice(0, 15).join("\n"),
              briefId: id,
              theme,
              blocksCount: blocks.length,
              blocksTypes: blocks.map((b) => b.type),
            },
          }
        : {}),
    });
  }
}
