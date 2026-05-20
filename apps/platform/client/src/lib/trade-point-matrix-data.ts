import type { CatalogProduct } from "./catalog-product-type";
import { MOCK_CATALOG_PRODUCTS } from "./catalog-mock-products";
import { normalizeDealerIdForCatalog } from "./catalog-dealer-id";
import { isManualActualizationTradePointId } from "@/lib/client-base-actualization-stable-ids";

export type ShowcaseZone = "A" | "B" | "C";

export type ShowcasePortal =
  | "Портал входных дверей"
  | "Портал межкомнатных дверей"
  | "Стенд / зона"
  | "Отдельная выкладка";

export type DoorCategory = "Входная" | "Межкомнатная" | "Скрытая / нестандартная";

export type MatrixPresenceStatus =
  | "есть на витрине"
  | "нет на витрине"
  | "нужно добавить"
  | "на проверке";

export type MatrixActionKind =
  | "Добавить"
  | "Проверить"
  | "Обновить фото"
  | "Согласовать замену"
  | "Поддерживать";

export type TradePointProductMatrixItem = {
  productId: string;
  productName: string;
  productArticle: string;
  doorCategory: DoorCategory;
  portal: ShowcasePortal;
  zone: ShowcaseZone;
  presence: MatrixPresenceStatus;
  targetSamples: number;
  actualSamples: number;
  priority: "Высокий" | "Средний" | "Низкий";
  action: MatrixActionKind;
  lastCheckedAt: string;
};

export type TradePointMatrixSummary = {
  totalRequired: number;
  totalPresent: number;
  totalMissing: number;
  totalUnderReview: number;
  zoneA: number;
  zoneB: number;
  zoneC: number;
  entrancePresent: number;
  entranceRequired: number;
  interiorPresent: number;
  interiorRequired: number;
};

export type MatrixFilterId =
  | "all"
  | "present"
  | "missing"
  | "zone-a"
  | "entrance"
  | "interior";

function doorCategoryFromProduct(p: CatalogProduct): DoorCategory {
  if (p.doorKind === "Входная") return "Входная";
  if (p.doorKind === "Межкомнатная") return "Межкомнатная";
  return "Скрытая / нестандартная";
}

function portalFromProduct(p: CatalogProduct): ShowcasePortal {
  if (p.doorKind === "Входная") return "Портал входных дверей";
  if (p.doorKind === "Межкомнатная") return "Портал межкомнатных дверей";
  if (p.doorKind === "Скрытая") return "Отдельная выкладка";
  return "Стенд / зона";
}

function zoneFromProduct(p: CatalogProduct): ShowcaseZone {
  if (p.showcasePriority >= 9) return "A";
  if (p.showcasePriority >= 6) return "B";
  return "C";
}

function priorityFromProduct(p: CatalogProduct): "Высокий" | "Средний" | "Низкий" {
  if (p.showcasePriority >= 9) return "Высокий";
  if (p.showcasePriority >= 6) return "Средний";
  return "Низкий";
}

function targetSamplesFor(p: CatalogProduct): number {
  if (p.showcasePriority >= 9) return 2;
  return 1;
}

function lastCheckedDate(dealerSeed: number, pointSeed: number, idx: number): string {
  const day = ((dealerSeed * 3 + pointSeed * 2 + idx * 5) % 27) + 1;
  const month = ((dealerSeed + pointSeed + idx) % 4) + 1;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.2026`;
}

function presenceFromProduct(
  p: CatalogProduct,
  isOnShowcase: boolean,
  variant: number,
): MatrixPresenceStatus {
  if (isOnShowcase) {
    if (variant === 0) return "есть на витрине";
    if (variant === 1) return "на проверке";
    return "есть на витрине";
  }
  if (!p.inStock) return "на проверке";
  if (p.recommendedForShowcase) return "нужно добавить";
  return "нет на витрине";
}

function actionFor(presence: MatrixPresenceStatus, taskCount: number): MatrixActionKind {
  if (presence === "нужно добавить") return "Добавить";
  if (presence === "на проверке") return "Согласовать замену";
  if (presence === "нет на витрине") return "Добавить";
  if (taskCount >= 2) return "Обновить фото";
  if (taskCount >= 1) return "Проверить";
  return "Поддерживать";
}

function actualSamplesFor(target: number, presence: MatrixPresenceStatus): number {
  if (presence === "есть на витрине") return target;
  if (presence === "на проверке") return Math.max(0, target - 1);
  return 0;
}

function buildSeed(dealerId: string, pointId: string): { dealerSeed: number; pointSeed: number } {
  const d = parseInt(dealerId, 10) || 1;
  const tail = pointId.split("-").pop() ?? "0";
  const t = parseInt(tail, 10) || 1;
  return { dealerSeed: d, pointSeed: t };
}

function shouldIncludeInMatrix(
  product: CatalogProduct,
  normalizedPointId: string,
  dealerSeed: number,
  pointSeed: number,
  index: number,
): boolean {
  if (product.relatedTradePointIds.includes(normalizedPointId)) return true;
  if (!product.recommendedForShowcase && product.showcasePriority < 6) {
    return (dealerSeed + pointSeed + index) % 5 === 0;
  }
  if (product.showcasePriority >= 8) return true;
  return (dealerSeed + pointSeed * 3 + index * 2) % 3 !== 0;
}

export function getTradePointMatrix(
  dealerId: string,
  pointId: string,
): TradePointProductMatrixItem[] {
  if (isManualActualizationTradePointId(pointId)) return [];
  const d = normalizeDealerIdForCatalog(dealerId);
  const normalizedPoint = pointId.includes("-")
    ? pointId.trim()
    : `${d}-${pointId.trim().padStart(2, "0")}`;
  const { dealerSeed, pointSeed } = buildSeed(d, normalizedPoint);

  const items: TradePointProductMatrixItem[] = [];

  MOCK_CATALOG_PRODUCTS.forEach((p, idx) => {
    if (p.includeInTradePointMatrix === false) return;
    if (!shouldIncludeInMatrix(p, normalizedPoint, dealerSeed, pointSeed, idx)) return;

    const isOnShowcase = p.relatedTradePointIds.includes(normalizedPoint);
    const variant = (dealerSeed + pointSeed + idx) % 3;
    const presence = presenceFromProduct(p, isOnShowcase, variant);
    const target = targetSamplesFor(p);
    const actual = actualSamplesFor(target, presence);
    const action = actionFor(presence, p.relatedTaskCount);

    items.push({
      productId: p.id,
      productName: p.name,
      productArticle: p.article,
      doorCategory: doorCategoryFromProduct(p),
      portal: portalFromProduct(p),
      zone: zoneFromProduct(p),
      presence,
      targetSamples: target,
      actualSamples: actual,
      priority: priorityFromProduct(p),
      action,
      lastCheckedAt: lastCheckedDate(dealerSeed, pointSeed, idx),
    });
  });

  items.sort((a, b) => {
    const zoneOrder = { A: 0, B: 1, C: 2 } as const;
    const zoneDiff = zoneOrder[a.zone] - zoneOrder[b.zone];
    if (zoneDiff !== 0) return zoneDiff;
    const presenceOrder: Record<MatrixPresenceStatus, number> = {
      "нужно добавить": 0,
      "на проверке": 1,
      "нет на витрине": 2,
      "есть на витрине": 3,
    };
    return presenceOrder[a.presence] - presenceOrder[b.presence];
  });

  return items;
}

export function summarizeMatrix(items: TradePointProductMatrixItem[]): TradePointMatrixSummary {
  let totalPresent = 0;
  let totalMissing = 0;
  let totalUnderReview = 0;
  let zoneA = 0;
  let zoneB = 0;
  let zoneC = 0;
  let entrancePresent = 0;
  let entranceRequired = 0;
  let interiorPresent = 0;
  let interiorRequired = 0;

  for (const item of items) {
    if (item.presence === "есть на витрине") totalPresent += 1;
    else if (item.presence === "на проверке") totalUnderReview += 1;
    else totalMissing += 1;

    if (item.zone === "A") zoneA += 1;
    else if (item.zone === "B") zoneB += 1;
    else zoneC += 1;

    if (item.doorCategory === "Входная") {
      entranceRequired += 1;
      if (item.presence === "есть на витрине") entrancePresent += 1;
    } else if (item.doorCategory === "Межкомнатная") {
      interiorRequired += 1;
      if (item.presence === "есть на витрине") interiorPresent += 1;
    }
  }

  return {
    totalRequired: items.length,
    totalPresent,
    totalMissing,
    totalUnderReview,
    zoneA,
    zoneB,
    zoneC,
    entrancePresent,
    entranceRequired,
    interiorPresent,
    interiorRequired,
  };
}

export function filterMatrix(
  items: TradePointProductMatrixItem[],
  filter: MatrixFilterId,
): TradePointProductMatrixItem[] {
  switch (filter) {
    case "present":
      return items.filter((i) => i.presence === "есть на витрине");
    case "missing":
      return items.filter(
        (i) => i.presence === "нет на витрине" || i.presence === "нужно добавить",
      );
    case "zone-a":
      return items.filter((i) => i.zone === "A");
    case "entrance":
      return items.filter((i) => i.doorCategory === "Входная");
    case "interior":
      return items.filter((i) => i.doorCategory === "Межкомнатная");
    case "all":
    default:
      return items;
  }
}

export type TradePointMatrixPresence = {
  dealerId: string;
  pointId: string;
  presence: MatrixPresenceStatus;
  zone: ShowcaseZone;
};

/**
 * Где (по матрицам каких ТТ) встречается товар. Используется в карточке товара,
 * чтобы показать связь с торговыми точками через матрицу.
 */
export function getMatrixPresencesForProduct(productId: string): TradePointMatrixPresence[] {
  const product = MOCK_CATALOG_PRODUCTS.find((p) => p.id === productId);
  if (!product) return [];
  const result: TradePointMatrixPresence[] = [];
  for (const tpId of product.relatedTradePointIds) {
    const dealerId = tpId.split("-")[0] ?? "";
    if (!dealerId) continue;
    const matrix = getTradePointMatrix(dealerId, tpId);
    const item = matrix.find((m) => m.productId === productId);
    if (!item) continue;
    result.push({ dealerId, pointId: tpId, presence: item.presence, zone: item.zone });
  }
  return result;
}
