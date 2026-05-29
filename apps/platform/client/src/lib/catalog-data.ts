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

import {
  TANDOOR_REAL_CATALOG_SEED,
  type TandoorRealCatalogSeedItem,
} from "./tandoor-real-catalog-seed.generated";
import type { CatalogProduct } from "./catalog-product-type";
import { MOCK_CATALOG_PRODUCTS } from "./catalog-mock-products";
import { normalizeDealerIdForCatalog } from "./catalog-dealer-id";

export type { CatalogProduct } from "./catalog-product-type";

export { normalizeDealerIdForCatalog };

function cleanPublicDescription(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw
    .replace(/&nbsp;/g, " ")
    .replace(/&#8381;/g, "₽")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function mapPublicSeedToCatalogProduct(row: TandoorRealCatalogSeedItem): CatalogProduct {
  const doorKind =
    row.category === "entrance" ? "Входная" : row.category === "interior" ? "Межкомнатная" : "Фурнитура";
  const categoryLabel =
    row.category === "entrance"
      ? "Входные двери"
      : row.category === "interior"
        ? "Межкомнатные двери"
        : "Фурнитура";
  const series = row.collection ?? "Каталог Tandoor";
  const coatingGuess = () => {
    const t = row.title.toLowerCase();
    if (t.includes("эмаль") || t.includes("emal")) return "Эмаль";
    if (t.includes("шпон")) return "Шпон";
    if (t.includes("ламинат")) return "Ламинат";
    if (t.includes("пэт") || t.includes("pet")) return "ПЭТ";
    if (t.includes("мдф") || t.includes("mdf")) return "МДФ";
    if (row.category === "hardware") return "Фурнитура";
    return "По каталогу";
  };
  const shortDescription = cleanPublicDescription(row.shortDescription) ?? row.title;
  const boostTags: string[] = [];
  if (row.id === "tc-mk-benatti-2-belyy-zhemchug-dg-2000-800") boostTags.push("Zefir", "зефир");
  if (row.id === "tc-mk-benatti-1-0-belyy-zhemchug-dg-2100-800" || row.id === "tc-mk-benatti-1-0-belyy-zhemchug-dg-2000-800") {
    boostTags.push("Grand 13", "Гранд 13", "Medzhik", "меджик");
  }
  if (row.id === "tc-mk-m-36-emal-belaya-dg-2000-800") boostTags.push("Mona", "мона");
  const mergedTags = [...row.tags, ...boostTags];
  const catalogImages = (row.images ?? [{ src: row.imageSrc, alt: row.imageAlt }]).map((im) => ({
    src: im.src,
    alt: im.alt,
  }));
  const searchText = [row.searchText, ...boostTags, ...catalogImages.map((c) => c.alt)].join(" ").toLowerCase();
  const specs: { label: string; value: string }[] = [];
  if (typeof row.priceRetail === "number") {
    specs.push({ label: "Розничная цена, ₽", value: String(row.priceRetail) });
  }
  specs.push({ label: "Категория", value: categoryLabel });
  if (row.collection) specs.push({ label: "Коллекция / модель", value: row.collection });

  return {
    id: row.id,
    name: row.title,
    article: row.id.replace(/^tc-(?:vh|mk|hw)-/, "").slice(0, 28).toUpperCase(),
    category: categoryLabel,
    series,
    type: row.category === "hardware" ? "Артикул" : "Модель",
    doorKind,
    status: "В продаже",
    image: catalogImages[0]?.src ?? row.imageSrc,
    shortDescription,
    description: shortDescription,
    features: mergedTags,
    specs,
    equipment: row.category === "hardware" ? ["Комплект по спецификации витрины"] : ["Полотно", "Коробка", "Фурнитура по комплекту"],
    variants: [{ label: "Исполнение", value: "См. публичную карточку" }],
    colors: [],
    sizes: [],
    manufacturer: "Tandoor",
    warranty: "По условиям производителя",
    coating: coatingGuess(),
    openType: row.category === "hardware" ? "—" : "См. карточку",
    isTop: false,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 3,
    salesPriority: 5,
    recommendedForShowcase: false,
    relatedDealerIds: [],
    relatedTradePointIds: [],
    relatedTaskCount: 0,
    history: [],
    sourcePublicUrl: row.sourceUrl,
    priceRetailRub: row.priceRetail,
    catalogTags: mergedTags,
    catalogSearchText: searchText,
    includeInTradePointMatrix: false,
    catalogImages: catalogImages.length > 1 ? catalogImages : undefined,
  };
}

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

export const CATALOG_PRODUCTS: CatalogProduct[] = dedupeCatalogProductsById([
  ...TANDOOR_REAL_CATALOG_SEED.map(mapPublicSeedToCatalogProduct),
  ...MOCK_CATALOG_PRODUCTS,
]);

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
  return CATALOG_PRODUCTS.find((p) => p.id.toLowerCase() === t);
}

/** Поиск по каталогу для диалога брифа (Промт 105). */
export function searchCatalog(query: string, limit = 30): CatalogProduct[] {
  const sorted = [...CATALOG_PRODUCTS].sort((a, b) => a.showcasePriority - b.showcasePriority);
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
  return CATALOG_PRODUCTS.filter((p) => p.relatedDealerIds.includes(id));
}

export function getProductsForTradePoint(dealerId: string, pointId: string): CatalogProduct[] {
  const d = normalizeDealerIdForCatalog(dealerId);
  const normalizedPoint = pointId.includes("-") ? pointId.trim() : `${d}-${pointId.trim().padStart(2, "0")}`;
  return CATALOG_PRODUCTS.filter((p) => p.relatedTradePointIds.includes(normalizedPoint));
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
