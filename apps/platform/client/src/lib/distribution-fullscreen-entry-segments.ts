import type { DistributionCatalogCategoryId } from "./distribution-catalog-categories.js";
import type { ShowcasePlacementSegment } from "./showcase-matrix-api.js";

export const FULLSCREEN_SEGMENT_CATEGORY_IDS = ["vh", "mk", "hardware"] as const satisfies readonly DistributionCatalogCategoryId[];

export type FullscreenSegmentCategoryId = (typeof FULLSCREEN_SEGMENT_CATEGORY_IDS)[number];

export function segmentContextFromCategories(
  categories: readonly DistributionCatalogCategoryId[],
): ShowcasePlacementSegment {
  if (categories.includes("mk")) return "mk";
  if (categories.includes("hardware")) return "hardware";
  return "vh";
}

/** Вкладки сегмента (ВХ/МК/Фурнитура) видны во всех статусах, включая «На витрине». */
export function isFullscreenSegmentTabsVisible(_workStatus: string): boolean {
  return true;
}

export function activeFullscreenSegmentCategory(
  selectedCategoryIds: readonly string[],
  placementTypeMode: boolean,
): FullscreenSegmentCategoryId | "all" {
  for (const id of FULLSCREEN_SEGMENT_CATEGORY_IDS) {
    if (selectedCategoryIds.includes(id)) return id;
  }
  return placementTypeMode ? "vh" : "all";
}
