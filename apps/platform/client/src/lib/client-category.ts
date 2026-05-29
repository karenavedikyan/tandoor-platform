/**
 * Единая бизнес-категория клиента (не буквы A/B/C в UI).
 * Источник правды для отображения и фильтров; сиды/Excel — через normalize + derive.
 */

import type { UserRole } from "@shared/auth";
import type { ReleaseClientNormalizedType } from "@/lib/release-client-seed.generated";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

export type ClientCategoryId =
  | "new_client"
  | "top150"
  | "top350"
  | "top500"
  | "top500plus";

/** @deprecated Legacy ids from persisted data — normalize via normalizeClientCategory. */
export type LegacyClientCategoryId =
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
  new_client: {
    id: "new_client",
    label: "Новый клиент",
    shortLabel: "Новый",
    description: "Новый клиент — категория ещё не присвоена",
    badgeClassName:
      "border-violet-500/50 bg-violet-500/15 text-violet-900 dark:border-violet-400/60 dark:bg-violet-400/20 dark:text-violet-100",
    order: 5,
  },
  top150: {
    id: "top150",
    label: "ТОП 150",
    shortLabel: "ТОП 150",
    description: "Клиенты сегмента ТОП 150",
    badgeClassName:
      "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:border-amber-400/60 dark:bg-amber-400/20 dark:text-amber-100",
    order: 10,
  },
  top350: {
    id: "top350",
    label: "ТОП 350",
    shortLabel: "ТОП 350",
    description: "Клиенты сегмента ТОП 350",
    badgeClassName:
      "border-amber-500/45 bg-amber-500/12 text-amber-900 dark:border-amber-400/55 dark:bg-amber-400/18 dark:text-amber-100",
    order: 20,
  },
  top500: {
    id: "top500",
    label: "ТОП 500",
    shortLabel: "ТОП 500",
    description: "Клиенты сегмента ТОП 500",
    badgeClassName:
      "border-orange-500/50 bg-orange-500/15 text-orange-900 dark:border-orange-400/60 dark:bg-orange-400/20 dark:text-orange-100",
    order: 30,
  },
  top500plus: {
    id: "top500plus",
    label: "ТОП 500+",
    shortLabel: "ТОП 500+",
    description: "Клиенты сегмента ТОП 500+",
    badgeClassName:
      "border-orange-600/55 bg-orange-600/15 text-orange-900 dark:border-orange-400/65 dark:bg-orange-400/22 dark:text-orange-100",
    order: 40,
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

export function isNewClientCategory(id: ClientCategoryId): boolean {
  return id === "new_client";
}

function isKnownCategoryId(id: string): id is ClientCategoryId {
  return id in META;
}

/**
 * Нормализация произвольной строки (Excel, query, legacy) к ClientCategoryId.
 */
export function normalizeClientCategory(input: string | undefined | null): ClientCategoryId {
  if (input == null) return "new_client";
  const raw = String(input).trim();
  if (!raw) return "new_client";
  const s = raw.toLowerCase().replace(/\s+/g, " ").replace(/_/g, "");

  if (s === "a" || s === "b" || s === "c") return "new_client";

  if (s.includes("топ150") || s === "top150" || s === "150" || s.includes("топ 150")) return "top150";
  if (s.includes("топ350") || s === "top350" || s.includes("топ 350")) return "top350";
  if (s.includes("топ500+") || s.includes("500+") || s.includes("топ 500+") || s === "top500plus" || s === "top500_plus")
    return "top500plus";
  if (s.includes("топ500") || s === "top500" || s.includes("топ 500")) return "top500";

  if (s.includes("объемообраз") || s.includes("объемо образ")) return "top500plus";

  if (s.includes("новый") || s === "newclient" || s === "new_client") return "new_client";

  if (s.includes("потенциал") || s === "potential") return "new_client";
  if (s.includes("лид") || s === "lead") return "new_client";
  if (s.includes("б/п") || s.includes("б п") || s.includes("безпродаж") || s.includes("без продаж") || s === "bp" || s === "nosales")
    return "new_client";

  if (s === "top" || s === "vip" || s.includes("безкатегор") || s === "uncategorized" || s === "other" || s === "none")
    return "new_client";

  if (isKnownCategoryId(raw)) return raw;

  return "new_client";
}

export function clientCategoryFromNormalizedType(nt: ReleaseClientNormalizedType): ClientCategoryId {
  switch (nt) {
    case "top150":
      return "top150";
    case "top350":
      return "top350";
    case "top500":
      return "top500";
    case "volume":
      return "top500plus";
    case "potential":
    case "active":
    case "closed":
    case "nonTarget":
    case "unknown":
      return "new_client";
    default:
      return "new_client";
  }
}

export type ReleaseClientCategoryInput = {
  clientType?: string;
  normalizedClientType: ReleaseClientNormalizedType;
  showcaseCanvasCount?: number | null;
};

export function deriveReleaseClientCategory(c: ReleaseClientCategoryInput): ClientCategoryId {
  const fromExcel = normalizeClientCategory(c.clientType);
  if (fromExcel !== "new_client") return fromExcel;
  return clientCategoryFromNormalizedType(c.normalizedClientType);
}

export function getClientCategoryMeta(id: ClientCategoryId): ClientCategoryMeta {
  return META[id];
}

export function getClientCategoryLabel(id: ClientCategoryId): string {
  return META[id]?.label ?? META.new_client.label;
}

export function getClientCategoryShortLabel(id: ClientCategoryId): string {
  return META[id]?.shortLabel ?? META.new_client.shortLabel;
}

export function getClientCategoryBadgeClass(id: ClientCategoryId): string {
  return META[id]?.badgeClassName ?? META.new_client.badgeClassName;
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

/**
 * Маппинг значения Select-а «Категория (ТОП)» из паспорта клиента в `ClientCategoryId`.
 */
export function clientCategoryFromPassportTier(tier: string | undefined | null): ClientCategoryId {
  const t = (tier ?? "").trim();
  if (t === "top150" || t === "top350" || t === "top500") return t;
  if (t === "top500plus" || t === "top500_plus") return "top500plus";
  return "new_client";
}

/** Admin / director / rop могут присваивать ТОП-категорию в карточке клиента. */
export function canEditClientBusinessCategory(
  profile: ReleaseDemoProfile,
  authRole?: UserRole | null,
): boolean {
  if (authRole === "admin" || authRole === "director" || authRole === "rop") return true;
  return profile.role === "sales_director" || profile.role === "team_lead";
}
