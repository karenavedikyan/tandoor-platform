import { normalizeHasShowcase } from "../client-base-actualization-state.js";
import type { TradePointShowcaseActualization } from "../client-base-actualization-state.js";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";
import type { ShowcasePlacementSegment } from "../showcase-matrix-api.js";
import type { ShowcaseTypeKey } from "../showcase-type-capacity.js";
import { getShowcaseTypeCapacity } from "../showcase-type-capacity.js";
import { normalizeShowcaseMatrixModelId } from "../showcase-matrix-store.js";
import { countInstalledOursBySegment } from "../trade-point-showcase-segment-models.js";

export type EquipmentTypeKey = ShowcaseTypeKey;

export const ALL_EQUIPMENT_TYPES: EquipmentTypeKey[] = ["entrance", "interior", "hardware"];

const SEGMENT_BY_TYPE: Record<EquipmentTypeKey, ShowcasePlacementSegment> = {
  entrance: "vh",
  interior: "mk",
  hardware: "hardware",
};

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

/** Есть ли installed-модель с данным id в entries матрицы ТТ. */
export function isModelInstalledInEntries(
  entries: readonly ShowcaseMatrixEntryDto[] | undefined,
  modelId: string,
): boolean {
  const normalized = normalizeShowcaseMatrixModelId(modelId);
  if (!entries?.length) return false;
  for (const e of entries) {
    if (e.targetKind !== "model" && e.targetKind !== "variant") continue;
    if (e.status !== "installed") continue;
    if (normalizeShowcaseMatrixModelId(e.targetId) === normalized) return true;
  }
  return false;
}

/** Сколько installed-моделей конкретного типа на витрине ТТ (из showcase_matrix_entries). */
export function countInstalledModelsOfType(
  entries: readonly ShowcaseMatrixEntryDto[],
  type: EquipmentTypeKey,
): number {
  return countInstalledOursBySegment(entries)[SEGMENT_BY_TYPE[type]];
}

/** Дистрибуция одной ТТ по всем типам + средняя. Числитель — installed-модели матрицы. */
export function computeDistributionForTradePoint(
  sh: TradePointShowcaseActualization | undefined,
  installedEntries: readonly ShowcaseMatrixEntryDto[] = [],
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

  const installedBySegment = countInstalledOursBySegment(installedEntries);
  const byType = {} as Record<EquipmentTypeKey, DistributionByType>;
  let sum = 0;
  let n = 0;
  for (const type of ALL_EQUIPMENT_TYPES) {
    const capacity = sh ? getShowcaseTypeCapacity(sh, type) : null;
    const onShelf = installedBySegment[SEGMENT_BY_TYPE[type]];
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

/** Покрытие конкретной модели по группе ТТ (present — installed в матрице). */
export function computeModelCoverage(
  modelId: string,
  modelType: EquipmentTypeKey,
  metrics: DistributionTradePointMetrics[],
  installedEntriesByTradePointId: Record<string, readonly ShowcaseMatrixEntryDto[] | undefined>,
): ModelCoverageMetrics {
  let present = 0;
  let eligible = 0;
  for (const m of metrics) {
    if (!m.hasShowcase) continue;
    const cap = m.byType[modelType].capacity;
    if (cap != null && cap > 0) {
      eligible += 1;
      if (isModelInstalledInEntries(installedEntriesByTradePointId[m.tradePointId], modelId)) present += 1;
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

/**
 * Пороги светофора дистрибуции (в процентах).
 * Ниже redBelow — красный (тревога), [redBelow, greenAtOrAbove) — жёлтый (норма), >= greenAtOrAbove — зелёный (отлично, фирменный Tandoor).
 * Единые для всех категорий на текущем этапе. Структура готова к раздельным порогам по типам (ВХ/МК/Фурнитура) в будущем.
 */
export const DISTRIBUTION_TRAFFIC_LIGHT_THRESHOLDS = {
  /** ниже этого значения (%) — красный */
  redBelow: 15,
  /** на этом значении и выше — зелёный; ниже — жёлтый */
  greenAtOrAbove: 40,
} as const;

export type DistributionPercentTone = "empty" | "red" | "yellow" | "green";

export function distributionPercentTone(value: number | null | undefined): DistributionPercentTone {
  if (value == null || !Number.isFinite(value)) return "empty";
  if (value < DISTRIBUTION_TRAFFIC_LIGHT_THRESHOLDS.redBelow) return "red";
  if (value < DISTRIBUTION_TRAFFIC_LIGHT_THRESHOLDS.greenAtOrAbove) return "yellow";
  return "green";
}

export const DISTRIBUTION_PERCENT_TONE_CLASS: Record<DistributionPercentTone, string> = {
  empty: "bg-muted text-muted-foreground",
  red: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  yellow: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
  // Фирменный зелёный Tandoor (primary): мягкая заливка + насыщенный текст.
  green: "bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary",
};
