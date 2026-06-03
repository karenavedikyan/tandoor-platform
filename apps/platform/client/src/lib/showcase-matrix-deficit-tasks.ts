/**
 * Дефицит-задачи витрины из backend-матрицы (Промт 153).
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getProductById } from "@/lib/catalog-data";
import {
  fetchShowcaseMatrixScope,
  type ShowcaseMatrixEntryDto,
  type ShowcaseMatrixStatus,
} from "@/lib/showcase-matrix-api";
import { loadCachedMatrix } from "@/lib/showcase-matrix-store";
import { getShowcaseMatrixModelsForTradePoint } from "@/lib/trade-point-showcase-matrix-models";
import type {
  MatrixTaskPriority,
  MatrixTaskStatus,
  MatrixTaskWithContext,
} from "@/lib/trade-point-task-data";

const DEFICIT_STATUSES: ShowcaseMatrixStatus[] = ["need_install", "postponed"];

type DealerPointMaps = {
  pointToDealer: Map<string, DealerRow>;
  pointName: Map<string, string>;
  tradePointIds: string[];
};

function buildDealerPointMaps(dealers: DealerRow[]): DealerPointMaps {
  const pointToDealer = new Map<string, DealerRow>();
  const pointName = new Map<string, string>();
  const tradePointIds: string[] = [];

  for (const dealer of dealers) {
    for (const point of dealer.tradePoints) {
      if (point.status?.trim() === "Архив") continue;
      pointToDealer.set(point.id, dealer);
      pointName.set(point.id, point.name?.trim() || point.id);
      tradePointIds.push(point.id);
    }
  }

  return { pointToDealer, pointName, tradePointIds };
}

function formatDueDateFromIso(iso: string): string {
  const t = iso?.trim();
  if (!t) return "—";
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return "—";
  const dt = new Date(ms);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Имя позиции матрицы (model/variant) — единый резолв для задач и дерева дистрибуции. */
export function resolveShowcaseMatrixPositionForEntry(
  entry: ShowcaseMatrixEntryDto,
  dealer: DealerRow,
): { productId: string; productName: string; showcaseMatrixImageSrc?: string } {
  if (entry.targetKind === "model") {
    const models = getShowcaseMatrixModelsForTradePoint(
      dealer.id,
      entry.tradePointId,
      dealer.clientCategory,
    );
    const model = models.find((m) => m.id === entry.targetId);
    if (model) {
      return {
        productId: entry.targetId,
        productName: model.name,
        showcaseMatrixImageSrc: model.imageUrl,
      };
    }
    return { productId: entry.targetId, productName: entry.targetId };
  }

  const product = getProductById(entry.targetId);
  if (product) {
    return {
      productId: entry.targetId,
      productName: product.name,
      showcaseMatrixImageSrc: product.image?.trim() || undefined,
    };
  }
  return { productId: entry.targetId, productName: entry.targetId };
}

export function mapBackendEntriesToDeficitTasks(
  entries: ShowcaseMatrixEntryDto[],
  maps: DealerPointMaps,
): MatrixTaskWithContext[] {
  const out: MatrixTaskWithContext[] = [];

  for (const entry of entries) {
    if (entry.status !== "need_install" && entry.status !== "postponed") continue;

    const dealer = maps.pointToDealer.get(entry.tradePointId);
    if (!dealer) continue;

    const { productId, productName, showcaseMatrixImageSrc } = resolveShowcaseMatrixPositionForEntry(entry, dealer);
    const status: MatrixTaskStatus =
      entry.status === "postponed" ? "in_progress" : "new";
    const priority: MatrixTaskPriority = entry.status === "need_install" ? "high" : "medium";
    const description =
      entry.comment?.trim() ||
      "Позиция отмечена как «нужно выставить» в матрице витрины точки.";

    out.push({
      taskId: `smx-${entry.tradePointId}-${entry.targetKind}-${entry.targetId}`,
      productId,
      productName,
      productArticle: "ВИТРИНА",
      dealerId: dealer.id,
      tradePointId: entry.tradePointId,
      tradePointName: maps.pointName.get(entry.tradePointId) ?? entry.tradePointId,
      type: "add_to_showcase",
      title: `Поставить на витрину: ${productName}`,
      description,
      priority,
      status,
      assigneeRole: "manager",
      dueDate: formatDueDateFromIso(entry.updatedAt),
      source: "showcase_matrix_deficit",
      zone: "A",
      portal: "Стенд / зона",
      targetSamples: 1,
      actualSamples: 0,
      insightDomain: "showcase",
      insightLabel: "Матрица витрины (БД)",
      dealerName: dealer.name,
      showcaseExtraStatus: entry.status === "postponed" ? "postponed" : undefined,
      showcaseMatrixImageSrc,
    });
  }

  return out;
}

function collectCachedDeficitEntries(tradePointIds: string[]): ShowcaseMatrixEntryDto[] {
  const out: ShowcaseMatrixEntryDto[] = [];
  for (const tpId of tradePointIds) {
    for (const entry of loadCachedMatrix(tpId)) {
      if (entry.status === "need_install" || entry.status === "postponed") {
        out.push(entry);
      }
    }
  }
  return out;
}

/** Синхронно: только локальный backend-кэш (оффлайн / превью на карточке ТТ). */
export function getCachedShowcaseMatrixDeficitTasksForDealers(dealers: DealerRow[]): MatrixTaskWithContext[] {
  if (dealers.length === 0) return [];
  const maps = buildDealerPointMaps(dealers);
  if (maps.tradePointIds.length === 0) return [];
  const entries = collectCachedDeficitEntries(maps.tradePointIds);
  return mapBackendEntriesToDeficitTasks(entries, maps);
}

export async function fetchShowcaseMatrixDeficitTasksForDealers(
  dealers: DealerRow[],
): Promise<MatrixTaskWithContext[]> {
  if (dealers.length === 0) return [];
  const maps = buildDealerPointMaps(dealers);
  if (maps.tradePointIds.length === 0) return [];

  const entries = await fetchShowcaseMatrixScope({
    tradePointIds: maps.tradePointIds,
    statuses: DEFICIT_STATUSES,
  });
  if (entries == null) return [];

  return mapBackendEntriesToDeficitTasks(entries, maps);
}
