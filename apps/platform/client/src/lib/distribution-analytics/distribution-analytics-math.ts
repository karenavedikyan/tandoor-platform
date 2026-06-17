import { normalizeHasShowcase } from "./client-base-actualization-state.js";
import type {
  TradePointShowcaseActualization,
  TradePointShowcaseSelectedModel,
} from "./client-base-actualization-state.js";
import type { CatalogProduct } from "./catalog-product-type.js";
import type { ShowcaseTypeKey } from "./showcase-type-capacity.js";
import { getShowcaseTypeCapacity } from "./showcase-type-capacity.js";
import { effectivePortalTypeForSelectedModel } from "./trade-point-showcase-matrix-required.js";

export type EquipmentTypeKey = ShowcaseTypeKey;

export const ALL_EQUIPMENT_TYPES: EquipmentTypeKey[] = ["entrance", "interior", "hardware"];

export type DistributionByType = {
  capacity: number | null;
  tandoorOnShelf: number;
  percent: number | null;
};

export type DistributionTradePointMetrics = {
  tradePointId: string;
  byType: Record<EquipmentTypeKey, DistributionByType>;
  averagePercent: number | null;
  hasShowcase: boolean;
};

export type DistributionGroupMetrics = {
  byType: Record<EquipmentTypeKey, { capacity: number; tandoorOnShelf: number; percent: number | null }>;
  averagePercent: number | null;
  tradePointsCount: number;
};

export type ModelCoverageMetrics = {
  modelId: string;
  modelType: EquipmentTypeKey;
  presentTradePoints: number;
  eligibleTradePoints: number;
  coveragePercent: number | null;
};

function emptyByType(): DistributionByType {
  return { capacity: null, tandoorOnShelf: 0, percent: null };
}

/** Сколько моделей конкретного типа фактически выбрано в showcase ТТ. */
export function countTandoorModelsOfType(
  selected: TradePointShowcaseSelectedModel[] | undefined,
  type: EquipmentTypeKey,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): number {
  if (!selected) return 0;
  let n = 0;
  for (const m of selected) {
    const t = effectivePortalTypeForSelectedModel(m, catalogLookup);
    if (t === type) n += 1;
  }
  return n;
}

/** Дистрибуция одной ТТ по всем типам + средняя. */
export function computeDistributionForTradePoint(
  sh: TradePointShowcaseActualization | undefined,
  catalogLookup: (id: string) => CatalogProduct | undefined,
): DistributionTradePointMetrics {
  const tradePointId = sh?.tradePointId ?? "";
  const hasShowcase = sh ? normalizeHasShowcase(sh.hasShowcase) : true;

  if (!hasShowcase) {
    return {
      tradePointId,
      hasShowcase: false,
      byType: {
        entrance: emptyByType(),
        interior: emptyByType(),
        hardware: emptyByType(),
      },
      averagePercent: null,
    };
  }

  const byType = {} as Record<EquipmentTypeKey, DistributionByType>;
  let sum = 0;
  let n = 0;
  for (const type of ALL_EQUIPMENT_TYPES) {
    const capacity = sh ? getShowcaseTypeCapacity(sh, type) : null;
    const onShelf = countTandoorModelsOfType(sh?.selectedShowcaseModels, type, catalogLookup);
    let percent: number | null = null;
    if (capacity != null && capacity > 0) {
      percent = (onShelf / capacity) * 100;
      sum += percent;
      n += 1;
    }
    byType[type] = { capacity, tandoorOnShelf: onShelf, percent };
  }

  return {
    tradePointId,
    hasShowcase: true,
    byType,
    averagePercent: n > 0 ? sum / n : null,
  };
}

export function isTradePointEligibleForDistribution(metrics: DistributionTradePointMetrics): boolean {
  if (!metrics.hasShowcase) return false;
  return ALL_EQUIPMENT_TYPES.some((type) => {
    const cap = metrics.byType[type].capacity;
    return cap != null && cap > 0;
  });
}

/** Агрегат по группе ТТ — формула Σ числителей / Σ знаменателей. */
export function aggregateDistribution(metrics: DistributionTradePointMetrics[]): DistributionGroupMetrics {
  const eligible = metrics.filter(isTradePointEligibleForDistribution);
  const acc: Record<EquipmentTypeKey, { capacity: number; tandoorOnShelf: number }> = {
    entrance: { capacity: 0, tandoorOnShelf: 0 },
    interior: { capacity: 0, tandoorOnShelf: 0 },
    hardware: { capacity: 0, tandoorOnShelf: 0 },
  };

  for (const m of eligible) {
    for (const type of ALL_EQUIPMENT_TYPES) {
      const t = m.byType[type];
      if (t.capacity != null && t.capacity > 0) {
        acc[type].capacity += t.capacity;
        acc[type].tandoorOnShelf += t.tandoorOnShelf;
      }
    }
  }

  const byType = {} as DistributionGroupMetrics["byType"];
  for (const type of ALL_EQUIPMENT_TYPES) {
    const row = acc[type];
    byType[type] = {
      ...row,
      percent: row.capacity > 0 ? (row.tandoorOnShelf / row.capacity) * 100 : null,
    };
  }

  let sum = 0;
  let n = 0;
  for (const type of ALL_EQUIPMENT_TYPES) {
    if (byType[type].percent != null) {
      sum += byType[type].percent!;
      n += 1;
    }
  }

  return {
    byType,
    averagePercent: n > 0 ? sum / n : null,
    tradePointsCount: eligible.length,
  };
}

/** Покрытие конкретной модели по группе ТТ. */
export function computeModelCoverage(
  modelId: string,
  modelType: EquipmentTypeKey,
  metrics: DistributionTradePointMetrics[],
  shByTradePointId: Record<string, TradePointShowcaseActualization | undefined>,
): ModelCoverageMetrics {
  let present = 0;
  let eligible = 0;
  for (const m of metrics) {
    if (!m.hasShowcase) continue;
    const cap = m.byType[modelType].capacity;
    if (cap != null && cap > 0) {
      eligible += 1;
      const sh = shByTradePointId[m.tradePointId];
      if (sh?.selectedShowcaseModels?.some((x) => x.productId === modelId)) present += 1;
    }
  }
  return {
    modelId,
    modelType,
    presentTradePoints: present,
    eligibleTradePoints: eligible,
    coveragePercent: eligible > 0 ? (present / eligible) * 100 : null,
  };
}

export function formatDistributionPercent(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export type DistributionPercentTone = "empty" | "red" | "yellow" | "blue" | "green";

export function distributionPercentTone(value: number | null | undefined): DistributionPercentTone {
  if (value == null || !Number.isFinite(value)) return "empty";
  if (value < 30) return "red";
  if (value < 60) return "yellow";
  if (value < 85) return "blue";
  return "green";
}

export const DISTRIBUTION_PERCENT_TONE_CLASS: Record<DistributionPercentTone, string> = {
  empty: "bg-muted text-muted-foreground",
  red: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  yellow: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
  blue: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
};
