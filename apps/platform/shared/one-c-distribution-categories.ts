/**
 * Категории дистрибуции витрины — тот же словарь, что в основном ЛК.
 */

export type OneCShowcaseCategoryId = "entrance_doors" | "interior_doors" | "hardware" | "molding";

export const ONE_C_SHOWCASE_CATEGORIES: OneCShowcaseCategoryId[] = [
  "entrance_doors",
  "interior_doors",
  "hardware",
  "molding",
];

export const ONE_C_SHOWCASE_CATEGORY_LABEL: Record<OneCShowcaseCategoryId, string> = {
  entrance_doors: "Входные двери",
  interior_doors: "Межкомнатные двери",
  hardware: "Фурнитура",
  molding: "Плинтусы и доборы",
};

export function isOneCShowcaseCategoryId(value: string): value is OneCShowcaseCategoryId {
  return (ONE_C_SHOWCASE_CATEGORIES as readonly string[]).includes(value);
}

export function countFilledCategories(
  rows: readonly { category_id: string; actual_count: number }[],
): { filled: number; total: number } {
  const filledSet = new Set<string>();
  for (const row of rows) {
    if (row.actual_count > 0) filledSet.add(row.category_id);
  }
  return { filled: filledSet.size, total: ONE_C_SHOWCASE_CATEGORIES.length };
}
