/**
 * Агрегации аналитики дистрибуции (ЧД/КД, план-vs-факт, дефицит) — чистый view-model слой.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getDealerRegionalManagerDisplay } from "@/lib/dealer-base-mock-data";
import {
  clientAssignmentCodeCandidates,
  type ResponsibleByCodeMap,
} from "@/lib/dealer-base-management-view-model";
import { mergeEntriesFromCache, type ScopeTradePointRef } from "@/lib/distribution-tree-data";
import { resolveShowcaseMatrixPositionForEntry } from "@/lib/showcase-matrix-deficit-tasks";
import type { ShowcaseMatrixEntryDto, ShowcaseMatrixStatus } from "@/lib/showcase-matrix-api";
import { loadCachedMatrix } from "@/lib/showcase-matrix-store";
import {
  getShowcaseMatrixModelsForTradePoint,
  type ShowcaseMatrixPriorityRank,
} from "@/lib/trade-point-showcase-matrix-models";

export type DistributionCoverage = {
  planCount: number;
  factCount: number;
  deficitCount: number;
  quantitativePct: number | null;
  qualitativePct: number | null;
  dataCoveragePct: number | null;
  tradePointsTotal: number;
  tradePointsWithData: number;
  lastUpdatedAt: string | null;
};

export type AnalyticsPlanPosition = {
  targetId: string;
  name: string;
  valueWeight: number;
};

export type DistributionMetricsContext = {
  planModels: readonly AnalyticsPlanPosition[];
  entries: readonly ShowcaseMatrixEntryDto[];
};

export type DistributionAnalyticsRow<TDrilldown = unknown> = {
  key: string;
  label: string;
  coverage: DistributionCoverage;
  drilldownRef: TDrilldown;
};

export type DeficitPositionItem = {
  dealerId: string;
  dealerName: string;
  tradePointId: string;
  tradePointName: string;
  targetId: string;
  productName: string;
  status: ShowcaseMatrixStatus | null;
};

export type ManagerAggregationOptions = {
  /** Назначения client_code → responsible user id (БД). */
  responsibleByCode?: ResponsibleByCodeMap;
  /** Подписи менеджеров по user id (если известны). */
  managerLabelByUserId?: ReadonlyMap<string, string> | Record<string, string>;
};

const MODEL_PRIORITY_WEIGHT: Record<ShowcaseMatrixPriorityRank, number> = {
  high: 1.0,
  medium: 0.66,
  low: 0.33,
};

const MS_PER_DAY = 86_400_000;

function roundPct(value: number): number {
  return Math.round(value);
}

function lookupResponsibleByCode(map: ResponsibleByCodeMap | undefined, code: string): string | undefined {
  if (!map || !code) return undefined;
  if (map instanceof Map) return map.get(code);
  return map[code];
}

function resolveManagerUserIdForDealer(
  dealer: DealerRow,
  responsibleByCode?: ResponsibleByCodeMap,
): string | null {
  if (responsibleByCode) {
    for (const code of clientAssignmentCodeCandidates(dealer)) {
      const hit = lookupResponsibleByCode(responsibleByCode, code);
      if (hit?.trim()) return hit.trim();
    }
  }
  // TODO: когда в кэше client_assignments будет стабильный responsible_user_id на всех клиентах —
  // убрать fallback на отображаемое имя регионального менеджера.
  const rmName = getDealerRegionalManagerDisplay(dealer).trim();
  if (rmName && rmName !== "—") return `rm-name:${rmName}`;
  return null;
}

function managerLabelForKey(
  key: string,
  dealer: DealerRow,
  options?: ManagerAggregationOptions,
): string {
  const map = options?.managerLabelByUserId;
  if (map) {
    const fromMap = map instanceof Map ? map.get(key) : map[key as keyof typeof map];
    if (fromMap?.trim()) return fromMap.trim();
  }
  if (key.startsWith("rm-name:")) return key.slice("rm-name:".length);
  return getDealerRegionalManagerDisplay(dealer) || "Без менеджера";
}

function modelEntryStatus(
  entries: readonly ShowcaseMatrixEntryDto[],
  targetId: string,
): ShowcaseMatrixStatus | null {
  for (const e of entries) {
    if (e.targetKind !== "model" && e.targetKind !== "variant") continue;
    if (e.targetId !== targetId) continue;
    return e.status;
  }
  return null;
}

function isInstalledStatus(status: ShowcaseMatrixStatus | null): boolean {
  return status === "installed";
}

function maxIsoDate(dates: readonly (string | null | undefined)[]): string | null {
  let max: string | null = null;
  for (const d of dates) {
    const t = d?.trim();
    if (!t) continue;
    if (!max || t > max) max = t;
  }
  return max;
}

/** КД по value_weight позиций плана (установленные / вес всего плана). */
export function computeMatrixValueQualitativePct(
  planModels: readonly AnalyticsPlanPosition[],
  installedTargetIds: ReadonlySet<string>,
): number | null {
  if (planModels.length === 0) return null;
  let totalWeight = 0;
  let installedWeight = 0;
  for (const m of planModels) {
    const w = Number.isFinite(m.valueWeight) && m.valueWeight > 0 ? m.valueWeight : 0;
    if (w <= 0) continue;
    totalWeight += w;
    if (installedTargetIds.has(m.targetId)) installedWeight += w;
  }
  if (totalWeight <= 0) return null;
  return roundPct((installedWeight / totalWeight) * 100);
}

function coverageFromCounts(input: {
  planCount: number;
  factCount: number;
  qualitativePct: number | null;
  tradePointsTotal: number;
  tradePointsWithData: number;
  lastUpdatedAt: string | null;
}): DistributionCoverage {
  const planCount = Math.max(0, input.planCount);
  const factCount = Math.min(Math.max(0, input.factCount), planCount);
  const deficitCount = Math.max(0, planCount - factCount);
  const quantitativePct = planCount > 0 ? roundPct((factCount / planCount) * 100) : null;
  const dataCoveragePct =
    input.tradePointsTotal > 0
      ? roundPct((input.tradePointsWithData / input.tradePointsTotal) * 100)
      : null;

  return {
    planCount,
    factCount,
    deficitCount,
    quantitativePct,
    qualitativePct: input.qualitativePct,
    dataCoveragePct,
    tradePointsTotal: input.tradePointsTotal,
    tradePointsWithData: input.tradePointsWithData,
    lastUpdatedAt: input.lastUpdatedAt,
  };
}

function accumulateCoverageFromContexts(
  contexts: readonly DistributionMetricsContext[],
  tradePointsTotal: number,
): DistributionCoverage {
  let planCount = 0;
  let factCount = 0;
  let tradePointsWithData = 0;
  let totalWeight = 0;
  let installedWeight = 0;
  const lastDates: string[] = [];

  for (const ctx of contexts) {
    if (ctx.entries.length > 0) tradePointsWithData += 1;
    lastDates.push(...ctx.entries.map((e) => e.updatedAt));

    for (const m of ctx.planModels) {
      planCount += 1;
      const w = Number.isFinite(m.valueWeight) && m.valueWeight > 0 ? m.valueWeight : 0;
      totalWeight += w;
      if (isInstalledStatus(modelEntryStatus(ctx.entries, m.targetId))) {
        factCount += 1;
        installedWeight += w;
      }
    }
  }

  const qualitativePct =
    totalWeight > 0 ? roundPct((installedWeight / totalWeight) * 100) : null;

  return coverageFromCounts({
    planCount,
    factCount,
    qualitativePct,
    tradePointsTotal,
    tradePointsWithData,
    lastUpdatedAt: maxIsoDate(lastDates),
  });
}

function coverageForSingleTradePoint(ctx: DistributionMetricsContext): DistributionCoverage {
  return accumulateCoverageFromContexts([ctx], 1);
}

export function computeCoverageForTradePoints(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): DistributionCoverage {
  if (refs.length === 0) {
    return coverageFromCounts({
      planCount: 0,
      factCount: 0,
      qualitativePct: null,
      tradePointsTotal: 0,
      tradePointsWithData: 0,
      lastUpdatedAt: null,
    });
  }

  const contexts = refs.map((ref) => ctxBuilder(ref));
  return accumulateCoverageFromContexts(contexts, refs.length);
}

export function planPositionFromShowcaseModel(
  model: { id: string; name: string; basePriority: ShowcaseMatrixPriorityRank },
  valueWeightOverride?: number,
): AnalyticsPlanPosition {
  return {
    targetId: model.id,
    name: model.name,
    valueWeight: valueWeightOverride ?? MODEL_PRIORITY_WEIGHT[model.basePriority],
  };
}

/** Контекст по умолчанию: план из getShowcaseMatrixModelsForTradePoint, факт из кэша матрицы. */
export function defaultDistributionMetricsContext(ref: ScopeTradePointRef): DistributionMetricsContext {
  const models = getShowcaseMatrixModelsForTradePoint(
    ref.dealer.id,
    ref.point.id,
    ref.dealer.clientCategory,
  );
  return {
    planModels: models.map((m) => planPositionFromShowcaseModel(m)),
    entries: loadCachedMatrix(ref.point.id),
  };
}

export function aggregateByTradePoint(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): DistributionAnalyticsRow<ScopeTradePointRef>[] {
  return refs.map((ref) => {
    const coverage = coverageForSingleTradePoint(ctxBuilder(ref));
    const label = ref.point.name?.trim() || ref.point.id;
    return {
      key: ref.point.id,
      label,
      coverage,
      drilldownRef: ref,
    };
  });
}

export function aggregateByModel(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): DistributionAnalyticsRow<{ targetId: string; refs: ScopeTradePointRef[] }>[] {
  const byModel = new Map<
    string,
    { name: string; refs: ScopeTradePointRef[]; planTp: number; factTp: number; weights: number[]; installedWeights: number[] }
  >();

  const ctxByTp = new Map<string, DistributionMetricsContext>();

  for (const ref of refs) {
    const ctx = ctxBuilder(ref);
    ctxByTp.set(ref.point.id, ctx);
    for (const m of ctx.planModels) {
      let row = byModel.get(m.targetId);
      if (!row) {
        row = { name: m.name, refs: [], planTp: 0, factTp: 0, weights: [], installedWeights: [] };
        byModel.set(m.targetId, row);
      }
      if (!row.refs.some((r) => r.point.id === ref.point.id)) row.refs.push(ref);
      row.planTp += 1;
      const installed = isInstalledStatus(modelEntryStatus(ctx.entries, m.targetId));
      if (installed) row.factTp += 1;
      row.weights.push(m.valueWeight);
      if (installed) row.installedWeights.push(m.valueWeight);
    }
  }

  const out: DistributionAnalyticsRow<{ targetId: string; refs: ScopeTradePointRef[] }>[] = [];
  for (const [targetId, row] of Array.from(byModel.entries())) {
    const planCount = row.planTp;
    const factCount = row.factTp;
    const totalWeight = row.weights.reduce((s: number, w: number) => s + (w > 0 ? w : 0), 0);
    const installedWeight = row.installedWeights.reduce((s: number, w: number) => s + (w > 0 ? w : 0), 0);
    const qualitativePct = totalWeight > 0 ? roundPct((installedWeight / totalWeight) * 100) : null;
    out.push({
      key: targetId,
      label: row.name,
      coverage: coverageFromCounts({
        planCount,
        factCount,
        qualitativePct,
        tradePointsTotal: row.refs.length,
        tradePointsWithData: row.refs
          .map((r: ScopeTradePointRef) => ctxByTp.get(r.point.id)!)
          .filter((c: DistributionMetricsContext) => c.entries.length > 0).length,
        lastUpdatedAt: maxIsoDate(
          row.refs.flatMap((r: ScopeTradePointRef) => ctxByTp.get(r.point.id)!.entries.map((e) => e.updatedAt)),
        ),
      }),
      drilldownRef: { targetId, refs: row.refs },
    });
  }

  out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  return out;
}

export function aggregateByDealer(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): DistributionAnalyticsRow<{ dealer: DealerRow; refs: ScopeTradePointRef[] }>[] {
  const byDealer = new Map<string, { dealer: DealerRow; refs: ScopeTradePointRef[] }>();
  for (const ref of refs) {
    const prev = byDealer.get(ref.dealer.id);
    if (prev) prev.refs.push(ref);
    else byDealer.set(ref.dealer.id, { dealer: ref.dealer, refs: [ref] });
  }

  const out: DistributionAnalyticsRow<{ dealer: DealerRow; refs: ScopeTradePointRef[] }>[] = [];
  for (const [dealerId, group] of Array.from(byDealer.entries())) {
    const coverage = computeCoverageForTradePoints(group.refs, ctxBuilder);
    out.push({
      key: dealerId,
      label: group.dealer.name?.trim() || dealerId,
      coverage,
      drilldownRef: group,
    });
  }

  out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  return out;
}

/** Ключ менеджера для ref (та же логика, что в aggregateByManager). */
export function resolveManagerKeyForRef(
  ref: ScopeTradePointRef,
  options?: ManagerAggregationOptions,
): string {
  return resolveManagerUserIdForDealer(ref.dealer, options?.responsibleByCode) ?? "unassigned";
}

export function aggregateByManager(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  options?: ManagerAggregationOptions,
): DistributionAnalyticsRow<{ managerKey: string; refs: ScopeTradePointRef[] }>[] {
  const byManager = new Map<string, { refs: ScopeTradePointRef[]; labelDealer: DealerRow }>();

  for (const ref of refs) {
    const managerKey = resolveManagerUserIdForDealer(ref.dealer, options?.responsibleByCode) ?? "unassigned";
    const prev = byManager.get(managerKey);
    if (prev) prev.refs.push(ref);
    else byManager.set(managerKey, { refs: [ref], labelDealer: ref.dealer });
  }

  const out: DistributionAnalyticsRow<{ managerKey: string; refs: ScopeTradePointRef[] }>[] = [];
  for (const [managerKey, group] of Array.from(byManager.entries())) {
    const label =
      managerKey === "unassigned"
        ? "Без менеджера"
        : managerLabelForKey(managerKey, group.labelDealer, options);
    out.push({
      key: managerKey,
      label,
      coverage: computeCoverageForTradePoints(group.refs, ctxBuilder),
      drilldownRef: { managerKey, refs: group.refs },
    });
  }

  out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  return out;
}

export function resolveCityLabelForRef(ref: ScopeTradePointRef): string {
  const city = ref.point.city?.trim() || ref.dealer.city?.trim();
  return city && city !== "—" && city !== "-" ? city : "Без города";
}

export function aggregateByCity(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): DistributionAnalyticsRow<{ city: string; refs: ScopeTradePointRef[] }>[] {
  const byCity = new Map<string, ScopeTradePointRef[]>();

  for (const ref of refs) {
    const city = resolveCityLabelForRef(ref);
    const list = byCity.get(city) ?? [];
    list.push(ref);
    byCity.set(city, list);
  }

  const out: DistributionAnalyticsRow<{ city: string; refs: ScopeTradePointRef[] }>[] = [];
  for (const [city, groupRefs] of Array.from(byCity.entries())) {
    out.push({
      key: city,
      label: city,
      coverage: computeCoverageForTradePoints(groupRefs, ctxBuilder),
      drilldownRef: { city, refs: groupRefs },
    });
  }

  out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  return out;
}

export function listDeficitPositions(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
): DeficitPositionItem[] {
  const out: DeficitPositionItem[] = [];

  for (const ref of refs) {
    const ctx = ctxBuilder(ref);
    const dealerName = ref.dealer.name?.trim() || ref.dealer.id;
    const tradePointName = ref.point.name?.trim() || ref.point.id;

    for (const m of ctx.planModels) {
      const status = modelEntryStatus(ctx.entries, m.targetId);
      if (isInstalledStatus(status)) continue;
      const resolved = ctx.entries.find(
        (e) =>
          (e.targetKind === "model" || e.targetKind === "variant") && e.targetId === m.targetId,
      );
      const productName = resolved
        ? resolveShowcaseMatrixPositionForEntry(resolved, ref.dealer).productName
        : m.name;
      out.push({
        dealerId: ref.dealer.id,
        dealerName,
        tradePointId: ref.point.id,
        tradePointName,
        targetId: m.targetId,
        productName,
        status,
      });
    }
  }

  out.sort((a, b) => {
    const d = a.dealerName.localeCompare(b.dealerName, "ru");
    if (d !== 0) return d;
    return a.productName.localeCompare(b.productName, "ru");
  });
  return out;
}

export function computeNetworkSummary(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext = defaultDistributionMetricsContext,
): DistributionCoverage {
  return computeCoverageForTradePoints(refs, ctxBuilder);
}

function sortByQuantitativeAsc<TDrilldown>(
  rows: readonly DistributionAnalyticsRow<TDrilldown>[],
): DistributionAnalyticsRow<TDrilldown>[] {
  return [...rows].sort((a, b) => {
    const av = a.coverage.quantitativePct ?? 101;
    const bv = b.coverage.quantitativePct ?? 101;
    if (av !== bv) return av - bv;
    return b.coverage.deficitCount - a.coverage.deficitCount;
  });
}

export function topWorstTradePoints(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  limit = 10,
): DistributionAnalyticsRow<ScopeTradePointRef>[] {
  return sortByQuantitativeAsc(aggregateByTradePoint(refs, ctxBuilder)).slice(0, Math.max(0, limit));
}

export function topWorstModels(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  limit = 10,
): DistributionAnalyticsRow<{ targetId: string; refs: ScopeTradePointRef[] }>[] {
  return sortByQuantitativeAsc(aggregateByModel(refs, ctxBuilder)).slice(0, Math.max(0, limit));
}

export function belowThresholdDealers(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  thresholdPct: number,
): DistributionAnalyticsRow<{ dealer: DealerRow; refs: ScopeTradePointRef[] }>[] {
  return aggregateByDealer(refs, ctxBuilder).filter((row) => {
    const pct = row.coverage.quantitativePct;
    return pct != null && pct < thresholdPct;
  });
}

export function staleTradePoints(
  refs: readonly ScopeTradePointRef[],
  ctxBuilder: (ref: ScopeTradePointRef) => DistributionMetricsContext,
  days: number,
): DistributionAnalyticsRow<ScopeTradePointRef>[] {
  const cutoff = Date.now() - Math.max(0, days) * MS_PER_DAY;
  return aggregateByTradePoint(refs, ctxBuilder).filter((row) => {
    const at = row.coverage.lastUpdatedAt;
    if (!at) return true;
    const ms = Date.parse(at);
    return !Number.isFinite(ms) || ms < cutoff;
  });
}

/** Entries для scope без повторного чтения кэша в агрегаторах (хелпер для UI). */
export function loadScopeMatrixEntries(refs: readonly ScopeTradePointRef[]): ShowcaseMatrixEntryDto[] {
  return mergeEntriesFromCache(refs.map((r) => r.point.id));
}
