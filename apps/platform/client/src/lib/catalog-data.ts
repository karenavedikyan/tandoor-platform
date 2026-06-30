/**
 * Локальный каталог моделей Тандор для платформы.
 * Структура полей и набор фильтров согласованы с реальным сайтом/ЛК Tandoor:
 * категории (входные/межкомнатные/скрытые), серия, артикул, размер полотна,
 * толщина, покрытие, тип открывания, производитель, гарантия, отметки
 * хитов/новинок/эксклюзива/акции/наличия, рекомендация для витрины.
 *
 * Первый слой позиций берётся из публичного каталога tandoor.ru (см. `tandoor-real-catalog-seed.generated.ts`
 * и скрипт `scripts/import-tandoor-public-catalog.mjs`); ниже остаётся прежний мок для демо-связей
 * с дилерами и задачами. Публичные позиции не участвуют в моке матрицы витрин (`includeInTradePointMatrix: false`).
 */

import type { CatalogProduct } from "./catalog-product-type";
import { MOCK_CATALOG_PRODUCTS } from "./catalog-mock-products";
import { normalizeDealerIdForCatalog } from "./catalog-dealer-id";
import { isCatalogLazyLoadEnabled } from "./catalog-lazy-load-flag.js";
import { isCatalogDiagEnabled } from "./catalog-diag-flag.js";
import { buildCatalogProductsFromSeed } from "./catalog-products-from-seed.js";

export type { CatalogProduct } from "./catalog-product-type";

export { normalizeDealerIdForCatalog };

let catalogCache: CatalogProduct[] | null = null;
let catalogLoadPromise: Promise<CatalogProduct[]> | null = null;

/** Уникальные `id` — в seed импорта иногда встречаются дубликаты; иначе React ломает список при фильтрации. */
function dedupeCatalogProductsById(products: CatalogProduct[]): CatalogProduct[] {
  const seen = new Set<string>();
  const out: CatalogProduct[] = [];
  for (const p of products) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

function buildFullCatalogFromSeedBuilder(
  buildFromSeed: () => CatalogProduct[],
): CatalogProduct[] {
  return dedupeCatalogProductsById([...buildFromSeed(), ...MOCK_CATALOG_PRODUCTS]);
}

async function buildCatalogCacheLazy(): Promise<CatalogProduct[]> {
  const { buildCatalogProductsFromSeed: buildFromSeed } = await import("./catalog-products-from-seed.js");
  return buildFullCatalogFromSeedBuilder(buildFromSeed);
}

function initEagerCatalogCacheIfNeeded(): void {
  if (!isCatalogLazyLoadEnabled() && catalogCache === null) {
    catalogCache = buildFullCatalogFromSeedBuilder(buildCatalogProductsFromSeed);
  }
}

async function buildCatalogCache(): Promise<CatalogProduct[]> {
  if (!isCatalogLazyLoadEnabled()) {
    initEagerCatalogCacheIfNeeded();
    return catalogCache ?? [];
  }
  return buildCatalogCacheLazy();
}

/** Идемпотентная загрузка seed + mock в in-memory кэш. */
export function ensureCatalogLoaded(): Promise<CatalogProduct[]> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (!catalogLoadPromise) {
    catalogLoadPromise = buildCatalogCache()
      .then((products) => {
        catalogCache = products;
        return products;
      })
      .catch((err) => {
        catalogLoadPromise = null;
        if (isCatalogDiagEnabled()) {
          console.error("[catalog-diag] seed load failed", err);
        } else {
          console.warn("[catalog-data] failed to load catalog seed", err);
        }
        catalogCache = [];
        return catalogCache;
      });
  }
  return catalogLoadPromise;
}

/** Синхронный снимок кэша; до прогрева при CATALOG_LAZY_LOAD — пустой массив. */
export function getCatalogProducts(): CatalogProduct[] {
  return catalogCache ?? [];
}

/** Сброс кэша (тесты). */
export function resetCatalogDataCacheForTests(): void {
  catalogCache = null;
  catalogLoadPromise = null;
}

function createCatalogProductsProxy(): CatalogProduct[] {
  return new Proxy([] as CatalogProduct[], {
    get(_target, prop, receiver) {
      const products = catalogCache ?? [];
      const value = Reflect.get(products, prop, receiver);
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(products);
      }
      return value;
    },
    ownKeys() {
      return Reflect.ownKeys(catalogCache ?? []);
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(catalogCache ?? [], prop);
    },
    has(_target, prop) {
      return Reflect.has(catalogCache ?? [], prop);
    },
  }) as CatalogProduct[];
}

initEagerCatalogCacheIfNeeded();

/** Обратная совместимость: прокси на in-memory кэш (при lazy — пуст до прогрева). */
export const CATALOG_PRODUCTS: CatalogProduct[] = createCatalogProductsProxy();

export function buildCatalogProductSearchHaystack(p: CatalogProduct): string {
  return [
    p.name,
    p.article,
    p.series,
    p.category,
    p.doorKind,
    p.coating,
    p.type,
    p.shortDescription,
    p.description,
    ...(p.features ?? []),
    ...(p.catalogTags ?? []),
    ...(p.catalogImages ?? []).map((c) => c.alt),
    p.catalogSearchText ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Поиск по каталогу: короткие ВХ/МК; несколько слов — OR по вхождению в haystack. */
export function catalogSearchQueryMatchesHaystack(rawQuery: string, haystack: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  if (q === "вх" || q === "vh") return haystack.includes("входн") || haystack.includes("входная");
  if (q === "мк" || q === "mk") return haystack.includes("межкомнат");
  if (q === "входные" || (q.includes("входн") && q.length >= 4)) return haystack.includes("вход");
  if (q === "межкомнатные" || (q.includes("межкомнат") && q.length >= 6)) return haystack.includes("межкомнат");
  if (q === "фурнитура" || q === "замки" || q === "замок") {
    return haystack.includes("фурнитур") || haystack.includes("замок");
  }
  if (q.includes("ручк")) return haystack.includes("ручк");
  if (q.includes("петл")) return haystack.includes("петл");
  if (q.includes("термо")) return haystack.includes("терм");
  if (q.includes("бел")) return haystack.includes("бел");
  if (q.includes("графит")) return haystack.includes("графит");
  const parts = q.split(/\s+/).filter((w) => w.length > 0);
  if (parts.length >= 2) return parts.some((w) => w.length >= 2 && haystack.includes(w));
  return haystack.includes(q);
}

export function getProductById(id: string): CatalogProduct | undefined {
  const t = id.trim().toLowerCase();
  return getCatalogProducts().find((p) => p.id.toLowerCase() === t);
}

/** Поиск по каталогу для диалога брифа (Промт 105). */
export function searchCatalog(query: string, limit = 30): CatalogProduct[] {
  const sorted = [...getCatalogProducts()].sort((a, b) => a.showcasePriority - b.showcasePriority);
  const q = query.trim();
  if (!q) return sorted.slice(0, limit);
  const matched: CatalogProduct[] = [];
  for (const p of sorted) {
    if (matched.length >= limit) break;
    const haystack = buildCatalogProductSearchHaystack(p);
    if (catalogSearchQueryMatchesHaystack(q, haystack)) matched.push(p);
  }
  return matched;
}

/** Снимок полей каталога для блока брифа. */
export function snapshotCatalogProduct(p: CatalogProduct): {
  catalog_id: string;
  name: string;
  article: string;
  image_url: string | null;
  price_retail: number | null;
} {
  return {
    catalog_id: p.id,
    name: p.name,
    article: p.article,
    image_url: p.image ?? null,
    price_retail: p.priceRetailRub ?? null,
  };
}

export function getProductsForDealer(dealerId: string): CatalogProduct[] {
  const id = normalizeDealerIdForCatalog(dealerId);
  return getCatalogProducts().filter((p) => p.relatedDealerIds.includes(id));
}

export function getProductsForTradePoint(dealerId: string, pointId: string): CatalogProduct[] {
  const d = normalizeDealerIdForCatalog(dealerId);
  const normalizedPoint = pointId.includes("-") ? pointId.trim() : `${d}-${pointId.trim().padStart(2, "0")}`;
  return getCatalogProducts().filter((p) => p.relatedTradePointIds.includes(normalizedPoint));
}

/** Для блока «модели в работе» у дилера — стабильный поднабор по id дилера. */
export function getDealerProductPreview(dealerId: string, max = 5): CatalogProduct[] {
  const list = getProductsForDealer(dealerId);
  if (list.length <= max) return list;
  const n = parseInt(dealerId, 10) || 0;
  const start = n % Math.max(1, list.length - max + 1);
  return list.slice(start, start + max);
}

/** Для блока «модели на витрине» у ТТ. */
export function getTradePointProductPreview(dealerId: string, pointId: string, max = 5): CatalogProduct[] {
  const list = getProductsForTradePoint(dealerId, pointId);
  if (list.length <= max) return list;
  return list.slice(0, max);
}

export type DealerProductRowStatus = "продаётся" | "добавить в витрину" | "проверить наличие";

export function dealerRowStatusForProduct(product: CatalogProduct): DealerProductRowStatus {
  if (product.status.includes("Требует") || product.status.includes("Ограничен") || !product.inStock) return "проверить наличие";
  if (!product.recommendedForShowcase) return "добавить в витрину";
  return "продаётся";
}

export type TradePointShowcaseRowStatus = "на витрине" | "запланировать" | "проверить выкладку";

export function tradePointShowcaseStatusForProduct(product: CatalogProduct): TradePointShowcaseRowStatus {
  if (product.recommendedForShowcase) return "на витрине";
  if (product.relatedTaskCount >= 2) return "проверить выкладку";
  return "запланировать";
}
