import type { TradePointListRow } from "./dealer-base-management-view-model.js";
import type { ShowcaseMatrixEntryDto, ShowcasePlacementSegment } from "./showcase-matrix-api.js";
import {
  SHOWCASE_MATRIX_MODEL_DEFINITIONS,
} from "./trade-point-showcase-matrix-models.js";
import {
  buildSegmentDetail,
  type SegmentDetailSource,
} from "./trade-point-showcase-segment-models.js";

const SEGMENT_ORDER: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];

export type SegmentSummaryRow = {
  dealerId: string;
  dealerName: string;
  tradePointId: string;
  tradePointName: string;
  city: string;
  segment: ShowcasePlacementSegment;
  blockCount: number;
  totalCapacity: number;
  totalOurs: number;
  distributionPercent: number;
  source: SegmentDetailSource;
  lastUpdatedAt: string | null;
};

export type ScopeSummaryTotals = {
  tradePointsInScope: number;
  tradePointsWithData: number;
  tradePointsEmpty: number;
  averagePercent: number;
};

export type ScopeSummaryFilter = {
  dealerIds?: string[];
  segments?: ShowcasePlacementSegment[];
  emptyOnly?: boolean;
};

function modelTypeForSegment(segment: ShowcasePlacementSegment): "entrance" | "interior" | null {
  if (segment === "vh") return "entrance";
  if (segment === "mk") return "interior";
  return null;
}

function entriesForLastUpdated(
  entries: readonly ShowcaseMatrixEntryDto[],
  segment: ShowcasePlacementSegment,
  source: SegmentDetailSource,
): readonly ShowcaseMatrixEntryDto[] {
  if (source === "empty") return [];
  if (source === "blocks") {
    return entries.filter(
      (e) => e.targetKind === "placement" && e.placementSegment === segment,
    );
  }
  const wantType = modelTypeForSegment(segment);
  if (!wantType) return [];
  return entries.filter((e) => {
    if (e.targetKind !== "model" || e.status !== "installed") return false;
    const def = SHOWCASE_MATRIX_MODEL_DEFINITIONS.find((m) => m.id === e.targetId);
    return def?.type === wantType;
  });
}

function maxUpdatedAt(entries: readonly ShowcaseMatrixEntryDto[]): string | null {
  let max: string | null = null;
  for (const e of entries) {
    const at = e.updatedAt?.trim();
    if (!at) continue;
    if (!max || at > max) max = at;
  }
  return max;
}

function segmentOrderIndex(segment: ShowcasePlacementSegment): number {
  return SEGMENT_ORDER.indexOf(segment);
}

function compareRows(a: SegmentSummaryRow, b: SegmentSummaryRow): number {
  const byDealer = a.dealerName.localeCompare(b.dealerName, "ru");
  if (byDealer !== 0) return byDealer;
  const byTp = a.tradePointName.localeCompare(b.tradePointName, "ru");
  if (byTp !== 0) return byTp;
  return segmentOrderIndex(a.segment) - segmentOrderIndex(b.segment);
}

export function buildDistributionScopeSummary(
  tradePoints: TradePointListRow[],
  entriesByTp: Map<string, readonly ShowcaseMatrixEntryDto[]>,
): { rows: SegmentSummaryRow[]; totals: ScopeSummaryTotals } {
  const rows: SegmentSummaryRow[] = [];

  for (const tp of tradePoints) {
    const entries = entriesByTp.get(tp.tpId) ?? [];
    for (const segment of SEGMENT_ORDER) {
      const detail = buildSegmentDetail(entries, segment);
      const relevant = entriesForLastUpdated(entries, segment, detail.source);
      rows.push({
        dealerId: tp.dealerId,
        dealerName: tp.dealerName,
        tradePointId: tp.tpId,
        tradePointName: tp.name,
        city: tp.city,
        segment,
        blockCount: detail.blockCount,
        totalCapacity: detail.totalCapacity,
        totalOurs: detail.totalOurs,
        distributionPercent: detail.distributionPercent,
        source: detail.source,
        lastUpdatedAt: maxUpdatedAt(relevant),
      });
    }
  }

  rows.sort(compareRows);

  const tpIds = new Set(tradePoints.map((tp) => tp.tpId));
  const withDataTp = new Set<string>();
  for (const row of rows) {
    if (row.source !== "empty") withDataTp.add(row.tradePointId);
  }

  const percentSamples = rows.filter(
    (r) => (r.segment === "vh" || r.segment === "mk") && r.source !== "empty",
  );
  const averagePercent =
    percentSamples.length > 0
      ? Math.round(
          percentSamples.reduce((sum, r) => sum + r.distributionPercent, 0) / percentSamples.length,
        )
      : 0;

  return {
    rows,
    totals: {
      tradePointsInScope: tpIds.size,
      tradePointsWithData: withDataTp.size,
      tradePointsEmpty: tpIds.size - withDataTp.size,
      averagePercent,
    },
  };
}

export function filterSummaryRows(
  rows: SegmentSummaryRow[],
  filter: ScopeSummaryFilter,
): SegmentSummaryRow[] {
  const dealerSet =
    filter.dealerIds && filter.dealerIds.length > 0 ? new Set(filter.dealerIds) : null;
  const segmentSet =
    filter.segments && filter.segments.length > 0 ? new Set(filter.segments) : null;

  return rows.filter((row) => {
    if (dealerSet && !dealerSet.has(row.dealerId)) return false;
    if (segmentSet && !segmentSet.has(row.segment)) return false;
    if (filter.emptyOnly && row.source !== "empty") return false;
    return true;
  });
}

export function uniqueDealersFromSummaryRows(
  rows: SegmentSummaryRow[],
): Array<{ id: string; name: string }> {
  const m = new Map<string, string>();
  for (const r of rows) {
    if (!m.has(r.dealerId)) m.set(r.dealerId, r.dealerName);
  }
  return Array.from(m.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}
