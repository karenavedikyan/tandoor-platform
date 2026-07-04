import type {
  TradePointShowcaseActualization,
  TradePointShowcaseSelectedModel,
} from "./client-base-actualization-state.js";
import type { CatalogProduct } from "./catalog-product-type.js";
import type { ShowcasePlacementSegment, ShowcasePlacementType } from "./showcase-matrix-api.js";
import {
  effectivePlacementTypeForSelectedModel,
  effectivePortalTypeForSelectedModel,
  inferShowcasePortalTypeFromCatalogProduct,
} from "./trade-point-showcase-matrix-required.js";

export type ShowcaseTypeKey = "entrance" | "interior" | "hardware";

export const SHOWCASE_TYPE_LABEL_RU: Record<ShowcaseTypeKey, string> = {
  entrance: "Входные двери (ВХ)",
  interior: "Межкомнатные (МК)",
  hardware: "Фурнитура",
};

export const SHOWCASE_TYPE_SHORT_RU: Record<ShowcaseTypeKey, string> = {
  entrance: "Входных",
  interior: "Межкомнатных",
  hardware: "Фурнитура",
};

export function isShowcaseTypeKey(t: string): t is ShowcaseTypeKey {
  return t === "entrance" || t === "interior" || t === "hardware";
}

/** Текущее заданное количество витрин/секций по типу. null = не заполнено. */
export function getShowcaseTypeCapacity(
  sh: TradePointShowcaseActualization | undefined,
  type: ShowcaseTypeKey,
): number | null {
  if (!sh) return null;
  if (type === "entrance") return sh.entrancePortals ?? null;
  if (type === "interior") return sh.interiorPortals ?? null;
  return sh.hardwareSections ?? null;
}

/** Типы, по которым ёмкость в actualization-state нужно поднять до числа отмеченных моделей. */
export function neededCapacityGrowthByType(
  sh: TradePointShowcaseActualization | undefined,
  markedByType: ReadonlyMap<ShowcaseTypeKey, number>,
): Array<{ type: ShowcaseTypeKey; oldCapacity: number; nextCapacity: number }> {
  const out: Array<{ type: ShowcaseTypeKey; oldCapacity: number; nextCapacity: number }> = [];
  for (const [type, marked] of Array.from(markedByType.entries())) {
    if (marked <= 0) continue;
    const current = getShowcaseTypeCapacity(sh, type);
    const currentNum = current == null ? 0 : current;
    if (marked <= currentNum) continue;
    out.push({ type, oldCapacity: currentNum, nextCapacity: marked });
  }
  return out;
}

/** Сколько моделей этого типа уже выбрано. */
export function countSelectedByType(
  selected: readonly TradePointShowcaseSelectedModel[],
  type: ShowcaseTypeKey,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): number {
  let n = 0;
  for (const m of selected) {
    const t = effectivePortalTypeForSelectedModel(m, catalogLookup);
    if (t === type) n += 1;
  }
  return n;
}

/** Сегмент размещения выбранной модели (vh/mk/hardware). */
export function segmentForSelectedModel(
  m: TradePointShowcaseSelectedModel,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): ShowcasePlacementSegment | null {
  if (m.placementSegment) return m.placementSegment;
  const portalType = effectivePortalTypeForSelectedModel(m, catalogLookup);
  if (portalType === "entrance") return "vh";
  if (portalType === "interior") return "mk";
  if (portalType === "hardware") return "hardware";
  return null;
}

/** Сколько моделей выбрано по конкретному типу крепления внутри сегмента. */
export function countSelectedByPlacement(
  selected: readonly TradePointShowcaseSelectedModel[],
  segment: ShowcasePlacementSegment,
  placementType: ShowcasePlacementType,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): number {
  let n = 0;
  for (const m of selected) {
    const modelSegment = segmentForSelectedModel(m, catalogLookup);
    if (modelSegment !== segment) continue;
    const pt = effectivePlacementTypeForSelectedModel(m, segment);
    if (pt === placementType) n += 1;
  }
  return n;
}

/**
 * Возвращает типы витрины, по которым выбраны модели (countSelectedByType > 0),
 * но ёмкость не заполнена (getShowcaseTypeCapacity == null).
 * Именно эти типы «теряются» в аналитике дистрибуции (знаменатель null).
 * Пустой массив = запись полна по ёмкости, гейт не нужен.
 */
export function findShowcaseCapacityGaps(
  sh: TradePointShowcaseActualization | undefined,
  selected: readonly TradePointShowcaseSelectedModel[],
  catalogLookup: (id: string) => CatalogProduct | undefined,
): ShowcaseTypeKey[] {
  const out: ShowcaseTypeKey[] = [];
  for (const type of ["entrance", "interior", "hardware"] as ShowcaseTypeKey[]) {
    if (
      countSelectedByType(selected, type, catalogLookup) > 0 &&
      getShowcaseTypeCapacity(sh, type) == null
    ) {
      out.push(type);
    }
  }
  return out;
}

/** Хелпер обновления capacity для типа (возвращает patch для TradePointShowcaseActualization). */
export function patchShowcaseTypeCapacity(
  type: ShowcaseTypeKey,
  value: number | null,
): Partial<TradePointShowcaseActualization> {
  if (type === "entrance") return { entrancePortals: value };
  if (type === "interior") return { interiorPortals: value };
  return { hardwareSections: value };
}

export type SelectionGateAction = "open-capacity-form" | "select" | "select-and-grow";

export type SelectionGateResult = {
  action: SelectionGateAction;
  type: ShowcaseTypeKey;
  nextCapacity?: number;
  oldCapacity?: number;
};

export function inferShowcaseTypeKeyFromProduct(p: CatalogProduct | undefined): ShowcaseTypeKey | null {
  const t = inferShowcasePortalTypeFromCatalogProduct(p);
  return isShowcaseTypeKey(t) ? t : null;
}

/** Решение гейта при попытке отметить модель на витрине. */
export function evaluateSelectionGate(
  sh: TradePointShowcaseActualization | undefined,
  selected: readonly TradePointShowcaseSelectedModel[],
  product: CatalogProduct,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): SelectionGateResult | null {
  const type = inferShowcaseTypeKeyFromProduct(product);
  if (!type) return null;

  const capacity = getShowcaseTypeCapacity(sh, type);
  if (capacity == null) {
    return { action: "open-capacity-form", type };
  }

  const nextCount = countSelectedByType(selected, type, catalogLookup) + 1;
  if (nextCount <= capacity) {
    return { action: "select", type };
  }

  return {
    action: "select-and-grow",
    type,
    nextCapacity: nextCount,
    oldCapacity: capacity,
  };
}

export function showcaseCapacityFieldTestId(type: ShowcaseTypeKey): string {
  if (type === "entrance") return "input-showcase-entrance-portals";
  if (type === "interior") return "input-showcase-interior-portals";
  return "input-showcase-hardware-sections";
}

export function focusShowcaseCapacityField(type: ShowcaseTypeKey): void {
  document
    .querySelector(`[data-testid="section-trade-point-showcase-portals"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[data-testid="${showcaseCapacityFieldTestId(type)}"]`);
    el?.focus();
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
