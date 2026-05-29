/**
 * OG-метаданные и минимальная выборка брифа для serverless (без авторизации).
 */

import { neon } from "@neondatabase/serverless";
import type { PoolLike } from "./admin/admin-auth.js";
import { DEFAULT_ACCENT_COLOR, mapMarketingBriefRow } from "./marketing-briefs-types.js";
import type { MarketingBriefVisibility } from "./marketing-briefs-types.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MarketingBriefOgMeta = {
  id: string;
  title: string;
  period_label: string;
  author_name: string | null;
  visibility: MarketingBriefVisibility;
  status: string;
  accent_color: string;
};

export function parseBriefOgId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

function resolveDatabaseUrl(): string | null {
  const a = process.env.DATABASE_URL?.trim();
  if (a) return a;
  const b = process.env.POSTGRES_URL?.trim();
  if (b) return b;
  const c = process.env.NEON_DATABASE_URL?.trim();
  if (c) return c;
  return null;
}

function mapRowToOgMeta(row: ReturnType<typeof mapMarketingBriefRow>): MarketingBriefOgMeta {
  return {
    id: row.id,
    title: row.title,
    period_label: row.period_label,
    author_name: row.author_name,
    visibility: row.visibility ?? "private",
    status: row.status,
    accent_color: row.accent_color?.trim() || DEFAULT_ACCENT_COLOR,
  };
}

export async function fetchBriefForOg(pool: PoolLike, id: string): Promise<MarketingBriefOgMeta | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT b.*, u.full_name AS author_name
     FROM marketing_briefs b
     LEFT JOIN users u ON u.id = b.created_by
     WHERE b.id = $1::uuid
     LIMIT 1`,
    [id],
  );
  if (!r.rows[0]) return null;
  return mapRowToOgMeta(mapMarketingBriefRow(r.rows[0]));
}

/** Edge-safe выборка (без admin-auth / node pool). */
export async function fetchBriefForOgEdge(id: string): Promise<MarketingBriefOgMeta | null> {
  const url = resolveDatabaseUrl();
  if (!url) return null;
  const sql = neon(url);
  const rows = (await sql`
    SELECT b.*, u.full_name AS author_name
    FROM marketing_briefs b
    LEFT JOIN users u ON u.id = b.created_by
    WHERE b.id = ${id}::uuid
    LIMIT 1
  `) as Record<string, unknown>[];
  if (!rows[0]) return null;
  return mapRowToOgMeta(mapMarketingBriefRow(rows[0]));
}

export function formatMarketingBriefPeriodLabel(periodLabel: string): string {
  const [y, mo] = periodLabel.split("-");
  const names = [
    "",
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];
  const m = parseInt(mo ?? "", 10);
  return `${names[m] ?? mo} ${y}`;
}

export function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

export function buildOgTitle(brief: MarketingBriefOgMeta): string {
  const t = brief.title.trim();
  return t ? `${t} — Бриф TANDOOR` : "Бриф TANDOOR";
}

export function briefShowsPublicOgContent(brief: MarketingBriefOgMeta): boolean {
  return brief.visibility === "public" && brief.status === "published";
}

/** @deprecated use briefShowsPublicOgContent */
export function briefShowsTitleOnOgImage(brief: MarketingBriefOgMeta): boolean {
  return briefShowsPublicOgContent(brief);
}

export function buildOgDescription(brief: MarketingBriefOgMeta): string {
  if (briefShowsPublicOgContent(brief)) {
    const period = formatMarketingBriefPeriodLabel(brief.period_label).trim();
    const raw = period ? `Маркетинговый бриф · ${period}` : "Маркетинговый бриф";
    return raw.slice(0, 200);
  }
  return "Внутренний маркетинговый бриф TANDOOR · требуется вход в личный кабинет";
}

export function buildOgImageAlt(brief: MarketingBriefOgMeta): string {
  if (briefShowsPublicOgContent(brief)) {
    const t = brief.title.trim() || "Бриф";
    return `TANDOOR — ${t}`;
  }
  return "TANDOOR — Внутренний бриф";
}

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function titleFontSize(charCount: number): number {
  if (charCount <= 24) return 88;
  if (charCount <= 48) return 72;
  return 56;
}

function maxCharsPerLine(fontSize: number): number {
  if (fontSize >= 88) return 22;
  if (fontSize >= 72) return 28;
  return 36;
}

function wrapTitleLines(text: string, fontSize: number, maxLines = 2): string[] {
  const t = text.trim() || "Бриф TANDOOR";
  const maxChars = maxCharsPerLine(fontSize);
  const lines: string[] = [];
  let rest = t;

  while (rest && lines.length < maxLines) {
    if (rest.length <= maxChars) {
      lines.push(rest);
      rest = "";
      break;
    }
    let breakAt = rest.lastIndexOf(" ", maxChars);
    if (breakAt <= 0) breakAt = maxChars;
    lines.push(rest.slice(0, breakAt).trim());
    rest = rest.slice(breakAt).trim();
  }

  if (rest && lines.length > 0) {
    const lastIdx = lines.length - 1;
    const last = lines[lastIdx] ?? "";
    lines[lastIdx] = `${last.length > maxChars - 1 ? last.slice(0, maxChars - 1) : last}…`;
  }

  return lines.length ? lines : [t.slice(0, maxChars)];
}

const OG_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const OG_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export function buildPremiumBriefOgSvg(opts: {
  host: string;
  isPublic: boolean;
  title: string;
  periodLabel: string;
}): string {
  const isPublic = opts.isPublic;
  const displayTitle = isPublic ? opts.title.trim() || "Без названия" : "Внутренний бриф";
  const fontSize = titleFontSize(displayTitle.length);
  const titleLines = wrapTitleLines(displayTitle, fontSize, 2);
  const lineHeight = Math.round(fontSize * 1.05);
  const titleBlockHeight = titleLines.length * lineHeight;
  const titleStartY = Math.round(315 - titleBlockHeight / 2);

  const periodText = isPublic
    ? formatMarketingBriefPeriodLabel(opts.periodLabel).trim()
    : "Требуется доступ";

  const titleLinesSvg = titleLines
    .map(
      (line, i) =>
        `<text x="64" y="${titleStartY + i * lineHeight}" fill="#FFFFFF" font-family="${OG_FONT}" font-size="${fontSize}" font-weight="800">${escapeXml(line)}</text>`,
    )
    .join("\n  ");

  const periodY = titleStartY + titleBlockHeight + 32;

  const lockBadge = isPublic
    ? ""
    : `
  <g transform="translate(900, 56)">
    <rect x="0" y="0" width="236" height="44" rx="22" fill="#374151" opacity="0.8"/>
    <rect x="14" y="14" width="14" height="12" rx="2" fill="none" stroke="#9CA3AF" stroke-width="1.5"/>
    <path d="M 17 14 L 17 11.5 C 17 9.5 18.6 8 21 8 C 23.4 8 25 9.5 25 11.5 L 25 14" fill="none" stroke="#9CA3AF" stroke-width="1.5"/>
    <text x="44" y="28" fill="#9CA3AF" font-family="${OG_FONT}" font-size="18" font-weight="500">Доступ по входу</text>
  </g>`;

  const periodSvg =
    periodText && isPublic
      ? `<text x="64" y="${periodY}" fill="#9ACA3C" font-family="${OG_FONT}" font-size="28" font-weight="600">${escapeXml(periodText)}</text>`
      : !isPublic
        ? `<text x="64" y="${periodY}" fill="#9ACA3C" font-family="${OG_FONT}" font-size="24" font-weight="600" opacity="0.85">${escapeXml(periodText)}</text>`
        : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="og-bg-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1A1F26"/>
      <stop offset="100%" stop-color="#0B0E12"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0F1419"/>
  <rect width="1200" height="630" fill="url(#og-bg-grad)"/>
  <path d="M 520 630 L 1200 120 L 1200 630 Z" fill="#9ACA3C" opacity="0.07"/>
  <line x1="64" y1="64" x2="149" y2="149" stroke="#9ACA3C" stroke-width="4" stroke-linecap="round"/>
  <text x="64" y="108" fill="#9ACA3C" font-family="${OG_FONT}" font-size="52" font-weight="700" letter-spacing="2.08">TANDOOR</text>
  <line x1="64" y1="124" x2="144" y2="124" stroke="#9ACA3C" stroke-width="1" opacity="0.4"/>
  ${titleLinesSvg}
  ${periodSvg}
  <line x1="64" y1="468" x2="264" y2="468" stroke="#9ACA3C" stroke-width="1" opacity="0.5"/>
  <text x="64" y="518" fill="#E5E7EB" font-family="${OG_FONT}" font-size="36" font-weight="500" font-style="italic" letter-spacing="0.72">Сравнивая, выбирают нас</text>
  <text x="64" y="582" fill="#9CA3AF" font-family="${OG_FONT}" font-size="22" font-weight="600" letter-spacing="1.76">МАРКЕТИНГОВЫЙ БРИФ</text>
  <text x="1136" y="582" fill="#6B7280" font-family="${OG_MONO}" font-size="20" text-anchor="end">${escapeXml(opts.host)}</text>
  ${lockBadge}
</svg>`;
}
