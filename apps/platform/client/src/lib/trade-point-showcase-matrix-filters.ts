import type { ShowcaseMatrixModelDefinition } from "./trade-point-showcase-matrix-models.js";
import type { ShowcaseMatrixStatusId } from "./trade-point-showcase-matrix-storage.js";

export type ShowcaseMatrixQuickFilterId = "needed" | "installed" | "postponed" | "not_relevant" | "all";

export type ShowcaseMatrixCategoryFilter = "all" | "entrance" | "interior" | "hardware";

export const SHOWCASE_MATRIX_CATEGORY_FILTER_STORAGE_KEY_PREFIX = "showcase-matrix:category-filter:";

const VALID_CATEGORY_FILTERS = new Set<ShowcaseMatrixCategoryFilter>([
  "all",
  "entrance",
  "interior",
  "hardware",
]);

export function readShowcaseMatrixCategoryFilterFromStorage(
  tradePointId: string,
): ShowcaseMatrixCategoryFilter {
  if (typeof window === "undefined") return "all";
  try {
    const v = window.sessionStorage.getItem(`${SHOWCASE_MATRIX_CATEGORY_FILTER_STORAGE_KEY_PREFIX}${tradePointId}`);
    if (v && VALID_CATEGORY_FILTERS.has(v as ShowcaseMatrixCategoryFilter)) {
      return v as ShowcaseMatrixCategoryFilter;
    }
  } catch {
    /* ignore */
  }
  return "all";
}

export function writeShowcaseMatrixCategoryFilterToStorage(
  tradePointId: string,
  categoryFilter: ShowcaseMatrixCategoryFilter,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      `${SHOWCASE_MATRIX_CATEGORY_FILTER_STORAGE_KEY_PREFIX}${tradePointId}`,
      categoryFilter,
    );
  } catch {
    /* ignore */
  }
}

export function modelMatchesQuickFilter(st: ShowcaseMatrixStatusId, f: ShowcaseMatrixQuickFilterId): boolean {
  if (st === "not_relevant") return f === "not_relevant";
  if (f === "all") return true;
  if (f === "needed") return st === "need_install";
  if (f === "installed") return st === "installed";
  if (f === "postponed") return st === "postponed";
  return false;
}

export function modelsMatchingCategory(
  list: ShowcaseMatrixModelDefinition[],
  categoryFilter: ShowcaseMatrixCategoryFilter,
): ShowcaseMatrixModelDefinition[] {
  if (categoryFilter === "all") return list;
  if (categoryFilter === "entrance") return list.filter((m) => m.type === "entrance");
  if (categoryFilter === "hardware") return list.filter((m) => m.type === "hardware");
  return list.filter((m) => m.type === "interior");
}

export function filterShowcaseModelsForDisplay(
  list: ShowcaseMatrixModelDefinition[],
  activeQuickFilter: ShowcaseMatrixQuickFilterId,
  categoryFilter: ShowcaseMatrixCategoryFilter,
  catalogFilters: Record<string, string[]>,
  effectiveStatus: (modelId: string) => ShowcaseMatrixStatusId,
  passesCatalogFilters: (m: ShowcaseMatrixModelDefinition, filters: Record<string, string[]>) => boolean,
): ShowcaseMatrixModelDefinition[] {
  return list.filter((m) => {
    if (!modelMatchesQuickFilter(effectiveStatus(m.id), activeQuickFilter)) return false;
    if (categoryFilter === "entrance" && m.type !== "entrance") return false;
    if (categoryFilter === "interior" && m.type !== "interior") return false;
    if (categoryFilter === "hardware" && m.type !== "hardware") return false;
    return passesCatalogFilters(m, catalogFilters);
  });
}

/** Сохраняет только разрешённые ключи; возвращает prev, если содержимое не изменилось. */
export function pruneCatalogFiltersForAllowedKeys(
  prev: Record<string, string[]>,
  allowedKeys: ReadonlySet<string>,
): Record<string, string[]> {
  const prevKeys = Object.keys(prev);
  if (prevKeys.length === 0) return prev;
  if (prevKeys.every((k) => allowedKeys.has(k))) return prev;

  const next: Record<string, string[]> = {};
  for (const k of prevKeys) {
    if (allowedKeys.has(k)) next[k] = prev[k];
  }
  return next;
}
