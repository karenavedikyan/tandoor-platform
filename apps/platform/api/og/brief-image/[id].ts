/**
 * Премиальная OG-картинка 1200×630 (SVG) для /p/brief/:id
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../../../shared/admin/admin-auth.js";
import {
  briefShowsPublicOgContent,
  buildPremiumBriefOgSvg,
  fetchBriefForOg,
  parseBriefOgId,
} from "../../../shared/marketing-brief-og.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = parseBriefOgId(req.query.id);
  if (!id) {
    res.status(400).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("bad id");
    return;
  }

  const pool = getPool();
  if (!pool) {
    res.status(503).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("database unavailable");
    return;
  }

  const brief = await fetchBriefForOg(pool, id);
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "tandoor-platform.vercel.app");
  const isPublic = brief ? briefShowsPublicOgContent(brief) : false;

  const svg = buildPremiumBriefOgSvg({
    host,
    isPublic,
    title: brief?.title ?? "",
    periodLabel: brief?.period_label ?? "",
  });

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).end(svg);
}
