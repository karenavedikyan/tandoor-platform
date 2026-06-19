import type { CatalogProduct } from "./catalog-product-type.js";
import type { CatalogFilterFacet } from "@/components/catalog/CatalogFiltersPanel";
import type { FilterCheckboxOption } from "@/components/catalog/FilterCheckboxGroup";
import {
  productDistributionCategory,
  type DistributionCatalogCategoryId,
} from "./distribution-catalog-categories.js";

export type CatalogFiltersValue = Record<string, string[]>;

type FacetDef = {
  key: string;
  label: string;
  values: (p: CatalogProduct) => string[];
};

const FACET_DEFS: FacetDef[] = [
  { key: "brand", label: "Бренд", values: (p) => (p.manufacturer?.trim() ? [p.manufacturer.trim()] : []) },
  { key: "series", label: "Серия", values: (p) => (p.series?.trim() ? [p.series.trim()] : []) },
  {
    key: "color",
    label: "Цвет / декор",
    values: (p) => p.colors.map((c) => c.trim()).filter(Boolean),
  },
  { key: "coating", label: "Покрытие", values: (p) => (p.coating?.trim() ? [p.coating.trim()] : []) },
  {
    key: "openType",
    label: "Тип открывания",
    values: (p) => (p.openType?.trim() ? [p.openType.trim()] : []),
  },
];

function productMatchesFacet(p: CatalogProduct, key: string, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const def = FACET_DEFS.find((d) => d.key === key);
  if (!def) return true;
  const values = def.values(p);
  return values.some((v) => selected.includes(v));
}

export function filterCatalogProductsByFilters(
  products: CatalogProduct[],
  selected: CatalogFiltersValue,
  categories: readonly DistributionCatalogCategoryId[] = [],
): CatalogProduct[] {
  return products.filter((p) => {
    if (categories.length > 0 && !categories.includes(productDistributionCategory(p))) return false;
    for (const [key, values] of Object.entries(selected)) {
      if (key === "cat" || values.length === 0) continue;
      if (!productMatchesFacet(p, key, values)) return false;
    }
    return true;
  });
}

function countFacetOptions(
  products: CatalogProduct[],
  def: FacetDef,
  selected: CatalogFiltersValue,
  categories: readonly DistributionCatalogCategoryId[],
): FilterCheckboxOption[] {
  const pool = filterCatalogProductsByFilters(
    products,
    Object.fromEntries(Object.entries(selected).filter(([k]) => k !== def.key)),
    categories,
  );
  const counts = new Map<string, number>();
  for (const p of pool) {
    for (const v of def.values(p)) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "ru"));
}

export function computeCatalogFacets(
  products: CatalogProduct[],
  selected: CatalogFiltersValue,
  categories: readonly DistributionCatalogCategoryId[] = [],
): CatalogFilterFacet[] {
  const out: CatalogFilterFacet[] = [];
  for (const def of FACET_DEFS) {
    const options = countFacetOptions(products, def, selected, categories);
    if (options.length < 2) continue;
    out.push({ key: def.key, label: def.label, kind: "checkbox", options });
  }
  return out;
}

export function countActiveCatalogFilters(
  selected: CatalogFiltersValue,
  categories: readonly DistributionCatalogCategoryId[],
  query: string,
): number {
  let n = categories.length > 0 ? 1 : 0;
  if (query.trim()) n += 1;
  for (const values of Object.values(selected)) {
    if (values.length > 0) n += 1;
  }
  return n;
}
