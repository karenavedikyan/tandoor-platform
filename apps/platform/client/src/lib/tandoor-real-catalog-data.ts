import type { TandoorRealCatalogSeedItem } from "./tandoor-real-catalog-seed.generated";

/** Публичные позиции каталога (совместимо с seed-файлом; `other` — резерв). */
export type TandoorRealCatalogProduct = Omit<TandoorRealCatalogSeedItem, "category"> & {
  category: TandoorRealCatalogSeedItem["category"] | "other";
};

export { TANDOOR_REAL_CATALOG_SEED } from "./tandoor-real-catalog-seed.generated";
