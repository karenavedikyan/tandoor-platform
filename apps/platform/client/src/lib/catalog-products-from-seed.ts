/**
 * Единственный модуль со статическим импортом публичного seed-каталога.
 * Подключается из catalog-data через dynamic import(), чтобы вынести chunk catalog-real-seed.
 */

import {
  TANDOOR_REAL_CATALOG_SEED,
  type TandoorRealCatalogSeedItem,
} from "./tandoor-real-catalog-seed.generated";
import type { CatalogProduct } from "./catalog-product-type";

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

/** Позиции публичного каталога без mock-продуктов и dedupe. */
export function buildCatalogProductsFromSeed(): CatalogProduct[] {
  return TANDOOR_REAL_CATALOG_SEED.map(mapPublicSeedToCatalogProduct);
}
