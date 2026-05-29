/**
 * OG-картинка 1200×630 (SVG) для /p/brief/:id — без edge/@vercel/og для стабильного деплоя.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../../../shared/admin/admin-auth.js";
import {
  briefShowsTitleOnOgImage,
  fetchBriefForOg,
  formatMarketingBriefPeriodLabel,
  parseBriefOgId,
} from "../../../shared/marketing-brief-og.js";

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapTitle(text: string, maxLen = 48): string {
  const t = text.trim() || "Бриф TANDOOR";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function buildBriefOgSvg(opts: {
  accent: string;
  title: string;
  period: string;
  subtitle: string;
  host: string;
  showTitle: boolean;
}): string {
  const titleSize = opts.showTitle ? 64 : 52;
  const titleY = opts.showTitle ? 280 : 300;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${escapeXml(opts.accent)}"/>
  <text x="64" y="100" fill="#ffffff" font-family="system-ui, sans-serif" font-size="32" letter-spacing="6" opacity="0.9">БРИФ TANDOOR</text>
  <text x="64" y="${titleY}" fill="#222631" font-family="system-ui, sans-serif" font-size="${titleSize}" font-weight="700">${escapeXml(wrapTitle(opts.title, 42))}</text>
  <text x="64" y="${titleY + 56}" fill="#222631" font-family="system-ui, sans-serif" font-size="36" opacity="0.9">${escapeXml(opts.period)}</text>
  ${
    opts.subtitle
      ? `<text x="64" y="${titleY + 100}" fill="#ffffff" font-family="system-ui, sans-serif" font-size="28" opacity="0.95">${escapeXml(opts.subtitle)}</text>`
      : ""
  }
  <text x="64" y="566" fill="#ffffff" font-family="system-ui, sans-serif" font-size="26" opacity="0.85">${escapeXml(opts.host)}</text>
</svg>`;
}

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
  const showTitle = brief ? briefShowsTitleOnOgImage(brief) : false;
  const accent = brief?.accent_color ?? "#9ACA3C";
  const title = showTitle && brief ? brief.title : "Бриф TANDOOR";
  const period =
    showTitle && brief ? formatMarketingBriefPeriodLabel(brief.period_label) : "Внутренний маркетинговый бриф";
  const subtitle = showTitle ? "" : "Для просмотра требуется вход в ЛК";

  const svg = buildBriefOgSvg({ accent, title, period, subtitle, host, showTitle });

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).end(svg);
}
