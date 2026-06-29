import type { ShowcaseMatrixEntryDto, ShowcasePlacementSegment } from "./showcase-matrix-api.js";
import {
  computePlacementDistribution,
  type PlacementDistributionStats,
} from "./showcase-placement-distribution.js";
import { buildPortalSecondPlanDetail } from "./trade-point-showcase-segment-models.js";

export type DistributionOnPointSegment = {
  pct: number;
  ours: number;
  total: number;
  legacyOurs: number;
  rotationPct: number;
  portalSecond: {
    ours: number;
    total: number;
    pct: number;
  } | null;
};

export type DistributionOnPointSummary = {
  hasData: boolean;
  mk: DistributionOnPointSegment;
  vh: DistributionOnPointSegment;
  hardware: DistributionOnPointSegment;
  total: DistributionOnPointSegment;
};

export type PortalCapacityFallback = {
  entrance: number;
  interior: number;
  hardware: number;
};

function segmentDistributionPercent(ours: number, total: number): number {
  return total > 0 ? Math.min(100, Math.max(0, Math.floor((ours / total) * 100))) : 0;
}

function mergeSegmentWithInstalled(
  stats: PlacementDistributionStats | null,
  installedOurs: number,
  portalSecond: DistributionOnPointSegment["portalSecond"] = null,
): DistributionOnPointSegment {
  const total = stats?.totalCapacity ?? 0;
  const ours = Math.max(stats?.totalOurs ?? 0, installedOurs);
  const legacyOurs = stats?.totalLegacyOurs ?? 0;
  return {
    pct: segmentDistributionPercent(ours, total),
    ours,
    total,
    legacyOurs,
    rotationPct: segmentDistributionPercent(legacyOurs, total),
    portalSecond,
  };
}

function portalSecondOnPoint(
  entries: readonly ShowcaseMatrixEntryDto[],
): DistributionOnPointSegment["portalSecond"] {
  const second = buildPortalSecondPlanDetail(entries);
  if (!second) return null;
  return {
    ours: second.ours,
    total: second.capacity,
    pct: second.distributionPercent,
  };
}

/**
 * Проценты «Дистрибуция на точке»: placement-блоки + installed-модели (max по сегменту).
 */
export function computeDistributionOnPoint(args: {
  entries: readonly ShowcaseMatrixEntryDto[];
  installedOursBySegment: Record<ShowcasePlacementSegment, number>;
  portalCapacity: PortalCapacityFallback;
}): DistributionOnPointSummary {
  const summary = computePlacementDistribution([...args.entries]);

  if (summary.overall.totalCapacity > 0) {
    const statsFor = (segment: ShowcasePlacementSegment) =>
      summary.bySegment.find((s) => s.segment === segment)?.stats ?? null;
    const mk = mergeSegmentWithInstalled(
      statsFor("mk"),
      args.installedOursBySegment.mk,
      portalSecondOnPoint(args.entries),
    );
    const vh = mergeSegmentWithInstalled(statsFor("vh"), args.installedOursBySegment.vh);
    const hardware = mergeSegmentWithInstalled(statsFor("hardware"), args.installedOursBySegment.hardware);
    const totalCap = mk.total + vh.total + hardware.total;
    const totalOurs = mk.ours + vh.ours + hardware.ours;
    const totalLegacy = mk.legacyOurs + vh.legacyOurs + hardware.legacyOurs;
    return {
      hasData: true,
      mk,
      vh,
      hardware,
      total: {
        pct: segmentDistributionPercent(totalOurs, totalCap),
        ours: totalOurs,
        total: totalCap,
        legacyOurs: totalLegacy,
        rotationPct: segmentDistributionPercent(totalLegacy, totalCap),
        portalSecond: null,
      },
    };
  }

  const capEnt = Math.max(0, args.portalCapacity.entrance);
  const capInt = Math.max(0, args.portalCapacity.interior);
  const capHw = Math.max(0, args.portalCapacity.hardware);
  const oursVh = args.installedOursBySegment.vh;
  const oursMk = args.installedOursBySegment.mk;
  const oursHw = args.installedOursBySegment.hardware;
  const totalCap = capEnt + capInt + capHw;
  const totalOurs = oursVh + oursMk + oursHw;
  const fallbackHasData = totalCap > 0 || totalOurs > 0;

  return {
    hasData: fallbackHasData,
    mk: {
      pct: segmentDistributionPercent(oursMk, capInt),
      ours: oursMk,
      total: capInt,
      legacyOurs: 0,
      rotationPct: 0,
      portalSecond: null,
    },
    vh: {
      pct: segmentDistributionPercent(oursVh, capEnt),
      ours: oursVh,
      total: capEnt,
      legacyOurs: 0,
      rotationPct: 0,
      portalSecond: null,
    },
    hardware: {
      pct: segmentDistributionPercent(oursHw, capHw),
      ours: oursHw,
      total: capHw,
      legacyOurs: 0,
      rotationPct: 0,
      portalSecond: null,
    },
    total: {
      pct: segmentDistributionPercent(totalOurs, totalCap),
      ours: totalOurs,
      total: totalCap,
      legacyOurs: 0,
      rotationPct: 0,
      portalSecond: null,
    },
  };
}
