/**
 * OG-метаданные и минимальная выборка брифа для serverless (без авторизации).
 */

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
  const row = mapMarketingBriefRow(r.rows[0]);
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

export function buildOgDescription(brief: MarketingBriefOgMeta): string {
  if (brief.visibility === "public" && brief.status === "published") {
    const period = formatMarketingBriefPeriodLabel(brief.period_label);
    const author = brief.author_name?.trim() ?? "";
    const raw = `Маркетинговый бриф, ${period}.${author ? ` ${author}` : ""}`;
    return raw.slice(0, 200);
  }
  return "Внутренний маркетинговый бриф. Для просмотра требуется вход в ЛК.";
}

export function briefShowsTitleOnOgImage(brief: MarketingBriefOgMeta): boolean {
  return brief.visibility === "public" && brief.status === "published";
}
