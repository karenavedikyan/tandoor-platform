/**
 * Единый список торговых точек для актуализации (клиентская база + manual/release).
 * Рабочий список: только неархивные ТТ из overrides, если не запрошено иное.
 */

import type { ActualizationState, TradePointShowcaseActualization } from "./client-base-actualization-state.js";
import { normalizeHasShowcase } from "./client-base-actualization-state.js";
import { computePortalSummary } from "./client-base-actualization-portal-math.js";
import { buildDealerBaseRowsWithActualization, mergeTradePointsForActualization } from "./client-base-actualization-data-merge.js";
import { getManualDealerDisplayCode, getTradePointDisplayCodeForActualization } from "./client-base-actualization-stable-ids.js";
import type { DealerRow, DealerTradePoint } from "./dealer-base-mock-data.js";
import { roleScopedDealerRows, type DealerBaseAccessRole } from "./dealer-base-role-views.js";
import { assignmentsScopeIsActive, roleScopedDealerRowsForReal, type AssignmentsScope } from "./dealer-base-real-scope.js";
import type { OrgSnapshot } from "./use-org-snapshot.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import { getClientCategoryLabel, type ClientCategoryId } from "./client-category.js";
import {
  computeShowcasePortalOverfill,
  getRequiredShowcaseMatrixDefinitions,
  resolveShowcaseMatrixClientCategory,
  type ShowcasePortalCaps,
} from "./trade-point-showcase-matrix-required.js";
import { getProductById } from "./catalog-data.js";
import type { MergedTradePointEntry } from "./dealer-trade-points-overrides.js";
import { isVirtualDefaultTradePointId } from "./dealer-trade-points-overrides.js";
import { isDealerTrashedInRuntime, isDealerOverridesHydrated, isTradePointTrashedInRuntime } from "./dealer-overrides-runtime.js";
import { getDealerManagerDisplay, getDealerRegionalManagerDisplay, getDealerRopDisplay } from "./dealer-base-mock-data.js";
import { resolveTradePointDisplayName } from "./trade-point-display-labels.js";

export type TradePointShowcaseBucket =
  | "not_filled"
  | "no_showcase"
  | "has_showcase"
  | "partial"
  | "needs_attention";

export type TradePointListRow = {
  tradePointId: string;
  dealerId: string;
  dealer: DealerRow;
  point: DealerTradePoint;
  entry: MergedTradePointEntry;
  tradePointDisplayCode: string;
  dealerClientCode: string;
  dealerName: string;
  tradePointName: string;
  city: string;
  address: string;
  tradePointFormatLabel: string | null;
  manager: string;
  regionalManager: string;
  rop: string;
  clientCategory: ClientCategoryId;
  clientCategoryLabel: string;
  showcaseBucket: TradePointShowcaseBucket;
  showcaseBucketLabel: string;
  portalsTotal: number | null;
  modelsOnShowcaseCount: number;
  matrixDeficitCount: number;
  showcaseNewTasksCount: number;
  portalOverfill: boolean;
  portalsUnfilled: boolean;
  hasFreePortals: boolean;
  hasShowcase: boolean;
  showcaseUpdatedAt: string | null;
  unloadingOrder: number | null;
  isArchived: boolean;
  isVirtual: boolean;
  searchHaystack: string;
};

export type BuildTradePointListOptions = {
  /** Показать ТТ с флагом архива в overrides (по умолчанию только рабочие). */
  includeArchivedTradePoints?: boolean;
  /** Подмена статического `DEALER_BASE_ROWS` (релиз-сид после фильтра видимых кодов). */
  releaseDealerRows?: DealerRow[];
  /** Real-режим: scope по org snapshot вместо demo `roleScopedDealerRows`. */
  orgScope?: { snap: OrgSnapshot; access: DealerBaseAccessRole };
  assignmentsScope?: AssignmentsScope;
};

function dealerMergedFields(dealerId: string, act: ActualizationState): Record<string, unknown> {
  const manual = act.manuallyCreatedDealersById[dealerId];
  const ov = (act.dealerOverridesById[dealerId]?.fields ?? {}) as Record<string, unknown>;
  return { ...((manual?.fields ?? {}) as Record<string, unknown>), ...ov };
}

function dealerClientCodeDisplay(dealer: DealerRow, act: ActualizationState): string {
  const rel = dealer.releaseCode?.trim();
  if (rel) return rel;
  const m = act.manuallyCreatedDealersById[dealer.id];
  if (m) return getManualDealerDisplayCode(m);
  return "—";
}

function tradePointFormatFromPoint(tp: DealerTradePoint): string | null {
  const fmt = tp.format?.trim();
  return fmt || null;
}

export function deriveShowcaseBucket(sh: TradePointShowcaseActualization | undefined): {
  bucket: TradePointShowcaseBucket;
  label: string;
} {
  const has = sh ? normalizeHasShowcase(sh.hasShowcase) : true;
  if (has === false) {
    return { bucket: "no_showcase", label: "Нет витрины" };
  }
  const summary = computePortalSummary(sh);
  const selected = sh?.selectedShowcaseModels?.length ?? 0;
  const portalsDeclared =
    sh != null &&
    (sh.totalPortals != null ||
      sh.entrancePortals != null ||
      sh.interiorPortals != null ||
      sh.hardwareSections != null ||
      sh.tandoorTotalPortals != null ||
      sh.tandoorEntrancePortals != null ||
      sh.tandoorInteriorPortals != null);

  if (summary.needsPrimaryInstall) {
    return { bucket: "needs_attention", label: "Требует заполнения" };
  }
  if (!portalsDeclared || selected === 0) {
    return { bucket: "partial", label: "Заполнена частично" };
  }
  return { bucket: "has_showcase", label: "Есть витрина" };
}

function portalCapsFromShowcase(sh: TradePointShowcaseActualization | undefined): ShowcasePortalCaps {
  if (!sh) return { entrance: null, interior: null, total: null, hardware: null };
  return {
    entrance: sh.entrancePortals ?? sh.tandoorEntrancePortals,
    interior: sh.interiorPortals ?? sh.tandoorInteriorPortals,
    total: sh.totalPortals ?? sh.tandoorTotalPortals,
    hardware: sh.hardwareSections ?? null,
  };
}

export function countShowcaseMatrixDeficitForDealer(dealer: DealerRow, act: ActualizationState, sh: TradePointShowcaseActualization | undefined): number {
  const fields = dealerMergedFields(dealer.id, act);
  const cat = resolveShowcaseMatrixClientCategory(dealer.clientCategory, fields);
  if (!cat) return 0;
  const tp = dealer.tradePoints.find((p) => p.status?.trim() !== "Архив") ?? dealer.tradePoints[0];
  const required = getRequiredShowcaseMatrixDefinitions(cat, {
    dealerId: dealer.id,
    tradePointId: tp?.id ?? dealer.id,
    region: dealer.region,
    city: tp?.city ?? dealer.city,
  });
  const sel = new Set((sh?.selectedShowcaseModels ?? []).map((m) => m.productId));
  return required.filter((d) => !sel.has(d.id)).length;
}

function buildHaystack(parts: (string | null | undefined)[]): string {
  return parts
    .filter((x) => x != null && String(x).trim() !== "")
    .map((x) => String(x).toLowerCase())
    .join(" ");
}

export function buildTradePointListForActualization(
  act: ActualizationState,
  profile: ReleaseDemoProfile,
  options?: BuildTradePointListOptions,
): TradePointListRow[] {
  const includeArchivedTp = options?.includeArchivedTradePoints === true;
  const byTradePointId = new Map<string, TradePointListRow>();

  const pushRowForEntry = (dealer: DealerRow, entry: MergedTradePointEntry): void => {
    const tp = entry.point;
    const sh = act.tradePointShowcaseActualizationById[tp.id];
    const { bucket, label: showcaseBucketLabel } = deriveShowcaseBucket(sh);
    const caps = portalCapsFromShowcase(sh);
    const selected = sh?.selectedShowcaseModels ?? [];
    const portalOverfill = computeShowcasePortalOverfill(selected, caps, getProductById);
    const summary = computePortalSummary(sh);
    const portalsUnfilled =
      normalizeHasShowcase(sh?.hasShowcase) &&
      !(
        sh?.totalPortals != null ||
        sh?.tandoorTotalPortals != null ||
        sh?.entrancePortals != null ||
        sh?.interiorPortals != null ||
        sh?.hardwareSections != null
      );
    const hasFreePortals =
      (summary.entrancePotential != null && summary.entrancePotential > 0) ||
      (summary.interiorPotential != null && summary.interiorPotential > 0) ||
      (summary.freeOrCompetitor != null && summary.freeOrCompetitor > 0);

    const matrixDeficitCount = countShowcaseMatrixDeficitForDealer(dealer, act, sh);
    const showcaseNewTasksCount = (sh?.showcaseMatrixTasks ?? []).filter((t) => t.status === "new").length;
    const modelsOnShowcaseCount = selected.length;
    const portalsTotal = sh?.totalPortals ?? sh?.tandoorTotalPortals ?? null;

    const tradePointDisplayCode = getTradePointDisplayCodeForActualization(tp);
    const dealerClientCode = dealerClientCodeDisplay(dealer, act);
    const mgr = getDealerManagerDisplay(dealer);
    const rm = getDealerRegionalManagerDisplay(dealer);
    const rop = getDealerRopDisplay(dealer);
    const uo = act.unloadingOrderByDealerId?.[dealer.id];
    const unloading =
      typeof uo === "number" && Number.isFinite(uo)
        ? uo
        : typeof dealer.distribution === "number"
          ? dealer.distribution
          : null;

    const tradePointName = resolveTradePointDisplayName(dealer, tp);
    const searchHaystack = buildHaystack([
      tradePointName,
      tp.name,
      tp.city,
      tp.address,
      dealer.name,
      tradePointDisplayCode,
      dealerClientCode,
      tp.releaseCode,
      mgr,
      rm,
      rop,
    ]);

    // Корзина: ТТ корзинного клиента или сама ТТ в корзине — не показываем (Промт 45 / 422).
    if (isDealerTrashedInRuntime(dealer.id, act)) return;
    if (isTradePointTrashedInRuntime(tp.id, act)) return;
    byTradePointId.set(tp.id, {
      tradePointId: tp.id,
      dealerId: dealer.id,
      dealer,
      point: tp,
      entry,
      tradePointDisplayCode,
      dealerClientCode,
      dealerName: dealer.name,
      tradePointName: resolveTradePointDisplayName(dealer, tp),
      city: tp.city?.trim() || "—",
      address: tp.address?.trim() || "—",
      tradePointFormatLabel: tradePointFormatFromPoint(tp),
      manager: mgr || "—",
      regionalManager: rm || "—",
      rop: rop || "—",
      clientCategory: dealer.clientCategory,
      clientCategoryLabel: getClientCategoryLabel(dealer.clientCategory),
      showcaseBucket: bucket,
      showcaseBucketLabel,
      portalsTotal,
      modelsOnShowcaseCount,
      matrixDeficitCount,
      showcaseNewTasksCount,
      portalOverfill,
      portalsUnfilled,
      hasFreePortals,
      hasShowcase: normalizeHasShowcase(sh?.hasShowcase),
      showcaseUpdatedAt: sh?.updatedAt ?? null,
      unloadingOrder: unloading,
      isArchived: entry.isArchived,
      isVirtual: isVirtualDefaultTradePointId(dealer.id, tp.id),
      searchHaystack,
    });
  };

  const dealerBuildOpts = {
    releaseDealerRows: options?.releaseDealerRows,
  };

  const collectForDealers = (dealers: DealerRow[], keepEntry: (e: MergedTradePointEntry) => boolean): void => {
    let scoped: DealerRow[];
    if (options?.orgScope) {
      const { snap, access } = options.orgScope;
      const assignmentsScope = assignmentsScopeIsActive(options.assignmentsScope)
        ? options.assignmentsScope
        : undefined;
      if (access === "sales_director") {
        scoped = dealers;
      } else if (access === "team_lead") {
        scoped = roleScopedDealerRowsForReal(dealers, snap, access, { ropUserId: snap.me.id }, assignmentsScope);
      } else {
        scoped = roleScopedDealerRowsForReal(dealers, snap, access, undefined, assignmentsScope);
      }
    } else {
      scoped = roleScopedDealerRows(dealers, profile);
    }
    for (const dealer of scoped) {
      if (isDealerTrashedInRuntime(dealer.id, act)) continue;
      if (!isDealerOverridesHydrated() && act.trashedDealersById[dealer.id]) continue;
      const merged = mergeTradePointsForActualization(dealer, act);
      for (const entry of merged) {
        if (!keepEntry(entry)) continue;
        pushRowForEntry(dealer, entry);
      }
    }
  };

  const dealers = buildDealerBaseRowsWithActualization(act, profile, dealerBuildOpts);
  collectForDealers(dealers, (e) => includeArchivedTp || !e.isArchived);
  return Array.from(byTradePointId.values());
}

/** Число неархивных ТТ в зоне ответственности (для бейджа в меню). */
export function countWorkingTradePointsForSidebar(profile: ReleaseDemoProfile, act: ActualizationState): number {
  return buildTradePointListForActualization(act, profile, { includeArchivedTradePoints: false }).length;
}
