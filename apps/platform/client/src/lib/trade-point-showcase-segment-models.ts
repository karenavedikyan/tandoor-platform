import type {
  ShowcaseMatrixEntryDto,
  ShowcasePlacementSegment,
  ShowcasePlacementType,
} from "./showcase-matrix-api.js";
import { getProductById } from "./catalog-data.js";
import { LEGACY_FALLBACK_TYPE_BY_SEGMENT } from "./showcase-capacity-by-equipment.js";
import { segmentForModelTargetId } from "./showcase-model-segment.js";
import {
  SHOWCASE_MATRIX_MODEL_DEFINITIONS,
  type ShowcaseMatrixModelDefinition,
} from "./trade-point-showcase-matrix-models.js";

export type SegmentOurModelCard = {
  modelId: string;
  name: string;
  series: string | null;
  imageUrl: string | null;
  count: number;
};

export type SegmentCompetitorRow = {
  brand: string;
  count: number;
};

export type SegmentPlacementTypeBreakdownRow = {
  placementType: ShowcasePlacementType;
  blockCount: number;
  capacity: number;
  ours: number;
  legacyOurs: number;
  competitors: number;
  free: number;
};

export type SegmentDetailSource = "blocks" | "models" | "empty";

export type SegmentDetail = {
  segment: ShowcasePlacementSegment;
  source: SegmentDetailSource;
  blockCount: number;
  totalCapacity: number;
  totalOurs: number;
  totalCompetitors: number;
  free: number;
  distributionPercent: number;
  totalLegacyOurs: number;
  rotationPotentialPercent: number;
  byPlacementType: SegmentPlacementTypeBreakdownRow[];
  ourModels: SegmentOurModelCard[];
  competitorRows: SegmentCompetitorRow[];
};

function modelDefinitionForTargetId(targetId: string): ShowcaseMatrixModelDefinition | undefined {
  return SHOWCASE_MATRIX_MODEL_DEFINITIONS.find((m) => m.id === targetId);
}

function blockOurs(b: ShowcaseMatrixEntryDto): number {
  if (typeof b.placementActual === "number" && Number.isFinite(b.placementActual)) {
    return Math.max(0, b.placementActual);
  }
  return (b.placementOurModels ?? []).reduce((a, m) => a + Math.max(0, m?.count ?? 0), 0);
}

function blockCompetitors(b: ShowcaseMatrixEntryDto): number {
  return (b.placementCompetitors ?? []).reduce((a, c) => a + Math.max(0, c?.count ?? 0), 0);
}

function ourModelCardFromId(modelId: string, count: number): SegmentOurModelCard {
  const product = getProductById(modelId);
  const def = modelDefinitionForTargetId(modelId);
  return {
    modelId,
    name: product?.name?.trim() || def?.name?.trim() || modelId,
    series: product?.series?.trim() || null,
    imageUrl: product?.image?.trim() || def?.imageUrl?.trim() || null,
    count,
  };
}

function buildOurModelsFromInstalledEntries(
  entries: readonly ShowcaseMatrixEntryDto[],
  segment: ShowcasePlacementSegment,
): SegmentOurModelCard[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.targetKind !== "model" || e.status !== "installed") continue;
    if (segmentForModelTargetId(e.targetId) !== segment) continue;
    counts.set(e.targetId, (counts.get(e.targetId) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([modelId, count]) => ourModelCardFromId(modelId, count))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function countInstalledOursByPlacementType(
  entries: readonly ShowcaseMatrixEntryDto[],
  segment: ShowcasePlacementSegment,
): Map<ShowcasePlacementType, number> {
  const counts = new Map<ShowcasePlacementType, number>();
  const fallbackType = LEGACY_FALLBACK_TYPE_BY_SEGMENT[segment];

  for (const e of entries) {
    if (e.targetKind !== "model" || e.status !== "installed") continue;
    if (segmentForModelTargetId(e.targetId) !== segment) continue;
    const placementType = e.placementType ?? fallbackType;
    counts.set(placementType, (counts.get(placementType) ?? 0) + 1);
  }

  return counts;
}

function recalculatePlacementTypeRowFree(row: SegmentPlacementTypeBreakdownRow): void {
  row.free = Math.max(0, row.capacity - row.ours - row.competitors - row.legacyOurs);
}

function applyInstalledOursToPlacementTypeBreakdown(
  byType: Map<ShowcasePlacementType, SegmentPlacementTypeBreakdownRow>,
  installedByType: Map<ShowcasePlacementType, number>,
): void {
  for (const [placementType, installedCount] of Array.from(installedByType.entries())) {
    if (installedCount <= 0) continue;
    const row = byType.get(placementType) ?? {
      placementType,
      blockCount: 0,
      capacity: 0,
      ours: 0,
      legacyOurs: 0,
      competitors: 0,
      free: 0,
    };
    row.ours = Math.max(row.ours, installedCount);
    byType.set(placementType, row);
  }

  for (const row of Array.from(byType.values())) {
    recalculatePlacementTypeRowFree(row);
  }
}

function sortedPlacementTypeBreakdown(
  byType: Map<ShowcasePlacementType, SegmentPlacementTypeBreakdownRow>,
): SegmentPlacementTypeBreakdownRow[] {
  return Array.from(byType.values()).sort((a, b) =>
    a.placementType.localeCompare(b.placementType),
  );
}

export function installedOurModelsBySegment(
  entries: readonly ShowcaseMatrixEntryDto[],
): Record<ShowcasePlacementSegment, SegmentOurModelCard[]> {
  return {
    vh: buildOurModelsFromInstalledEntries(entries, "vh"),
    mk: buildOurModelsFromInstalledEntries(entries, "mk"),
    hardware: buildOurModelsFromInstalledEntries(entries, "hardware"),
  };
}

export function countInstalledOursBySegment(
  entries: readonly ShowcaseMatrixEntryDto[],
): Record<ShowcasePlacementSegment, number> {
  const bySegment = installedOurModelsBySegment(entries);
  return {
    vh: bySegment.vh.reduce((sum, m) => sum + m.count, 0),
    mk: bySegment.mk.reduce((sum, m) => sum + m.count, 0),
    hardware: bySegment.hardware.reduce((sum, m) => sum + m.count, 0),
  };
}

/** Полная детализация по сегменту: разбивка по типу размещения, модели, конкуренты. */
export function buildSegmentDetail(
  entries: readonly ShowcaseMatrixEntryDto[],
  segment: ShowcasePlacementSegment,
): SegmentDetail {
  const blocks = entries.filter(
    (e) => e.targetKind === "placement" && e.placementSegment === segment,
  );

  let totalCapacity = 0;
  let totalOurs = 0;
  let totalCompetitors = 0;

  const byType = new Map<ShowcasePlacementType, SegmentPlacementTypeBreakdownRow>();
  for (const b of blocks) {
    const cap = Math.max(0, b.placementCapacity ?? 0);
    const ours = blockOurs(b);
    const comp = blockCompetitors(b);
    const legacyOurs = Math.max(0, b.placementLegacyOurs ?? 0);
    totalCapacity += cap;
    totalOurs += ours;
    totalCompetitors += comp;

    const t = b.placementType;
    if (!t) continue;
    const row = byType.get(t) ?? {
      placementType: t,
      blockCount: 0,
      capacity: 0,
      ours: 0,
      legacyOurs: 0,
      competitors: 0,
      free: 0,
    };
    row.blockCount += 1;
    row.capacity += cap;
    row.ours += ours;
    row.legacyOurs += legacyOurs;
    row.competitors += comp;
    recalculatePlacementTypeRowFree(row);
    byType.set(t, row);
  }

  const installedByType = countInstalledOursByPlacementType(entries, segment);
  applyInstalledOursToPlacementTypeBreakdown(byType, installedByType);

  const ourModelsAcc = new Map<string, SegmentOurModelCard>();
  for (const b of blocks) {
    for (const m of b.placementOurModels ?? []) {
      const id = m?.modelId?.trim();
      const count = Math.max(0, m?.count ?? 0);
      if (!id || count <= 0) continue;
      const prev = ourModelsAcc.get(id);
      if (prev) {
        prev.count += count;
        continue;
      }
      ourModelsAcc.set(id, ourModelCardFromId(id, count));
    }
  }

  const compAcc = new Map<string, SegmentCompetitorRow>();
  for (const b of blocks) {
    for (const c of b.placementCompetitors ?? []) {
      const brand = c?.brand?.trim();
      const count = Math.max(0, c?.count ?? 0);
      if (!brand || count <= 0) continue;
      const prev = compAcc.get(brand);
      if (prev) prev.count += count;
      else compAcc.set(brand, { brand, count });
    }
  }

  let ourModels = Array.from(ourModelsAcc.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "ru"),
  );

  // [prompt-353] всегда учитываем модели со статусом "installed" — даже при наличии placement-блоков
  if (segment === "vh" || segment === "mk" || segment === "hardware") {
    const installedCards = buildOurModelsFromInstalledEntries(entries, segment);
    if (installedCards.length > 0) {
      const merged = new Map<string, SegmentOurModelCard>();
      for (const card of ourModels) merged.set(card.modelId, card);
      for (const card of installedCards) {
        const prev = merged.get(card.modelId);
        if (!prev || card.count > prev.count) {
          merged.set(card.modelId, card);
        }
      }
      ourModels = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));

      if (blocks.length === 0) {
        const modelOurs = ourModels.reduce((sum, m) => sum + m.count, 0);
        const totalLegacyOurs = Array.from(byType.values()).reduce((sum, row) => sum + row.legacyOurs, 0);
        return {
          segment,
          source: "models",
          blockCount: 0,
          totalCapacity: 0,
          totalOurs: modelOurs,
          totalCompetitors: 0,
          free: 0,
          distributionPercent: 0,
          totalLegacyOurs,
          rotationPotentialPercent: 0,
          byPlacementType: sortedPlacementTypeBreakdown(byType),
          ourModels,
          competitorRows: [],
        };
      }
    }
  }

  const installedOursFromModels = ourModels.reduce((sum, m) => sum + m.count, 0);
  const effectiveTotalOurs = Math.max(totalOurs, installedOursFromModels);
  const totalLegacyOurs = Array.from(byType.values()).reduce((sum, row) => sum + row.legacyOurs, 0);

  const free = Math.max(0, totalCapacity - effectiveTotalOurs - totalCompetitors);
  const distributionPercent =
    totalCapacity > 0
      ? Math.min(100, Math.max(0, Math.floor((effectiveTotalOurs / totalCapacity) * 100)))
      : 0;
  const rotationPotentialPercent =
    totalCapacity > 0
      ? Math.min(100, Math.max(0, Math.floor((totalLegacyOurs / totalCapacity) * 100)))
      : 0;

  const source: SegmentDetailSource =
    blocks.length > 0 ? "blocks" : ourModels.length > 0 ? "models" : "empty";

  return {
    segment,
    source,
    blockCount: blocks.length,
    totalCapacity,
    totalOurs: effectiveTotalOurs,
    totalCompetitors,
    free,
    distributionPercent,
    totalLegacyOurs,
    rotationPotentialPercent,
    byPlacementType: sortedPlacementTypeBreakdown(byType),
    ourModels,
    competitorRows: Array.from(compAcc.values()).sort((a, b) => b.count - a.count),
  };
}
