/**
 * HTTP API маркетинговых брифов (Postgres, Промт 102).
 */

export type MarketingBriefStatus = "draft" | "published" | "archived";

export type MarketingBriefVisibility = "private" | "public";

export type MarketingBriefRow = {
  id: string;
  period_label: string;
  title: string;
  status: MarketingBriefStatus;
  visibility: MarketingBriefVisibility;
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

export type MarketingBriefBlockType =
  | "section"
  | "text"
  | "segments"
  | "callout"
  | "products"
  | "price_table"
  | "bonus";

export type BriefProductSegment = "top150" | "top350" | "top500" | "top500plus";

export type ProductsBlockItem = {
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
};

export type ProductsBlockPayload = {
  heading?: string;
  items: ProductsBlockItem[];
};

export type PriceTableRow = {
  id: string;
  model: string;
  price_old?: number | null;
  price_new?: number | null;
  note?: string;
};

export type PriceTableBlockPayload = {
  heading?: string;
  rows: PriceTableRow[];
  show_benefit: boolean;
};

export type BonusBlockItem = {
  id: string;
  trigger: string;
  reward: string;
  audience?: string;
  conditions?: string;
  valid_until?: string;
  require_photo_report?: boolean;
};

export type BonusBlockPayload = {
  heading?: string;
  items: BonusBlockItem[];
};

export type MarketingBriefBlockRow = {
  id: string;
  brief_id: string;
  order_index: number;
  type: MarketingBriefBlockType;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SectionBlockPayload = {
  number?: string;
  title: string;
  subtitle?: string;
};

export type TextBlockPayload = {
  heading?: string;
  body: string;
};

export type SegmentsBlockPayload = {
  heading?: string;
  segments: {
    top150: string;
    top350: string;
    top500: string;
    top500plus: string;
  };
};

export type CalloutBlockPayload = {
  tone: "info" | "warning" | "success";
  heading?: string;
  body: string;
};

type ApiOk<T> = { success: true; data: T };
type ApiErr = { success: false; code?: string; message?: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function apiError(data: ApiErr, status: number): Error {
  return new Error(data.message ?? `HTTP ${status}`);
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<ApiOk<T> | ApiErr>(res);
  if (!res.ok || !data.success) {
    throw apiError(!data.success ? data : { success: false, message: `HTTP ${res.status}` }, res.status);
  }
  return (data as ApiOk<T>).data;
}

export async function listBriefs(opts?: {
  status?: MarketingBriefStatus;
  period?: string;
}): Promise<MarketingBriefRow[]> {
  const q = new URLSearchParams();
  if (opts?.status) q.set("status", opts.status);
  if (opts?.period && opts.period !== "all") q.set("period", opts.period);
  const qs = q.toString();
  const res = await fetch(`/api/marketing-briefs/list${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await parseJson<ApiOk<MarketingBriefRow[]> | ApiErr>(res);
  if (!res.ok || !data.success) {
    throw apiError(!data.success ? data : { success: false, message: `HTTP ${res.status}` }, res.status);
  }
  return data.data;
}

export async function getBrief(id: string): Promise<{
  brief: MarketingBriefRow;
  revisions: MarketingBriefRevisionRow[];
}> {
  const res = await fetch(`/api/marketing-briefs/get?id=${encodeURIComponent(id)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await parseJson<
    ApiOk<{ brief: MarketingBriefRow; revisions: MarketingBriefRevisionRow[] }> | ApiErr
  >(res);
  if (!res.ok || !data.success) {
    throw apiError(!data.success ? data : { success: false, message: `HTTP ${res.status}` }, res.status);
  }
  return data.data;
}

export async function createBrief(input: {
  period_label: string;
  title?: string;
  visibility?: MarketingBriefVisibility;
  accent_color?: string;
  cover_text?: string;
}): Promise<MarketingBriefRow> {
  return postJson<MarketingBriefRow>("/api/marketing-briefs/create", input);
}

export async function updateBrief(
  id: string,
  patch: Partial<
    Pick<MarketingBriefRow, "period_label" | "title" | "visibility" | "accent_color" | "cover_text">
  >,
): Promise<MarketingBriefRow> {
  return postJson<MarketingBriefRow>("/api/marketing-briefs/update", { id, patch });
}

export async function publishBrief(id: string): Promise<MarketingBriefRow> {
  return postJson<MarketingBriefRow>("/api/marketing-briefs/publish", { id });
}

export async function unpublishBrief(id: string): Promise<MarketingBriefRow> {
  return postJson<MarketingBriefRow>("/api/marketing-briefs/unpublish", { id });
}

export async function archiveBrief(id: string): Promise<MarketingBriefRow> {
  return postJson<MarketingBriefRow>("/api/marketing-briefs/archive", { id });
}

export async function restoreBrief(id: string): Promise<MarketingBriefRow> {
  return postJson<MarketingBriefRow>("/api/marketing-briefs/restore", { id });
}

export async function deleteBrief(id: string): Promise<void> {
  await postJson<{ ok: boolean }>("/api/marketing-briefs/delete", { id });
}

export type MarketingBriefPublicFetchReason = "not_found" | "unauthorized" | "forbidden";

export class MarketingBriefPublicFetchError extends Error {
  readonly reason: MarketingBriefPublicFetchReason;

  constructor(reason: MarketingBriefPublicFetchReason, message?: string) {
    super(message ?? reason);
    this.name = "MarketingBriefPublicFetchError";
    this.reason = reason;
  }
}

export async function fetchPublicBrief(id: string): Promise<{
  brief: MarketingBriefRow;
  blocks: MarketingBriefBlockRow[];
}> {
  const res = await fetch(`/api/marketing-briefs/public-get?id=${encodeURIComponent(id)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await parseJson<ApiOk<{ brief: MarketingBriefRow; blocks: MarketingBriefBlockRow[] }> | ApiErr>(res);
  if (res.status === 401) {
    throw new MarketingBriefPublicFetchError(
      "unauthorized",
      !data.success ? data.message : "Требуется вход.",
    );
  }
  if (res.status === 403) {
    throw new MarketingBriefPublicFetchError(
      "forbidden",
      !data.success ? data.message : "Доступ запрещён.",
    );
  }
  if (!res.ok || !data.success) {
    throw new MarketingBriefPublicFetchError(
      "not_found",
      !data.success ? data.message : `HTTP ${res.status}`,
    );
  }
  return data.data;
}

/** Полный URL публичной ссылки на бриф (path для OG-ботов + редирект в SPA). */
export function buildPublicBriefShareUrl(briefId: string): string {
  if (typeof window === "undefined") return `/p/brief/${briefId}`;
  return `${window.location.origin}/p/brief/${briefId}`;
}

/** URL публичной страницы с автопечатью (открывается в новой вкладке). */
export function buildBriefPrintUrl(briefId: string): string {
  if (typeof window === "undefined") return `/p/brief/${briefId}?print=1`;
  return `${window.location.origin}/p/brief/${briefId}?print=1`;
}

/** Открыть print-страницу брифа и вызвать диалог печати / «Сохранить PDF». */
export function downloadBriefPdf(briefId: string): void {
  const url = buildBriefPrintUrl(briefId);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    window.location.href = url;
  }
}

export function briefDisplayTitle(title: string): { text: string; isPlaceholder: boolean } {
  const t = title.trim();
  if (!t) return { text: "Без названия", isPlaceholder: true };
  return { text: t, isPlaceholder: false };
}

export async function listBlocks(briefId: string): Promise<MarketingBriefBlockRow[]> {
  const res = await fetch(
    `/api/marketing-briefs/blocks-list?brief_id=${encodeURIComponent(briefId)}`,
    { credentials: "include", cache: "no-store" },
  );
  const data = await parseJson<ApiOk<MarketingBriefBlockRow[]> | ApiErr>(res);
  if (!res.ok || !data.success) {
    throw apiError(!data.success ? data : { success: false, message: `HTTP ${res.status}` }, res.status);
  }
  return data.data;
}

export async function createBlock(input: {
  brief_id: string;
  type: MarketingBriefBlockType;
  payload?: Record<string, unknown>;
  insert_after_id?: string;
}): Promise<MarketingBriefBlockRow> {
  return postJson<MarketingBriefBlockRow>("/api/marketing-briefs/blocks-create", input);
}

export async function updateBlock(id: string, payload: Record<string, unknown>): Promise<MarketingBriefBlockRow> {
  return postJson<MarketingBriefBlockRow>("/api/marketing-briefs/blocks-update", { id, payload });
}

export async function reorderBlocks(briefId: string, order: string[]): Promise<MarketingBriefBlockRow[]> {
  return postJson<MarketingBriefBlockRow[]>("/api/marketing-briefs/blocks-reorder", {
    brief_id: briefId,
    order,
  });
}

export async function deleteBlock(id: string): Promise<void> {
  await postJson<{ ok: boolean }>("/api/marketing-briefs/blocks-delete", { id });
}

export function blockTypeLabel(type: MarketingBriefBlockType): string {
  switch (type) {
    case "section":
      return "Раздел";
    case "text":
      return "Текст";
    case "segments":
      return "Сегменты";
    case "callout":
      return "Выноска";
    case "products":
      return "Товары";
    case "price_table":
      return "Прайс";
    case "bonus":
      return "Бонус";
    default:
      return type;
  }
}

export const DEFAULT_MARKETING_BRIEF_ACCENT = "#9ACA3C";

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

export function formatBriefUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function last12PeriodOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [{ value: "all", label: "Все периоды" }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: formatMarketingBriefPeriodLabel(value) });
  }
  return out;
}

export function revisionActionLabel(action: string): string {
  switch (action) {
    case "create":
      return "Создание";
    case "update":
      return "Изменение";
    case "publish":
      return "Публикация";
    case "unpublish":
      return "Снятие с публикации";
    case "archive":
      return "Архив";
    case "restore":
      return "Восстановление";
    case "block_create":
      return "Добавлен блок";
    case "block_update":
      return "Изменён блок";
    case "block_reorder":
      return "Изменён порядок блоков";
    case "block_delete":
      return "Удалён блок";
    default:
      return action;
  }
}

export function briefStatusLabel(status: MarketingBriefStatus): string {
  if (status === "published") return "Опубликовано";
  if (status === "archived") return "Архив";
  return "Черновик";
}
