import type { ShowcasePlacementSegment, ShowcasePlacementType } from "@/lib/showcase-matrix-api";
import type { ShowcaseMatrixStatusId } from "@/lib/trade-point-showcase-matrix-storage";

export type FullscreenEntryBaseline = {
  status: ShowcaseMatrixStatusId;
  placementType: ShowcasePlacementType | null;
  placementSegment: ShowcasePlacementSegment | null;
  comment: string;
};

export type FullscreenEntryDraftRow = {
  installed: boolean;
  placementType: ShowcasePlacementType;
  placementSegment: ShowcasePlacementSegment;
};

export type FullscreenEntryDraftMap = Record<string, FullscreenEntryDraftRow>;

export function isInstalledMatrixStatus(status: ShowcaseMatrixStatusId): boolean {
  return status === "installed";
}

/** Галочка «стоит» ↔ статус installed. */
export function installedFromMatrixStatus(status: ShowcaseMatrixStatusId): boolean {
  return isInstalledMatrixStatus(status);
}

/** Статус после снятия/установки галочки с учётом прежнего статуса матрицы. */
export function matrixStatusFromInstalled(
  installed: boolean,
  baselineStatus: ShowcaseMatrixStatusId,
): ShowcaseMatrixStatusId {
  if (installed) return "installed";
  if (baselineStatus === "installed") return "need_install";
  return baselineStatus;
}

export function buildInitialDraftRow(
  baseline: FullscreenEntryBaseline,
  defaultPlacementType: ShowcasePlacementType = "portal",
): FullscreenEntryDraftRow {
  return {
    installed: installedFromMatrixStatus(baseline.status),
    placementType: baseline.placementType ?? defaultPlacementType,
    placementSegment: baseline.placementSegment ?? "vh",
  };
}

export function draftRowEqualsBaseline(
  draft: FullscreenEntryDraftRow,
  baseline: FullscreenEntryBaseline,
): boolean {
  const targetStatus = matrixStatusFromInstalled(draft.installed, baseline.status);
  if (targetStatus !== baseline.status) return false;
  if (!draft.installed) return true;
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
    if (!baseline) continue;
    if (!draftRowEqualsBaseline(row, baseline)) changed.push(productId);
  }
  return changed;
}

export function countInstalledInDraft(draft: FullscreenEntryDraftMap): number {
  return Object.values(draft).filter((r) => r.installed).length;
}
