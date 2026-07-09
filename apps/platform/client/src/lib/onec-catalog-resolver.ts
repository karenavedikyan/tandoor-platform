/**
 * Клиент-резолвер позиций каталога 1С по UUID: batched fetch к /api/catalog/products?ids=.
 * Возвращает лёгкие карточки в формате CatalogProduct (минимально заполненные поля),
 * пригодные для отображения во вкладке "Матрица" fullscreen-entry.
 */

import type { CatalogProduct } from "./catalog-product-type.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCatalogUuid(id: string): boolean {
  return UUID_RE.test(id.trim());
}

type Catalog1cApiItem = {
  id: string;
  name: string;
  display_name: string | null;
  brand?: string | null;
  image_path: string | null;
  image_url: string | null;
};

type Catalog1cApiResponse = {
  success: boolean;
  items?: Catalog1cApiItem[];
};

/** Простая in-memory карта: uuid → CatalogProduct-обёртка. */
const cache = new Map<string, CatalogProduct>();
const inflight = new Map<string, Promise<void>>();

function apiItemToCatalogProduct(item: Catalog1cApiItem): CatalogProduct {
  const displayName = item.display_name?.trim() || item.name;
  const image = item.image_url ?? item.image_path ?? null;
  return {
    id: item.id,
    name: displayName,
    article: "",
    category: "",
    series: "",
    type: "",
    doorKind: "",
    status: "active",
    image,
    shortDescription: "",
    description: "",
    features: [],
    specs: [],
    equipment: [],
    variants: [],
    colors: [],
    sizes: [],
    manufacturer: item.brand ?? "",
    warranty: "",
    coating: "",
    openType: "",
    isTop: false,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 0,
    salesPriority: 0,
    recommendedForShowcase: false,
    relatedDealerIds: [],
    relatedTradePointIds: [],
    relatedTaskCount: 0,
    history: [],
    includeInTradePointMatrix: true,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchBatch(ids: string[]): Promise<void> {
  const url = new URL("/api/catalog/products", window.location.origin);
  url.searchParams.set("ids", ids.join(","));
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) return;
  const data = (await res.json()) as Catalog1cApiResponse;
  if (!data?.success || !Array.isArray(data.items)) return;
  for (const item of data.items) {
    cache.set(item.id, apiItemToCatalogProduct(item));
  }
}

/** Предзагрузка UUID-ов пачками по 100; уже закешированные и не-UUID пропускаются. */
export async function preloadOneCCatalogByIds(ids: readonly string[]): Promise<void> {
  const missing: string[] = [];
  for (const id of ids) {
    if (!isCatalogUuid(id)) continue;
    if (cache.has(id)) continue;
    if (inflight.has(id)) continue;
    missing.push(id);
  }
  if (missing.length === 0) return;

  const batches = chunk(missing, 100);
  const promises: Promise<void>[] = [];
  for (const batch of batches) {
    const p = fetchBatch(batch).finally(() => {
      for (const id of batch) inflight.delete(id);
    });
    for (const id of batch) inflight.set(id, p);
    promises.push(p);
  }
  await Promise.allSettled(promises);
}

export function getOneCCatalogProductFromCache(id: string): CatalogProduct | null {
  return cache.get(id) ?? null;
}
