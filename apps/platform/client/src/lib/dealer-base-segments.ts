/**
 * Рабочие сегменты списка клиентской базы (TOP 150 … Новые / Прочие).
 * Источник правды — `DealerRow.clientCategory` (та же модель, что бейдж и фильтры по категории).
 */

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
  other: "Клиенты вне ТОП-сегментов (потенциальные, без категории и т.д.).",
};

export const DEALER_BASE_SEGMENT_FILTER_LABELS: Record<DealerBaseSegmentFilterId, string> = {
  all: "Все сегменты",
  ...DEALER_BASE_SEGMENT_LABELS,
};

export function getDealerBaseSegment(row: DealerRow): DealerBaseSegmentId {
  switch (row.clientCategory) {
    case "top150":
      return "top150";
    case "top350":
      return "top350";
    case "top500":
      return "top500";
    case "top500plus":
      return "top500_plus";
    case "lead":
      return "new";
    default:
      return "other";
  }
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
