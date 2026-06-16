/**
 * View-model разреза «Ввод → по продукту»: модели матрицы и статус ТТ для выбранной модели.
 */

import type { CatalogListProduct } from "@/components/catalog/ProductListRow";
import type { ClientCategoryId } from "@/lib/client-category";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { getMergedDealerTradePoints } from "@/lib/dealer-trade-points-overrides";
import type { DistributionSegmentFilter } from "@/lib/distribution-filters";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import { resolveTradePointMatrixModels } from "@/lib/trade-point-matrix-resolver";
import {
  type ShowcaseMatrixModelDefinition,
} from "@/lib/trade-point-showcase-matrix-models";

export type EntryProductTpPresence = "installed" | "recommended" | "not_in_plan";

export type EntryProductModelRow = {
  modelId: string;
  name: string;
  typeLabelRu: ShowcaseMatrixModelDefinition["typeLabelRu"];
  segment: "vh" | "mk";
};

export type EntryProductTradePointRow = {
  dealerId: string;
  tradePointId: string;
  tradePointName: string;
  clientName: string;
  city: string | null;
  presence: EntryProductTpPresence;
};

export function modelSegment(model: ShowcaseMatrixModelDefinition): "vh" | "mk" {
  return model.type === "entrance" ? "vh" : "mk";
}

export function modelMatchesSegment(
  model: ShowcaseMatrixModelDefinition,
  segment: DistributionSegmentFilter,
): boolean {
  if (segment === "all") return true;
  if (segment === "furniture") return false;
  if (segment === "vh") return model.type === "entrance";
  if (segment === "mk") return model.type === "interior";
  return true;
}

export function isModelRecommendedForCategory(
  model: ShowcaseMatrixModelDefinition,
  clientCategory: ClientCategoryId,
): boolean {
  return model.categoryRules.includes(clientCategory);
}

export function isModelInstalledInEntries(
  entries: readonly ShowcaseMatrixEntryDto[],
  modelId: string,
): boolean {
  return entries.some(
    (e) =>
      (e.targetKind === "model" || e.targetKind === "variant") &&
      e.targetId === modelId &&
      e.status === "installed",
  );
}

export function isModelInTradePointTemplate(
  dealer: DealerRow,
  point: DealerTradePoint,
  modelId: string,
): boolean {
  return resolveTradePointMatrixModels({
    dealerId: dealer.id,
    tradePointId: point.id,
    clientCategory: dealer.clientCategory,
    region: dealer.region,
    city: point.city,
  }).some((m) => m.id === modelId);
}

/** Статус модели в конкретной ТТ для списка «по продукту». */
export function resolveEntryProductTpPresence(
  model: ShowcaseMatrixModelDefinition,
  dealer: DealerRow,
  point: DealerTradePoint,
  entries: readonly ShowcaseMatrixEntryDto[],
): EntryProductTpPresence {
  if (isModelInstalledInEntries(entries, model.id)) return "installed";
  const inTemplate = isModelInTradePointTemplate(dealer, point, model.id);
  if (inTemplate && isModelRecommendedForCategory(model, dealer.clientCategory)) {
    return "recommended";
  }
  if (inTemplate) return "recommended";
  return "not_in_plan";
}

export function collectEntryCatalogModels(
  dealers: readonly DealerRow[],
): ShowcaseMatrixModelDefinition[] {
  const byId = new Map<string, ShowcaseMatrixModelDefinition>();
  for (const dealer of dealers) {
    for (const { point } of getMergedDealerTradePoints(dealer, { includeArchived: false })) {
      if (point.status?.trim() === "Архив") continue;
      const models = resolveTradePointMatrixModels({
        dealerId: dealer.id,
        tradePointId: point.id,
        clientCategory: dealer.clientCategory,
        region: dealer.region,
        city: point.city,
      });
      for (const m of models) {
        if (!byId.has(m.id)) byId.set(m.id, m);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function buildEntryProductModelRows(
  dealers: readonly DealerRow[],
  segment: DistributionSegmentFilter,
  query?: string,
): EntryProductModelRow[] {
  const q = query?.trim().toLowerCase() ?? "";
  return collectEntryCatalogModels(dealers)
    .filter((m) => modelMatchesSegment(m, segment))
    .filter((m) => !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
    .map((m) => ({
      modelId: m.id,
      name: m.name,
      typeLabelRu: m.typeLabelRu,
      segment: modelSegment(m),
    }));
}

export function buildEntryProductTradePointRows(
  dealers: readonly DealerRow[],
  model: ShowcaseMatrixModelDefinition,
  query?: string,
  loadEntries?: (tradePointId: string) => readonly ShowcaseMatrixEntryDto[],
): EntryProductTradePointRow[] {
  const readEntries = loadEntries ?? (() => [] as ShowcaseMatrixEntryDto[]);
  const q = query?.trim().toLowerCase() ?? "";
  const rows: EntryProductTradePointRow[] = [];

  for (const dealer of dealers) {
    const clientName = dealer.name?.trim() || dealer.id;
    for (const { point } of getMergedDealerTradePoints(dealer, { includeArchived: false })) {
      if (point.status?.trim() === "Архив") continue;
      const presence = resolveEntryProductTpPresence(model, dealer, point, readEntries(point.id));
      if (presence === "not_in_plan") continue;

      const tradePointName = point.name?.trim() || point.id;
      const city = point.city?.trim() || dealer.city?.trim() || null;
      const haystack = `${tradePointName} ${clientName} ${city ?? ""}`.toLowerCase();
      if (q && !haystack.includes(q)) continue;

      rows.push({
        dealerId: dealer.id,
        tradePointId: point.id,
        tradePointName,
        clientName,
        city: city && city !== "—" ? city : null,
        presence,
      });
    }
  }

  const order: Record<EntryProductTpPresence, number> = {
    installed: 0,
    recommended: 1,
    not_in_plan: 2,
  };
  return rows.sort(
    (a, b) =>
      order[a.presence] - order[b.presence] ||
      a.tradePointName.localeCompare(b.tradePointName, "ru"),
  );
}

export function entryProductPresenceLabelRu(presence: EntryProductTpPresence): string {
  switch (presence) {
    case "installed":
      return "Стоит";
    case "recommended":
      return "Рекомендовано";
    case "not_in_plan":
      return "Нет в плане";
    default:
      return presence;
  }
}

/** Матричная модель витрины → карточка каталога (без API). */
export function matrixModelToCatalogListProduct(
  model: ShowcaseMatrixModelDefinition,
): CatalogListProduct {
  return {
    id: model.id,
    name: model.name,
    display_name: model.name,
    brand: model.typeLabelRu,
    image_url: model.imageUrl?.trim() || null,
    total_stock: null,
    price_retail: null,
    price_retail_sale: null,
    is_new: false,
    is_hit: false,
    is_sale: false,
    variant_count: 0,
  };
}

export function entryProductModelsToCatalogProducts(
  dealers: readonly DealerRow[],
  segment: DistributionSegmentFilter,
  query?: string,
): CatalogListProduct[] {
  const q = query?.trim().toLowerCase() ?? "";
  return collectEntryCatalogModels(dealers)
    .filter((m) => modelMatchesSegment(m, segment))
    .filter((m) => !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
    .map(matrixModelToCatalogListProduct);
}
