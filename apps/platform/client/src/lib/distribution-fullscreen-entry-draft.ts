import type { ShowcasePlacementSegment, ShowcasePlacementType } from "./showcase-matrix-api.js";
import type { ShowcaseMatrixStatusId } from "./trade-point-showcase-matrix-storage.js";

export type FullscreenEntryBaseline = {
  status: ShowcaseMatrixStatusId;
  placementType: ShowcasePlacementType | null;
  placementSegment: ShowcasePlacementSegment | null;
  comment: string;
};

export type FullscreenEntryDraftRow = {
  status: ShowcaseMatrixStatusId;
  placementType: ShowcasePlacementType;
  placementSegment: ShowcasePlacementSegment;
};

export type FullscreenEntryDraftMap = Record<string, FullscreenEntryDraftRow>;

export function isInstalledMatrixStatus(status: ShowcaseMatrixStatusId): boolean {
  return status === "installed";
}

export function buildInitialDraftRow(
  baseline: FullscreenEntryBaseline,
  defaultPlacementType: ShowcasePlacementType = "portal",
): FullscreenEntryDraftRow {
  return {
    status: baseline.status,
    placementType: baseline.placementType ?? defaultPlacementType,
    placementSegment: baseline.placementSegment ?? "vh",
  };
}

export function draftRowEqualsBaseline(
  draft: FullscreenEntryDraftRow,
  baseline: FullscreenEntryBaseline,
): boolean {
  if (draft.status !== baseline.status) return false;
  if (draft.status !== "installed") return true;
  if ((baseline.placementType ?? "portal") !== draft.placementType) return false;
  if ((baseline.placementSegment ?? draft.placementSegment) !== draft.placementSegment) return false;
  return true;
}

/** Идентификаторы моделей, у которых черновик отличается от базовой линии. */
export function collectChangedProductIds(
  draft: FullscreenEntryDraftMap,
  baselines: Record<string, FullscreenEntryBaseline>,
): string[] {
  const changed: string[] = [];
  for (const [productId, row] of Object.entries(draft)) {
    const baseline = baselines[productId];
    if (!baseline) {
      // Модель, которой нет в матрице ТТ (например, добавлена из «Весь каталог»).
      // Считаем изменением всё, что отклонилось от дефолта need_install.
      if (row.status !== "need_install") changed.push(productId);
      continue;
    }
    if (!draftRowEqualsBaseline(row, baseline)) changed.push(productId);
  }
  return changed;
}

export function countInstalledInDraft(draft: FullscreenEntryDraftMap): number {
  return Object.values(draft).filter((r) => r.status === "installed").length;
}
