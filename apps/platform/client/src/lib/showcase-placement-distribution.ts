import type { ShowcaseMatrixEntryDto, ShowcasePlacementSegment } from "./showcase-matrix-api.js";

export type PlacementDistributionStats = {
  totalCapacity: number;
  totalOurs: number;
  totalCompetitors: number;
  totalLegacyOurs: number;
  remaining: number;
  distributionPercent: number;
  blockCount: number;
};

export type PlacementSegmentDistribution = {
  segment: ShowcasePlacementSegment;
  stats: PlacementDistributionStats;
};

export type PlacementDistributionSummary = {
  overall: PlacementDistributionStats;
  bySegment: PlacementSegmentDistribution[];
};

const SEGMENT_ORDER: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];

function sumOurs(entry: ShowcaseMatrixEntryDto): number {
  if (typeof entry.placementActual === "number" && Number.isFinite(entry.placementActual)) {
    return Math.max(0, entry.placementActual);
  }
  const fromModels = (entry.placementOurModels ?? []).reduce((acc, m) => acc + (m?.count ?? 0), 0);
  return Math.max(0, fromModels);
}

function sumCompetitors(entry: ShowcaseMatrixEntryDto): number {
  return (entry.placementCompetitors ?? []).reduce((acc, c) => acc + (c?.count ?? 0), 0);
}

function computeStats(blocks: ShowcaseMatrixEntryDto[]): PlacementDistributionStats {
  let totalCapacity = 0;
  let totalOurs = 0;
  let totalCompetitors = 0;
  let totalLegacyOurs = 0;
  for (const b of blocks) {
    totalCapacity += Math.max(0, b.placementCapacity ?? 0);
    totalOurs += sumOurs(b);
    totalCompetitors += sumCompetitors(b);
    totalLegacyOurs += Math.max(0, b.placementLegacyOurs ?? 0);
  }
  const remaining = Math.max(0, totalCapacity - totalOurs - totalCompetitors);
  const distributionPercent =
    totalCapacity > 0 ? Math.min(100, Math.max(0, Math.round((totalOurs / totalCapacity) * 100))) : 0;
  return {
    totalCapacity,
    totalOurs,
    totalCompetitors,
    totalLegacyOurs,
    remaining,
    distributionPercent,
    blockCount: blocks.length,
  };
}

/**
 * Считает % дистрибуции по витрине из блоков размещения.
 * Принимает ВСЕ entries; сам отбирает targetKind === "placement".
 */
export function computePlacementDistribution(
  entries: ShowcaseMatrixEntryDto[],
): PlacementDistributionSummary {
  const blocks = entries.filter((e) => e.targetKind === "placement");
  const overall = computeStats(blocks);
  const bySegment: PlacementSegmentDistribution[] = [];
  for (const segment of SEGMENT_ORDER) {
    const segBlocks = blocks.filter((b) => b.placementSegment === segment);
    if (segBlocks.length === 0) continue;
    bySegment.push({ segment, stats: computeStats(segBlocks) });
  }
  return { overall, bySegment };
}
