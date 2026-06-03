import type { ShowcaseMatrixEntryDto, ShowcasePlacementType } from "@/lib/showcase-matrix-api";
import { PLACEMENT_QUALITY_WEIGHT } from "@/lib/showcase-placement-labels";

export type PlacementTypeMetric = {
  type: ShowcasePlacementType;
  capacity: number;
  actual: number;
  quantitativePct: number | null;
};

export type DistributionMetrics = {
  byType: PlacementTypeMetric[];
  totalCapacity: number;
  totalActual: number;
  quantitativePct: number | null;
  qualitativePct: number | null;
};

const EMPTY_METRICS: DistributionMetrics = {
  byType: [],
  totalCapacity: 0,
  totalActual: 0,
  quantitativePct: null,
  qualitativePct: null,
};

function safeNonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function roundPct(value: number): number {
  return Math.round(value);
}

export function placementEntries(entries: readonly ShowcaseMatrixEntryDto[]): ShowcaseMatrixEntryDto[] {
  return entries.filter((e) => e.targetKind === "placement");
}

// TODO: заменить веса типов на матрицу ценности из каталога (этап матрицы ценности)
export function computeQualitativeDistributionPct(
  byType: readonly PlacementTypeMetric[],
  totalActual: number,
): number | null {
  if (totalActual <= 0) return null;
  let weighted = 0;
  for (const row of byType) {
    weighted += row.actual * PLACEMENT_QUALITY_WEIGHT[row.type];
  }
  return roundPct((weighted / totalActual) * 100);
}

export function computeDistributionMetrics(entries: readonly ShowcaseMatrixEntryDto[]): DistributionMetrics {
  const blocks = placementEntries(entries).filter((e) => e.placementType != null);
  if (blocks.length === 0) return { ...EMPTY_METRICS };

  const byTypeMap = new Map<ShowcasePlacementType, { capacity: number; actual: number }>();

  for (const block of blocks) {
    const type = block.placementType as ShowcasePlacementType;
    const capacity = safeNonNegativeInt(block.placementCapacity);
    const rawActual = safeNonNegativeInt(block.placementActual);
    const actual = capacity > 0 ? Math.min(rawActual, capacity) : rawActual;

    const prev = byTypeMap.get(type) ?? { capacity: 0, actual: 0 };
    prev.capacity += capacity;
    prev.actual += actual;
    byTypeMap.set(type, prev);
  }

  const byType: PlacementTypeMetric[] = [...byTypeMap.entries()].map(([type, sums]) => ({
    type,
    capacity: sums.capacity,
    actual: sums.actual,
    quantitativePct:
      sums.capacity > 0 ? roundPct((sums.actual / sums.capacity) * 100) : null,
  }));

  byType.sort((a, b) => {
    const w = PLACEMENT_QUALITY_WEIGHT[b.type] - PLACEMENT_QUALITY_WEIGHT[a.type];
    if (w !== 0) return w;
    return a.type.localeCompare(b.type, "ru");
  });

  const totalCapacity = byType.reduce((s, r) => s + r.capacity, 0);
  const totalActual = byType.reduce((s, r) => s + r.actual, 0);

  const quantitativePct =
    totalCapacity > 0 ? roundPct((totalActual / totalCapacity) * 100) : null;
  const qualitativePct = computeQualitativeDistributionPct(byType, totalActual);

  return {
    byType,
    totalCapacity,
    totalActual,
    quantitativePct,
    qualitativePct,
  };
}
