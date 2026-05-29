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

export type MarketingBriefBlockType =
  | "section"
  | "text"
  | "segments"
  | "callout"
  | "products"
  | "price_table"
  | "bonus";

export type BriefProductSegment = "top150" | "top350" | "top500" | "top500plus";

export interface ProductsBlockItem {
  id: string;
  catalog_id?: string | null;
  manual: boolean;
  name?: string;
  article?: string;
  image_url?: string;
  price_showroom?: number | null;
  price_retail?: number | null;
  note?: string;
  segments?: BriefProductSegment[];
}

export interface ProductsBlockPayload {
  heading?: string;
  items: ProductsBlockItem[];
}

export interface PriceTableRow {
  id: string;
  model: string;
  price_old?: number | null;
  price_new?: number | null;
  note?: string;
}

export interface PriceTableBlockPayload {
  heading?: string;
  rows: PriceTableRow[];
  show_benefit: boolean;
}

export interface BonusBlockItem {
  id: string;
  trigger: string;
  reward: string;
  audience?: string;
  conditions?: string;
  valid_until?: string;
  require_photo_report?: boolean;
}

export interface BonusBlockPayload {
  heading?: string;
  items: BonusBlockItem[];
}

export interface SectionBlockPayload {
  number?: string;
  title: string;
  subtitle?: string;
}

export interface TextBlockPayload {
  heading?: string;
  body: string;
}

export interface SegmentsBlockPayload {
  heading?: string;
  segments: {
    top150: string;
    top350: string;
    top500: string;
    top500plus: string;
  };
}

export interface CalloutBlockPayload {
  tone: "info" | "warning" | "success";
  heading?: string;
  body: string;
}

export type MarketingBriefBlockPayload =
  | SectionBlockPayload
  | TextBlockPayload
  | SegmentsBlockPayload
  | CalloutBlockPayload
  | ProductsBlockPayload
  | PriceTableBlockPayload
  | BonusBlockPayload;

export type MarketingBriefBlockRow = {
  id: string;
  brief_id: string;
  order_index: number;
  type: MarketingBriefBlockType;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const BLOCK_TYPES: MarketingBriefBlockType[] = [
  "section",
  "text",
  "segments",
  "callout",
  "products",
  "price_table",
  "bonus",
];

export function isMarketingBriefBlockType(raw: unknown): raw is MarketingBriefBlockType {
  return typeof raw === "string" && (BLOCK_TYPES as string[]).includes(raw);
}

export function mapMarketingBriefBlockRow(r: Record<string, unknown>): MarketingBriefBlockRow {
  return {
    id: String(r.id),
    brief_id: String(r.brief_id),
    order_index: Number(r.order_index),
    type: String(r.type) as MarketingBriefBlockType,
    payload:
      r.payload && typeof r.payload === "object" && !Array.isArray(r.payload)
        ? (r.payload as Record<string, unknown>)
        : {},
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export function defaultBlockPayload(type: MarketingBriefBlockType): Record<string, unknown> {
  switch (type) {
    case "section":
      return { title: "Новый раздел" };
    case "text":
      return { body: "" };
    case "segments":
      return { segments: { top150: "", top350: "", top500: "", top500plus: "" } };
    case "callout":
      return { tone: "info", body: "" };
    case "products":
      return { items: [] };
    case "price_table":
      return { rows: [], show_benefit: true };
    case "bonus":
      return { items: [] };
    default:
      return {};
  }
}
