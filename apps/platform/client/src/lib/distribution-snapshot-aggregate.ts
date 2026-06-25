import {
  ALL_EQUIPMENT_TYPES,
  type EquipmentTypeKey,
} from "./distribution-analytics/distribution-analytics-math.js";

export type DistributionSnapshotByTypeNumbers = {
  entrance: { capacity: number; onShelf: number };
  interior: { capacity: number; onShelf: number };
  hardware: { capacity: number; onShelf: number };
};

export const EMPTY_SNAPSHOT_BY_TYPE: DistributionSnapshotByTypeNumbers = {
  entrance: { capacity: 0, onShelf: 0 },
  interior: { capacity: 0, onShelf: 0 },
  hardware: { capacity: 0, onShelf: 0 },
};

export type AggregatedSnapshotByType = Record<
  EquipmentTypeKey,
  { capacity: number; onShelf: number; percent: number | null }
>;

function percentFromSums(capacity: number, onShelf: number): number | null {
  if (capacity <= 0) return null;
  return (onShelf / capacity) * 100;
}

/** Агрегат по набору снимков: Σ capacity и Σ onShelf по типу, затем percent. */
export function aggregateSnapshotByTypeMaps(
  tradePointIds: readonly string[],
  byTradePointId: Record<string, DistributionSnapshotByTypeNumbers>,
): AggregatedSnapshotByType {
  const acc: Record<EquipmentTypeKey, { capacity: number; onShelf: number }> = {
    entrance: { capacity: 0, onShelf: 0 },
    interior: { capacity: 0, onShelf: 0 },
    hardware: { capacity: 0, onShelf: 0 },
  };

  for (const tpId of tradePointIds) {
    const row = byTradePointId[tpId] ?? EMPTY_SNAPSHOT_BY_TYPE;
    for (const type of ALL_EQUIPMENT_TYPES) {
      acc[type].capacity += row[type].capacity;
      acc[type].onShelf += row[type].onShelf;
    }
  }

  const out = {} as AggregatedSnapshotByType;
  for (const type of ALL_EQUIPMENT_TYPES) {
    const row = acc[type];
    out[type] = {
      ...row,
      percent: percentFromSums(row.capacity, row.onShelf),
    };
  }
  return out;
}

/** Дельта в процентных пунктах: currentPercent − baselinePercent. */
export function computeDistributionDeltaByType(
  current: AggregatedSnapshotByType,
  baseline: AggregatedSnapshotByType,
): Record<EquipmentTypeKey, number | null> {
  const out = {} as Record<EquipmentTypeKey, number | null>;
  for (const type of ALL_EQUIPMENT_TYPES) {
    const cur = current[type].percent;
    const base = baseline[type].percent;
    out[type] = cur != null && base != null ? cur - base : null;
  }
  return out;
}

export function computeSinceDateUtc(periodDays: number, now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - periodDays);
  return d.toISOString().slice(0, 10);
}
