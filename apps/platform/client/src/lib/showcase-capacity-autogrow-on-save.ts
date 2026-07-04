import type { TradePointShowcaseSelectedModel } from "./client-base-actualization-state.js";
import type { CatalogProduct } from "./catalog-product-type.js";
import {
  countSelectedByType,
  getShowcaseTypeCapacity,
  neededCapacityGrowthByType,
  SHOWCASE_TYPE_LABEL_RU,
  type ShowcaseTypeKey,
} from "./showcase-type-capacity.js";

export type ShowcaseCapacityGrownType = {
  type: ShowcaseTypeKey;
  oldCapacity: number;
  nextCapacity: number;
  markedCount: number;
};

const ALL_SHOWCASE_TYPES: readonly ShowcaseTypeKey[] = ["entrance", "interior", "hardware"];

/** Объединяет счётчики из draft/placement и из selectedShowcaseModels (берём максимум по типу). */
export function mergeMarkedCountsByType(
  fromDraft: ReadonlyMap<ShowcaseTypeKey, number>,
  selected: readonly TradePointShowcaseSelectedModel[],
  catalogLookup: (id: string) => CatalogProduct | undefined,
): Map<ShowcaseTypeKey, number> {
  const marked = new Map(fromDraft);
  for (const type of ALL_SHOWCASE_TYPES) {
    const fromSelection = countSelectedByType(selected, type, catalogLookup);
    if (fromSelection <= 0) continue;
    marked.set(type, Math.max(marked.get(type) ?? 0, fromSelection));
  }
  return marked;
}

/** Собирает итоговый список авто-выросших типов для уведомления (категорийная ёмкость). */
export function aggregateShowcaseCapacityGrownTypes(
  markedByType: ReadonlyMap<ShowcaseTypeKey, number>,
  appliedCategoryGrowth: ReadonlyArray<{ type: ShowcaseTypeKey; oldCapacity: number; nextCapacity: number }>,
): ShowcaseCapacityGrownType[] {
  const rows: ShowcaseCapacityGrownType[] = [];
  for (const { type, oldCapacity, nextCapacity } of appliedCategoryGrowth) {
    if (nextCapacity <= oldCapacity) continue;
    rows.push({
      type,
      oldCapacity,
      nextCapacity,
      markedCount: markedByType.get(type) ?? nextCapacity,
    });
  }
  rows.sort((a, b) => ALL_SHOWCASE_TYPES.indexOf(a.type) - ALL_SHOWCASE_TYPES.indexOf(b.type));
  return rows;
}

/** План роста категорийной ёмкости по merged marked counts. */
export function planCategoryCapacityGrowthForMarked(
  showcaseRec: Parameters<typeof neededCapacityGrowthByType>[0],
  markedByType: ReadonlyMap<ShowcaseTypeKey, number>,
): Array<{ type: ShowcaseTypeKey; oldCapacity: number; nextCapacity: number }> {
  return neededCapacityGrowthByType(showcaseRec, markedByType);
}

export function formatShowcaseCapacityAutoGrowLine(row: ShowcaseCapacityGrownType): string {
  const label = SHOWCASE_TYPE_LABEL_RU[row.type];
  return `${label}: было ${row.oldCapacity} → стало ${row.nextCapacity} (отмечено ${row.markedCount})`;
}

export function formatShowcaseCapacityAutoGrowToastDescription(
  type: ShowcaseTypeKey,
  oldCapacity: number,
  nextCapacity: number,
): string {
  return `Количество витрин ${SHOWCASE_TYPE_LABEL_RU[type]} увеличено с ${oldCapacity} до ${nextCapacity}. Уточните фактическое значение, чтобы дистрибуция считалась корректно.`;
}

/** После применения роста: ёмкость по каждому типу ≥ отмеченного. */
export function showcaseCapacityCoversMarkedCounts(
  showcaseRec: Parameters<typeof getShowcaseTypeCapacity>[0],
  markedByType: ReadonlyMap<ShowcaseTypeKey, number>,
): boolean {
  for (const type of ALL_SHOWCASE_TYPES) {
    const marked = markedByType.get(type) ?? 0;
    if (marked <= 0) continue;
    const cap = getShowcaseTypeCapacity(showcaseRec, type);
    const capNum = cap == null ? 0 : cap;
    if (marked > capNum) return false;
  }
  return true;
}
