import type { ClientCategoryId } from "@/lib/client-category";
import type { CatalogProduct } from "@/lib/catalog-product-type";
import type { ShowcaseSelectedPortalType, TradePointShowcaseSelectedModel } from "@/lib/client-base-actualization-state";
import type { ShowcaseMatrixModelDefinition } from "@/lib/trade-point-showcase-matrix-models";
import {
  resolveRequiredTradePointMatrixModels,
  type ResolveTradePointMatrixParams,
} from "@/lib/trade-point-matrix-resolver";

/** Обязательные позиции матрицы для торговой точки (high в активной managed-матрице). */
export function getRequiredShowcaseMatrixDefinitions(
  clientCategory: ClientCategoryId,
  scope: Omit<ResolveTradePointMatrixParams, "clientCategory">,
): ShowcaseMatrixModelDefinition[] {
  return resolveRequiredTradePointMatrixModels({ ...scope, clientCategory });
}

/**
 * Категория для расчёта матрицы: сначала бизнес-категория строки клиента;
 * если она «без категории», подставляем ТОП из паспорта актуализации (если заполнен).
 */
export function resolveShowcaseMatrixClientCategory(
  rowClientCategory: ClientCategoryId,
  dealerActualizationFields: Record<string, unknown>,
): ClientCategoryId | null {
  if (rowClientCategory !== "new_client") return rowClientCategory;
  const tierRaw = dealerActualizationFields.passportCategoryTier;
  const tier = typeof tierRaw === "string" ? tierRaw.trim() : "";
  const map: Record<string, ClientCategoryId> = {
    top150: "top150",
    top350: "top350",
    top500: "top500",
    other: "top500plus",
  };
  if (tier && tier !== "none" && map[tier]) return map[tier];
  return null;
}

export function inferShowcasePortalTypeFromCatalogProduct(p: CatalogProduct | undefined): ShowcaseSelectedPortalType {
  if (!p) return "other";
  if (p.doorKind === "Входная") return "entrance";
  if (p.doorKind === "Межкомнатная") return "interior";
  if (p.doorKind === "Фурнитура" || p.category?.includes("Фурнитур")) return "hardware";
  return "other";
}

export function effectivePortalTypeForSelectedModel(
  m: TradePointShowcaseSelectedModel,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): ShowcaseSelectedPortalType {
  if (m.portalType) return m.portalType;
  return inferShowcasePortalTypeFromCatalogProduct(catalogLookup(m.productId));
}

export type ShowcasePortalCaps = {
  entrance: number | null;
  interior: number | null;
  total: number | null;
  hardware: number | null;
};

export type ShowcasePortalOverfillDetail = {
  entranceOverfill: number;
  interiorOverfill: number;
  hardwareOverfill: number;
  totalOverfill: number;
  hasOverfill: boolean;
};

export function computeShowcasePortalOverfillDetail(
  selected: readonly TradePointShowcaseSelectedModel[],
  caps: ShowcasePortalCaps,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): ShowcasePortalOverfillDetail {
  let ent = 0;
  let int = 0;
  let hw = 0;
  for (const m of selected) {
    const t = effectivePortalTypeForSelectedModel(m, catalogLookup);
    if (t === "entrance") ent += 1;
    else if (t === "interior") int += 1;
    else if (t === "hardware") hw += 1;
  }
  const n = selected.length;
  const entranceOverfill = caps.entrance != null ? Math.max(0, ent - caps.entrance) : 0;
  const interiorOverfill = caps.interior != null ? Math.max(0, int - caps.interior) : 0;
  const hardwareOverfill = caps.hardware != null ? Math.max(0, hw - caps.hardware) : 0;
  const totalOverfill = caps.total != null ? Math.max(0, n - caps.total) : 0;
  const hasOverfill =
    entranceOverfill > 0 || interiorOverfill > 0 || hardwareOverfill > 0 || totalOverfill > 0;
  return { entranceOverfill, interiorOverfill, hardwareOverfill, totalOverfill, hasOverfill };
}

export function computeShowcasePortalOverfill(
  selected: readonly TradePointShowcaseSelectedModel[],
  caps: ShowcasePortalCaps,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): boolean {
  return computeShowcasePortalOverfillDetail(selected, caps, catalogLookup).hasOverfill;
}
