/**
 * Имя файла PDF брифа (RFC 5987 для кириллицы).
 */

import type { MarketingBriefRow } from "./marketing-briefs-types.js";
import { formatMarketingBriefPeriodLabel } from "./marketing-brief-og.js";

function sanitizeFilenamePart(raw: string): string {
  return raw
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function buildBriefPdfFilename(brief: MarketingBriefRow): string {
  const period = brief.period_label ? sanitizeFilenamePart(formatMarketingBriefPeriodLabel(brief.period_label)) : "";
  const theme = brief.title.trim() ? sanitizeFilenamePart(brief.title.trim()) : "";

  const parts = ["TANDOOR"];
  if (period) parts.push(period);
  if (theme) parts.push(theme);

  const name = parts.join("_");
  return name.length > 4 ? `${name}.pdf` : "TANDOOR.pdf";
}

export function buildBriefPdfContentDisposition(filename: string): string {
  const asciiFallback =
    filename.replace(/[^\x20-\x7E]/g, "_").replace(/_+/g, "_") || "TANDOOR.pdf";
  const encoded = encodeURIComponent(filename)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
