/**
 * PDF download handler — lazy-loads marketing-brief-pdf so import failures surface as JSON.
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
import type { BriefPdfInput } from "./marketing-brief-pdf.js";

type SessionUser = { id: string; role: string; status: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function sendPdfStageError(
  res: VercelResponse,
  status: number,
  stage: string,
  err: unknown,
  extra: Record<string, unknown> = {},
): void {
  if (res.headersSent) return;
  const e = err as { name?: string; message?: string; stack?: string; code?: string };
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(
    JSON.stringify({
      error: "pdf_failed",
      stage,
      message: e?.message ?? String(err ?? "no error object"),
      name: e?.name ?? null,
      code: e?.code ?? null,
      stack: e?.stack ?? null,
      env: safeEnvSnapshot(),
      extra,
    }),
  );
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

export async function handleDownloadPdf(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  let id: string;
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = parseUuid(body.id);
    if (!parsed) throw new Error("missing or invalid brief id");
    id = parsed;
  } catch (e) {
    sendPdfStageError(res, 400, "parse_id", e);
    return;
  }

  let brief: MarketingBriefRow;
  let blocks: MarketingBriefBlockRow[];
  try {
    const loaded = await fetchBriefById(pool, id);
    if (!loaded || !canReadBrief(me, loaded)) {
      throw new Error(`brief ${id} not found or access denied`);
    }
    brief = loaded;
    blocks = await fetchBlocksForBrief(pool, id);
  } catch (e) {
    sendPdfStageError(res, 404, "load_brief", e, { briefId: id });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const theme = body.theme === "dark" ? "dark" : "light";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const proto =
    String(req.headers["x-forwarded-proto"] || "https").split(",")[0]?.trim() || "https";
  const origin = host ? `${proto}://${host}` : undefined;

  let renderBriefPdf: (input: BriefPdfInput) => Promise<Buffer>;
  try {
    const mod = await import("./marketing-brief-pdf.js");
    renderBriefPdf = mod.renderBriefPdf;
    if (typeof renderBriefPdf !== "function") {
      throw new Error(`renderBriefPdf is not a function (keys: ${Object.keys(mod).join(",")})`);
    }
  } catch (e) {
    sendPdfStageError(res, 500, "import_renderer", e, { briefId: id });
    return;
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderBriefPdf({ brief, blocks, theme, origin });
    if (!pdfBuffer?.length) {
      throw new Error("renderBriefPdf returned empty buffer");
    }
  } catch (e) {
    sendPdfStageError(res, 500, "render", e, {
      briefId: id,
      theme,
      blocksCount: blocks.length,
      blocksTypes: blocks.map((b) => b.type),
    });
    return;
  }

  try {
    const filename = buildBriefPdfFilename(brief);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", buildBriefPdfContentDisposition(filename));
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pdfBuffer);
  } catch (e) {
    sendPdfStageError(res, 500, "send", e, { briefId: id });
  }
}

/** @deprecated use handleDownloadPdf */
export const handleMarketingBriefsDownloadPdf = handleDownloadPdf;
