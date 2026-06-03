/**
 * View-model списка ТТ для быстрого ввода факта в разделе «Дистрибуция».
 */

import type { ClientCategoryId } from "@/lib/client-category";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { getDealerManagerDisplay } from "@/lib/dealer-base-mock-data";
import { getMergedDealerTradePoints } from "@/lib/dealer-trade-points-overrides";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import { loadCachedMatrix } from "@/lib/showcase-matrix-store";
import { getShowcaseMatrixModelsForTradePoint } from "@/lib/trade-point-showcase-matrix-models";

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
  return getShowcaseMatrixModelsForTradePoint(dealer.id, point.id, dealer.clientCategory).map((m) => m.id);
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
