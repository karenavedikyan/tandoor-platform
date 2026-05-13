/**
 * Единая бизнес-категория клиента (не буквы A/B/C в UI).
 * Источник правды для отображения и фильтров; сиды/Excel — через normalize + derive.
 */

import type { ReleaseClientNormalizedType } from "@/lib/release-client-seed.generated";

export type ClientCategoryId =
  | "top150"
  | "top350"
  | "top500"
  | "top500plus"
  | "potential"
  | "lead"
  | "no_sales"
  | "uncategorized";

export type ClientCategoryMeta = {
  id: ClientCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  badgeClassName: string;
  order: number;
};

const META: Record<ClientCategoryId, ClientCategoryMeta> = {
  top150: {
    id: "top150",
    label: "ТОП 150",
    shortLabel: "ТОП 150",
    description: "Клиенты сегмента ТОП 150",
    badgeClassName: "border-amber-500/50 bg-amber-500/10 text-amber-950",
    order: 10,
  },
  top350: {
    id: "top350",
    label: "ТОП 350",
    shortLabel: "ТОП 350",
    description: "Клиенты сегмента ТОП 350",
    badgeClassName: "border-amber-500/45 bg-amber-500/8 text-amber-950",
    order: 20,
  },
  top500: {
    id: "top500",
    label: "ТОП 500",
    shortLabel: "ТОП 500",
    description: "Клиенты сегмента ТОП 500",
    badgeClassName: "border-orange-500/50 bg-orange-500/10 text-orange-950",
    order: 30,
  },
  top500plus: {
    id: "top500plus",
    label: "ТОП 500+",
    shortLabel: "ТОП 500+",
    description: "Клиенты сегмента ТОП 500+",
    badgeClassName: "border-orange-600/50 bg-orange-600/10 text-orange-950",
    order: 40,
  },
  potential: {
    id: "potential",
    label: "Потенциальный",
    shortLabel: "Потенциал",
    description: "Потенциальный клиент (по данным Excel / правилам сегмента)",
    badgeClassName: "border-sky-500/50 bg-sky-500/10 text-sky-950",
    order: 50,
  },
  lead: {
    id: "lead",
    label: "Лид",
    shortLabel: "Лид",
    description: "Новый клиент (только если явно указано в данных)",
    badgeClassName: "border-violet-500/50 bg-violet-500/10 text-violet-950",
    order: 60,
  },
  no_sales: {
    id: "no_sales",
    label: "Б/П",
    shortLabel: "Б/П",
    description: "Без продаж в течение квартала — только при явной метке в данных",
    badgeClassName: "border-slate-500/50 bg-slate-500/10 text-slate-900",
    order: 70,
  },
  uncategorized: {
    id: "uncategorized",
    label: "Без категории",
    shortLabel: "—",
    description: "Тип не отнесён к бизнес-сегменту или требует уточнения",
    badgeClassName: "border-border/80 bg-muted/40 text-muted-foreground",
    order: 1000,
  },
};

export const CLIENT_CATEGORY_META: readonly ClientCategoryMeta[] = (
  Object.keys(META) as ClientCategoryId[]
)
  .map((id) => META[id])
  .sort((a, b) => a.order - b.order);

/** Категории «ТОП» для KPI и быстрых фильтров. */
export const CLIENT_CATEGORY_TOP_IDS: readonly ClientCategoryId[] = ["top150", "top350", "top500", "top500plus"];

export function isClientTopTier(id: ClientCategoryId): boolean {
  return CLIENT_CATEGORY_TOP_IDS.includes(id);
}

/**
 * Нормализация произвольной строки (Excel, query, legacy) к ClientCategoryId.
 * Не подставляет «Потенциальный» по витрине — для этого см. deriveReleaseClientCategory и TODO ниже.
 */
export function normalizeClientCategory(input: string | undefined | null): ClientCategoryId {
  if (input == null) return "uncategorized";
  const raw = String(input).trim();
  if (!raw) return "uncategorized";
  const s = raw.toLowerCase().replace(/\s+/g, " ").replace(/_/g, "");

  if (s === "a" || s === "b" || s === "c") return "uncategorized";

  if (s.includes("топ150") || s === "top150" || s === "150" || s.includes("топ 150")) return "top150";
  if (s.includes("топ350") || s === "top350" || s.includes("топ 350")) return "top350";
  if (s.includes("топ500+") || s.includes("500+") || s.includes("топ 500+") || s === "top500plus" || s === "top500_plus")
    return "top500plus";
  if (s.includes("топ500") || s === "top500" || s.includes("топ 500")) return "top500";

  if (s.includes("потенциал") || s === "potential") return "potential";
  if (s.includes("лид") || s === "lead") return "lead";
  if (s.includes("б/п") || s.includes("б п") || s.includes("безпродаж") || s.includes("без продаж") || s === "bp" || s === "nosales")
    return "no_sales";

  if (s === "top" || s === "vip") return "uncategorized";

  return "uncategorized";
}

export function clientCategoryFromNormalizedType(nt: ReleaseClientNormalizedType): ClientCategoryId {
  switch (nt) {
    case "top150":
      return "top150";
    case "top350":
      return "top350";
    case "top500":
      return "top500";
    case "potential":
      return "potential";
    case "volume":
    case "active":
    case "closed":
    case "nonTarget":
    case "unknown":
      return "uncategorized";
    default:
      return "uncategorized";
  }
}

export type ReleaseClientCategoryInput = {
  clientType?: string;
  normalizedClientType: ReleaseClientNormalizedType;
  /** Когда в сиде появится число полотен на витрине — учесть правило «500+ и >100 → Потенциальный». */
  showcaseCanvasCount?: number | null;
};

/**
 * Категория для Release/Dealer: сначала явная строка из Excel, затем normalizedClientType.
 *
 * TODO(client-category): при наличии `showcaseCanvasCount` и категории top500plus,
 * если showcaseCanvasCount > 100, возвращать "potential" (бизнес-правило «Потенциальный»).
 * Сейчас поле в сиде отсутствует — не вычисляем.
 */
export function deriveReleaseClientCategory(c: ReleaseClientCategoryInput): ClientCategoryId {
  const fromExcel = normalizeClientCategory(c.clientType);
  if (fromExcel !== "uncategorized") {
    // TODO: showcaseCanvasCount + top500plus → potential (см. JSDoc)
    return fromExcel;
  }
  const fromNt = clientCategoryFromNormalizedType(c.normalizedClientType);
  // TODO: то же правило, если fromNt === "top500plus" и есть showcaseCanvasCount
  return fromNt;
}

export function getClientCategoryLabel(id: ClientCategoryId): string {
  return META[id]?.label ?? META.uncategorized.label;
}

export function getClientCategoryShortLabel(id: ClientCategoryId): string {
  return META[id]?.shortLabel ?? META.uncategorized.shortLabel;
}

export function getClientCategoryBadgeClass(id: ClientCategoryId): string {
  return META[id]?.badgeClassName ?? META.uncategorized.badgeClassName;
}

export function getClientCategoryOptions(): { value: ClientCategoryId | "all"; label: string }[] {
  return [{ value: "all", label: "Все категории" }, ...CLIENT_CATEGORY_META.map((m) => ({ value: m.id, label: m.label }))];
}

/** Для DealerRow / фильтра «категория» в клиентской базе. `__top_tier__` — любой ТОП 150/350/500/500+. */
export function clientCategoryMatchesFilter(
  rowCategory: ClientCategoryId,
  categoryFilter: ClientCategoryId | "all" | "__top_tier__",
): boolean {
  if (categoryFilter === "all") return true;
  if (categoryFilter === "__top_tier__") return isClientTopTier(rowCategory);
  return rowCategory === categoryFilter;
}
