import type { CatalogProduct } from "./catalog-product-type.js";

/** Категории каталога в разделе ввода дистрибуции (как на /catalog). */
export type DistributionCatalogCategoryId = "vh" | "mk" | "hardware" | "molding";

export const DISTRIBUTION_CATALOG_CATEGORIES: {
  id: DistributionCatalogCategoryId;
  label: string;
}[] = [
  { id: "vh", label: "ВХ" },
  { id: "mk", label: "МК" },
  { id: "hardware", label: "Фурнитура" },
  { id: "molding", label: "Плинтусы" },
];

export function productDistributionCategory(p: CatalogProduct): DistributionCatalogCategoryId {
  const cat = p.category.toLowerCase();
  const kind = p.doorKind.toLowerCase();
  const name = p.name.toLowerCase();
  if (
    cat.includes("плинтус") ||
    cat.includes("добор") ||
    kind.includes("плинтус") ||
    name.includes("molding") ||
    name.includes("плинтус")
  ) {
    return "molding";
  }
  if (cat.includes("фурнитур") || kind.includes("фурнитур")) return "hardware";
  if (kind.includes("межкомнат") || cat.includes("межкомнат")) return "mk";
  return "vh";
}

export function productMatchesDistributionCategories(
  p: CatalogProduct,
  selected: readonly DistributionCatalogCategoryId[],
): boolean {
  if (selected.length === 0) return true;
  return selected.includes(productDistributionCategory(p));
}
