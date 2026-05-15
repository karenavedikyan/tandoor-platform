/**
 * Рабочие сегменты списка клиентской базы (TOP 150 … Новые / Прочие).
 * Не меняет `DealerRow.clientCategory` — только правило отображения в группах.
 */

import type { ClientCategoryId } from "@/lib/client-category";
import type { DealerRow } from "@/lib/dealer-base-mock-data";

export type DealerBaseSegmentId = "top150" | "top350" | "top500" | "top500_plus" | "new" | "other";

export type DealerBaseSegmentFilterId = "all" | DealerBaseSegmentId;

export const DEALER_BASE_SEGMENT_ORDER: readonly DealerBaseSegmentId[] = [
  "top150",
  "top350",
  "top500",
  "top500_plus",
  "new",
  "other",
] as const;

export const DEALER_BASE_SEGMENT_COLLAPSE_STORAGE_KEY = "tandoor-dealer-base-segment-collapse-v1";

export const DEALER_BASE_SEGMENT_LABELS: Record<DealerBaseSegmentId, string> = {
  top150: "TOP 150",
  top350: "TOP 350",
  top500: "TOP 500",
  top500_plus: "TOP 500+",
  new: "Новые",
  other: "Прочие",
};

export const DEALER_BASE_SEGMENT_DESCRIPTIONS: Record<DealerBaseSegmentId, string> = {
  top150: "Ключевой фокус менеджера — максимальный приоритет визитов и витрины.",
  top350: "Расширенный приоритет: план контактов и контроль дистрибуции.",
  top500: "Стабильный портфель: регулярный мониторинг и задачи по витрине.",
  top500_plus: "Массовый сегмент: дисциплина выкладки и точечные улучшения.",
  new: "Новые клиенты и лиды — быстрый онбординг и первичная постановка задач.",
  other: "Клиенты вне явных ТОП-сегментов в данных — уточнение статуса и плана.",
};

export const DEALER_BASE_SEGMENT_FILTER_LABELS: Record<DealerBaseSegmentFilterId, string> = {
  all: "Все сегменты",
  ...DEALER_BASE_SEGMENT_LABELS,
};

function charSum(id: string): number {
  let s = 0;
  for (let i = 0; i < id.length; i++) s += id.charCodeAt(i);
  return s;
}

/**
 * Детерминированный «псевдо-ТОП» для строк без явной метки TOP в `clientCategory`:
 * используются дистрибуция, категория и хэш id (без Math.random).
 */
function fallbackSegmentFromRow(row: DealerRow, c: ClientCategoryId): DealerBaseSegmentId {
  const h = charSum(row.id);
  const d = row.distribution;

  if (c === "potential") {
    if (d >= 68) return h % 2 === 0 ? "top500_plus" : "top500";
    if (d >= 55) return h % 3 === 0 ? "top350" : "top500";
    if (d >= 42) return h % 2 === 0 ? "top500" : "top350";
    const m = h % 4;
    if (m === 0) return "top350";
    if (m === 1) return "top500";
    if (m === 2) return "top500_plus";
    return "other";
  }

  if (c === "no_sales") return "other";

  if (d >= 70) return h % 2 === 0 ? "top500_plus" : "top500";
  if (d >= 58) return "top500";
  if (d >= 46) return "top350";
  const m = h % 5;
  if (m <= 1) return "top350";
  if (m === 2) return "top500";
  if (m === 3) return "top500_plus";
  return "other";
}

export function getDealerBaseSegment(row: DealerRow): DealerBaseSegmentId {
  const c = row.clientCategory;
  if (c === "top150") return "top150";
  if (c === "top350") return "top350";
  if (c === "top500") return "top500";
  if (c === "top500plus") return "top500_plus";
  if (c === "lead") return "new";
  return fallbackSegmentFromRow(row, c);
}

export function sortDealersByName(rows: DealerRow[]): DealerRow[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));
}

export function partitionDealersBySegment(rows: DealerRow[]): Record<DealerBaseSegmentId, DealerRow[]> {
  const buckets: Record<DealerBaseSegmentId, DealerRow[]> = {
    top150: [],
    top350: [],
    top500: [],
    top500_plus: [],
    new: [],
    other: [],
  };
  for (const r of rows) {
    buckets[getDealerBaseSegment(r)].push(r);
  }
  for (const id of DEALER_BASE_SEGMENT_ORDER) {
    buckets[id] = sortDealersByName(buckets[id]);
  }
  return buckets;
}

/** Для `data-testid`: top500_plus → top500-plus */
export function dealerBaseSegmentTestSlug(id: DealerBaseSegmentId): string {
  return id.replace(/_/g, "-");
}

export function dealerBaseSegmentSectionTestId(id: DealerBaseSegmentId): string {
  return `section-dealer-segment-${dealerBaseSegmentTestSlug(id)}`;
}

export type DealerBaseSegmentCollapseState = Record<DealerBaseSegmentId, boolean>;

/** `true` = блок свёрнут */
export function defaultDealerBaseSegmentCollapse(isNarrowViewport: boolean): DealerBaseSegmentCollapseState {
  if (isNarrowViewport) {
    return {
      top150: false,
      top350: true,
      top500: true,
      top500_plus: true,
      new: false,
      other: true,
    };
  }
  return {
    top150: false,
    top350: false,
    top500: false,
    top500_plus: false,
    new: false,
    other: false,
  };
}

export function loadDealerBaseSegmentCollapseOverrides(): Partial<DealerBaseSegmentCollapseState> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(DEALER_BASE_SEGMENT_COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Partial<Record<string, boolean>>;
    const out: Partial<DealerBaseSegmentCollapseState> = {};
    for (const id of DEALER_BASE_SEGMENT_ORDER) {
      if (typeof p[id] === "boolean") out[id] = p[id];
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDealerBaseSegmentCollapseState(state: DealerBaseSegmentCollapseState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_BASE_SEGMENT_COLLAPSE_STORAGE_KEY, JSON.stringify(state));
}
