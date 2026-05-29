import type { ClientCategoryId } from "@/lib/client-category";
import type { CatalogProduct } from "@/lib/catalog-product-type";
import type { ShowcaseSelectedPortalType, TradePointShowcaseSelectedModel } from "@/lib/client-base-actualization-state";
import {
  SHOWCASE_MATRIX_MODEL_DEFINITIONS,
  type ShowcaseMatrixModelDefinition,
} from "@/lib/trade-point-showcase-matrix-models";

/** Обязательные позиции матрицы для бизнес-категории клиента (по правилам categoryRules). */
export function getRequiredShowcaseMatrixDefinitions(clientCategory: ClientCategoryId): ShowcaseMatrixModelDefinition[] {
  return SHOWCASE_MATRIX_MODEL_DEFINITIONS.filter((m) => m.categoryRules.includes(clientCategory));
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
};

export function computeShowcasePortalOverfill(
  selected: readonly TradePointShowcaseSelectedModel[],
  caps: ShowcasePortalCaps,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): boolean {
  let ent = 0;
  let int = 0;
  for (const m of selected) {
    const t = effectivePortalTypeForSelectedModel(m, catalogLookup);
    if (t === "entrance") ent += 1;
    else if (t === "interior") int += 1;
  }
  const n = selected.length;
  if (caps.entrance != null && ent > caps.entrance) return true;
  if (caps.interior != null && int > caps.interior) return true;
  if (caps.total != null && n > caps.total) return true;
  return false;
}
