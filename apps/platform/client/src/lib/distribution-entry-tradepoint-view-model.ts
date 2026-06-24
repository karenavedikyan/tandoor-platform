/**
 * View-model списка ТТ для быстрого ввода факта в разделе «Дистрибуция».
 */

import type { ClientCategoryId } from "./client-category.js";
import type { DealerRow, DealerTradePoint } from "./dealer-base-mock-data.js";
import { getDealerManagerDisplay } from "./dealer-base-mock-data.js";
import { getMergedDealerTradePoints, type DealerTradePointsState } from "./dealer-trade-points-overrides.js";
import type { ShowcaseMatrixEntryDto } from "./showcase-matrix-api.js";
import { loadCachedMatrix } from "./showcase-matrix-store.js";
import { countInstalledOursBySegment } from "./trade-point-showcase-segment-models.js";
import { resolveTradePointMatrixModels } from "./trade-point-matrix-resolver.js";

export type DistributionEntryInstalledOursBySegment = {
  vh: number;
  mk: number;
  hardware: number;
};

export type DistributionEntryTradePointRow = {
  dealerId: string;
  tradePointId: string;
  tradePointName: string;
  clientName: string;
  city: string | null;
  clientCategory: ClientCategoryId;
  managerName: string | null;
  templateModelsCount: number;
  filledCount: number;
  coveragePct: number;
  lastUpdatedAt: string | null;
  installedOursTotal: number;
  installedOursBySegment: DistributionEntryInstalledOursBySegment;
};

export type BuildDistributionEntryTradePointRowsParams = {
  dealers: readonly DealerRow[];
  query?: string;
  loadCachedMatrixFn?: (tradePointId: string) => readonly ShowcaseMatrixEntryDto[];
  resolveTemplateModelIds?: (dealer: DealerRow, point: DealerTradePoint) => readonly string[];
};

function normalizeCity(city: string | undefined): string | null {
  const c = city?.trim();
  if (!c || c === "—" || c === "-") return null;
  return c;
}

function defaultResolveTemplateModelIds(dealer: DealerRow, point: DealerTradePoint): string[] {
  return resolveTradePointMatrixModels({
    dealerId: dealer.id,
    tradePointId: point.id,
    clientCategory: dealer.clientCategory,
    region: dealer.region,
    city: point.city,
  }).map((m) => m.id);
}

function countFilledForTemplate(
  templateIds: readonly string[],
  entries: readonly ShowcaseMatrixEntryDto[],
): number {
  if (templateIds.length === 0) return 0;
  const templateSet = new Set(templateIds);
  const filled = new Set<string>();
  for (const entry of entries) {
    if (entry.targetKind !== "model" && entry.targetKind !== "variant") continue;
    if (!templateSet.has(entry.targetId)) continue;
    filled.add(entry.targetId);
  }
  return filled.size;
}

function maxUpdatedAt(entries: readonly ShowcaseMatrixEntryDto[]): string | null {
  let max: string | null = null;
  for (const e of entries) {
    const t = e.updatedAt?.trim();
    if (!t) continue;
    if (!max || t > max) max = t;
  }
  return max;
}

function rowHaystack(row: DistributionEntryTradePointRow): string {
  return `${row.tradePointName} ${row.clientName} ${row.city ?? ""}`.toLowerCase();
}

function compareRows(a: DistributionEntryTradePointRow, b: DistributionEntryTradePointRow): number {
  if (a.coveragePct !== b.coveragePct) return a.coveragePct - b.coveragePct;
  const aTime = a.lastUpdatedAt ? Date.parse(a.lastUpdatedAt) : 0;
  const bTime = b.lastUpdatedAt ? Date.parse(b.lastUpdatedAt) : 0;
  if (aTime !== bTime) return aTime - bTime;
  return a.tradePointName.localeCompare(b.tradePointName, "ru");
}

/** Уникальные tradePointId скоупа — тот же набор, что в buildDistributionEntryTradePointRows. */
export function collectScopedTradePointIds(
  dealers: readonly DealerRow[],
  tradePointsState?: DealerTradePointsState,
): string[] {
  const ids = new Set<string>();
  for (const dealer of dealers) {
    for (const { point } of getMergedDealerTradePoints(dealer, { includeArchived: false }, tradePointsState)) {
      if (point.status?.trim() === "Архив") continue;
      ids.add(point.id);
    }
  }
  return Array.from(ids);
}

export function scopedTradePointIdsStableKey(ids: readonly string[]): string {
  if (ids.length === 0) return "";
  return [...ids].sort().join(",");
}

export function buildDistributionEntryTradePointRows(
  params: BuildDistributionEntryTradePointRowsParams,
): DistributionEntryTradePointRow[] {
  const readCache = params.loadCachedMatrixFn ?? loadCachedMatrix;
  const resolveTemplate = params.resolveTemplateModelIds ?? defaultResolveTemplateModelIds;
  const q = params.query?.trim().toLowerCase() ?? "";

  const rows: DistributionEntryTradePointRow[] = [];

  for (const dealer of params.dealers) {
    const clientName = dealer.name?.trim() || dealer.id;
    const managerRaw = getDealerManagerDisplay(dealer).trim();
    const managerName = managerRaw && managerRaw !== "—" ? managerRaw : null;

    for (const { point } of getMergedDealerTradePoints(dealer, { includeArchived: false })) {
      if (point.status?.trim() === "Архив") continue;

      const templateIds = resolveTemplate(dealer, point);
      const entries = readCache(point.id);
      const filledCount = countFilledForTemplate(templateIds, entries);
      const templateModelsCount = templateIds.length;
      const coveragePct =
        templateModelsCount > 0 ? Math.round((filledCount / templateModelsCount) * 100) : 0;
      const installedOursBySegment = countInstalledOursBySegment(entries);
      const installedOursTotal =
        installedOursBySegment.vh + installedOursBySegment.mk + installedOursBySegment.hardware;

      rows.push({
        dealerId: dealer.id,
        tradePointId: point.id,
        tradePointName: point.name?.trim() || point.id,
        clientName,
        city: normalizeCity(point.city?.trim() || dealer.city),
        clientCategory: dealer.clientCategory,
        managerName,
        templateModelsCount,
        filledCount,
        coveragePct,
        lastUpdatedAt: maxUpdatedAt(entries),
        installedOursTotal,
        installedOursBySegment,
      });
    }
  }

  const filtered = q ? rows.filter((row) => rowHaystack(row).includes(q)) : rows;
  return filtered.sort(compareRows);
}

export function findDealerTradePointForEntryRow(
  dealers: readonly DealerRow[],
  row: DistributionEntryTradePointRow,
): { dealer: DealerRow; point: DealerTradePoint } | null {
  const dealer = dealers.find((d) => d.id === row.dealerId);
  if (!dealer) return null;
  const point = dealer.tradePoints.find((p) => p.id === row.tradePointId);
  if (!point) {
    for (const { point: merged } of getMergedDealerTradePoints(dealer, { includeArchived: false })) {
      if (merged.id === row.tradePointId) return { dealer, point: merged };
    }
    return null;
  }
  return { dealer, point };
}
