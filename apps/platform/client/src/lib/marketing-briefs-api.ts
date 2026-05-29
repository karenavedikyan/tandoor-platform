/**
 * HTTP API маркетинговых брифов (Postgres, Промт 102).
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
  accent_color?: string;
  cover_text?: string;
}): Promise<MarketingBriefRow> {
  return postJson<MarketingBriefRow>("/api/marketing-briefs/create", input);
}

export async function updateBrief(
  id: string,
  patch: Partial<Pick<MarketingBriefRow, "period_label" | "title" | "accent_color" | "cover_text">>,
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
    default:
      return action;
  }
}

export function briefStatusLabel(status: MarketingBriefStatus): string {
  if (status === "published") return "Опубликовано";
  if (status === "archived") return "Архив";
  return "Черновик";
}
