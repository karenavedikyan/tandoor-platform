/**
 * Типы маркетинговых брифов (Postgres, Промт 102).
 */

export type MarketingBriefStatus = "draft" | "published" | "archived";

export type MarketingBriefRow = {
  id: string;
  period_label: string;
  title: string;
  status: MarketingBriefStatus;
  accent_color: string;
  cover_text: string;
  created_by: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
};

export type MarketingBriefRevisionRow = {
  id: string;
  action: string;
  actor_user_id: string | null;
  actor_name: string | null;
  created_at: string;
};

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidPeriodLabel(raw: string): boolean {
  return PERIOD_RE.test(raw.trim());
}

export function mapMarketingBriefRow(r: Record<string, unknown>): MarketingBriefRow {
  return {
    id: String(r.id),
    period_label: String(r.period_label),
    title: String(r.title),
    status: String(r.status) as MarketingBriefStatus,
    accent_color: String(r.accent_color ?? "#9ACA3C"),
    cover_text: String(r.cover_text ?? ""),
    created_by: r.created_by != null ? String(r.created_by) : null,
    author_name: r.author_name != null ? String(r.author_name) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    published_at: r.published_at != null ? String(r.published_at) : null,
    archived_at: r.archived_at != null ? String(r.archived_at) : null,
  };
}

export function mapMarketingBriefRevisionRow(r: Record<string, unknown>): MarketingBriefRevisionRow {
  return {
    id: String(r.id),
    action: String(r.action),
    actor_user_id: r.actor_user_id != null ? String(r.actor_user_id) : null,
    actor_name: r.actor_name != null ? String(r.actor_name) : null,
    created_at: String(r.created_at),
  };
}

export const DEFAULT_ACCENT_COLOR = "#9ACA3C";
