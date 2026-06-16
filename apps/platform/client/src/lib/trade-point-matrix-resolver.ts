/**
 * Единый резолвер состава матрицы для торговой точки: справочник → фолбэк на хардкод.
 */

import type { ClientCategoryId } from "@/lib/client-category";
import type { ShowcaseMatrixCatalogPriority, ShowcaseMatrixDefModelDto } from "@/lib/showcase-matrix-catalog-api";
import { resolveActiveMatrixDefFromCache, todayIsoDateLocal } from "@/lib/showcase-matrix-catalog-resolve";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import {
  getShowcaseMatrixModelsForTradePoint,
  SHOWCASE_MATRIX_MODEL_DEFINITIONS,
  type ShowcaseMatrixModelDefinition,
  type ShowcaseMatrixModelType,
  type ShowcaseMatrixPriorityRank,
  showcaseMatrixTypeLabelRu,
} from "@/lib/trade-point-showcase-matrix-models";

export type ResolveTradePointMatrixParams = {
  dealerId: string;
  tradePointId: string;
  clientCategory: ClientCategoryId;
  region: string | null;
  city: string | null;
  onDate?: string;
};

export type ResolvedTradePointMatrixSource = "managed" | "fallback";

export type ResolvedTradePointMatrix = {
  source: ResolvedTradePointMatrixSource;
  defId: string | null;
  models: ShowcaseMatrixModelDefinition[];
};

const HARDCODED_BY_ID = new Map(SHOWCASE_MATRIX_MODEL_DEFINITIONS.map((m) => [m.id, m]));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_WEIGHT_BY_PRIORITY: Record<ShowcaseMatrixCatalogPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function isUuid(id: string): boolean {
  return UUID_RE.test(id.trim());
}

function catalogSegmentToModelType(segment: ShowcaseMatrixDefModelDto["segment"]): ShowcaseMatrixModelType {
  if (segment === "vh") return "entrance";
  if (segment === "hardware") return "hardware";
  return "interior";
}

function typeLabelFor(type: ShowcaseMatrixModelType): ShowcaseMatrixTypeLabelRu {
  return showcaseMatrixTypeLabelRu(type);
}

function emptyPresentation(): Omit<
  ShowcaseMatrixModelDefinition,
  "id" | "name" | "type" | "typeLabelRu" | "imageUrl" | "basePriority"
> {
  return {
    importanceReason: "Позиция управляемой матрицы витрины.",
    characteristics: "",
    advantages: "",
    benefitsDealer: "",
    benefitsBuyer: "",
    objections: "",
    objectionAnswers: "",
    copyMessage: "",
  };
}

function modelRowToDefinition(
  row: ShowcaseMatrixDefModelDto,
  clientCategory: ClientCategoryId,
): ShowcaseMatrixModelDefinition | null {
  const productId = row.targetId;
  const effective1cId = row.catalog1cId ?? row.targetId;
  const hardcoded = HARDCODED_BY_ID.get(productId);

  if (hardcoded) {
    return {
      id: productId,
      catalog1cId: row.catalog1cId ?? undefined,
      name: hardcoded.name,
      type: hardcoded.type,
      typeLabelRu: hardcoded.typeLabelRu,
      imageUrl: hardcoded.imageUrl,
      basePriority: row.priority as ShowcaseMatrixPriorityRank,
      importanceReason: hardcoded.importanceReason,
      characteristics: hardcoded.characteristics,
      advantages: hardcoded.advantages,
      benefitsDealer: hardcoded.benefitsDealer,
      benefitsBuyer: hardcoded.benefitsBuyer,
      objections: hardcoded.objections,
      objectionAnswers: hardcoded.objectionAnswers,
      copyMessage: hardcoded.copyMessage,
    };
  }

  if (isUuid(productId)) {
    const type = catalogSegmentToModelType(row.segment);
    return {
      id: productId,
      catalog1cId: effective1cId,
      name: productId,
      type,
      typeLabelRu: typeLabelFor(type),
      imageUrl: "",
      basePriority: row.priority as ShowcaseMatrixPriorityRank,
      ...emptyPresentation(),
    };
  }

  return null;
}

function buildManagedModels(
  rows: ShowcaseMatrixDefModelDto[],
  clientCategory: ClientCategoryId,
): ShowcaseMatrixModelDefinition[] {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const out: ShowcaseMatrixModelDefinition[] = [];
  for (const row of sorted) {
    const def = modelRowToDefinition(row, clientCategory);
    if (def) out.push(def);
  }
  return out;
}

export function resolveActiveManagedMatrix(
  params: ResolveTradePointMatrixParams,
): ResolvedTradePointMatrix | null {
  const onDate = params.onDate ?? todayIsoDateLocal();
  const active = resolveActiveMatrixDefFromCache({
    clientCategory: params.clientCategory,
    region: params.region,
    city: params.city,
    onDate,
  });
  if (!active || active.models.length === 0) return null;

  const models = buildManagedModels(active.models, params.clientCategory);
  if (models.length === 0) return null;

  return { source: "managed", defId: active.id, models };
}

export function resolveTradePointMatrixModels(params: ResolveTradePointMatrixParams): ShowcaseMatrixModelDefinition[] {
  const managed = resolveActiveManagedMatrix(params);
  if (managed) return managed.models;
  return getShowcaseMatrixModelsForTradePoint(params.dealerId, params.tradePointId, params.clientCategory);
}

export function resolveTradePointMatrixWithSource(params: ResolveTradePointMatrixParams): ResolvedTradePointMatrix {
  const managed = resolveActiveManagedMatrix(params);
  if (managed) return managed;
  return {
    source: "fallback",
    defId: null,
    models: getShowcaseMatrixModelsForTradePoint(params.dealerId, params.tradePointId, params.clientCategory),
  };
}

/** Обязательные позиции: high в активной матрице; если high нет — все позиции матрицы. */
export function resolveRequiredTradePointMatrixModels(
  params: ResolveTradePointMatrixParams,
): ShowcaseMatrixModelDefinition[] {
  const managed = resolveActiveManagedMatrix(params);
  if (!managed) return [];
  const high = managed.models.filter((m) => m.basePriority === "high");
  return high.length > 0 ? high : managed.models;
}

export type MatrixPositionWeight = {
  targetId: string;
  weight: number;
  priority: ShowcaseMatrixCatalogPriority;
};

export function resolveMatrixPositionWeights(
  params: ResolveTradePointMatrixParams,
): { source: ResolvedTradePointMatrixSource; positions: MatrixPositionWeight[] } | null {
  const onDate = params.onDate ?? todayIsoDateLocal();
  const active = resolveActiveMatrixDefFromCache({
    clientCategory: params.clientCategory,
    region: params.region,
    city: params.city,
    onDate,
  });
  if (!active || active.models.length === 0) return null;

  const positions = [...active.models]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      targetId: m.targetId,
      weight: m.valueWeight ?? DEFAULT_WEIGHT_BY_PRIORITY[m.priority],
      priority: m.priority,
    }));

  return { source: "managed", positions };
}

export function computeMatrixValueQualitativePct(
  entries: readonly ShowcaseMatrixEntryDto[],
  params: ResolveTradePointMatrixParams,
): number | null {
  const weights = resolveMatrixPositionWeights(params);
  if (!weights || weights.positions.length === 0) return null;

  const weightById = new Map(weights.positions.map((p) => [p.targetId, p.weight]));
  let total = 0;
  for (const p of weights.positions) total += p.weight;
  if (total <= 0) return null;

  let presented = 0;
  for (const e of entries) {
    if (e.targetKind !== "model" && e.targetKind !== "variant") continue;
    if (e.status !== "installed") continue;
    const w = weightById.get(e.targetId);
    if (w != null) presented += w;
  }

  return Math.round((presented / total) * 100);
}
