import type {
  ShowcaseMatrixEntryDto,
  ShowcasePlacementSegment,
  ShowcasePlacementType,
} from "@/lib/showcase-matrix-api";
import { getProductById } from "@/lib/catalog-data";

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

export type SegmentDetail = {
  segment: ShowcasePlacementSegment;
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

function blockOurs(b: ShowcaseMatrixEntryDto): number {
  if (typeof b.placementActual === "number" && Number.isFinite(b.placementActual)) {
    return Math.max(0, b.placementActual);
  }
  return (b.placementOurModels ?? []).reduce((a, m) => a + Math.max(0, m?.count ?? 0), 0);
}

function blockCompetitors(b: ShowcaseMatrixEntryDto): number {
  return (b.placementCompetitors ?? []).reduce((a, c) => a + Math.max(0, c?.count ?? 0), 0);
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
      const product = getProductById(id);
      ourModelsAcc.set(id, {
        modelId: id,
        name: product?.name?.trim() || id,
        series: product?.series?.trim() || null,
        imageUrl: product?.image?.trim() || null,
        count,
      });
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

  const free = Math.max(0, totalCapacity - totalOurs - totalCompetitors);
  const distributionPercent =
    totalCapacity > 0 ? Math.min(100, Math.max(0, Math.floor((totalOurs / totalCapacity) * 100))) : 0;

  return {
    segment,
    blockCount: blocks.length,
    totalCapacity,
    totalOurs,
    totalCompetitors,
    free,
    distributionPercent,
    byPlacementType: Array.from(byType.values()).sort((a, b) =>
      a.placementType.localeCompare(b.placementType),
    ),
    ourModels: Array.from(ourModelsAcc.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ru"),
    ),
    competitorRows: Array.from(compAcc.values()).sort((a, b) => b.count - a.count),
  };
}
