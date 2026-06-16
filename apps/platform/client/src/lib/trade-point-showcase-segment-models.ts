import type {
  ShowcaseMatrixEntryDto,
  ShowcasePlacementSegment,
  ShowcasePlacementType,
} from "@/lib/showcase-matrix-api";
import { getProductById } from "@/lib/catalog-data";
import {
  SHOWCASE_MATRIX_MODEL_DEFINITIONS,
  type ShowcaseMatrixModelDefinition,
} from "@/lib/trade-point-showcase-matrix-models";

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
  if (segment !== "vh" && segment !== "mk") return [];
  const wantType = segment === "vh" ? "entrance" : "interior";
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.targetKind !== "model" || e.status !== "installed") continue;
    const def = modelDefinitionForTargetId(e.targetId);
    if (!def || def.type !== wantType) continue;
    counts.set(e.targetId, (counts.get(e.targetId) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([modelId, count]) => ourModelCardFromId(modelId, count))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
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
      competitors: 0,
      free: 0,
    };
    row.blockCount += 1;
    row.capacity += cap;
    row.ours += ours;
    row.competitors += comp;
    row.free = Math.max(0, row.capacity - row.ours - row.competitors);
    byType.set(t, row);
  }

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

  if (blocks.length === 0 && (segment === "vh" || segment === "mk")) {
    ourModels = buildOurModelsFromInstalledEntries(entries, segment);
    if (ourModels.length > 0) {
      const modelOurs = ourModels.reduce((sum, m) => sum + m.count, 0);
      return {
        segment,
        source: "models",
        blockCount: 0,
        totalCapacity: 0,
        totalOurs: modelOurs,
        totalCompetitors: 0,
        free: 0,
        distributionPercent: 0,
        byPlacementType: [],
        ourModels,
        competitorRows: [],
      };
    }
  }

  const free = Math.max(0, totalCapacity - totalOurs - totalCompetitors);
  const distributionPercent =
    totalCapacity > 0 ? Math.min(100, Math.max(0, Math.floor((totalOurs / totalCapacity) * 100))) : 0;

  const source: SegmentDetailSource =
    blocks.length > 0 ? "blocks" : ourModels.length > 0 ? "models" : "empty";

  return {
    segment,
    source,
    blockCount: blocks.length,
    totalCapacity,
    totalOurs,
    totalCompetitors,
    free,
    distributionPercent,
    byPlacementType: Array.from(byType.values()).sort((a, b) =>
      a.placementType.localeCompare(b.placementType),
    ),
    ourModels,
    competitorRows: Array.from(compAcc.values()).sort((a, b) => b.count - a.count),
  };
}
