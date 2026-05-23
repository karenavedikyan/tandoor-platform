/**
 * Единый список торговых точек для актуализации (клиентская база + manual/release).
 * Рабочий список: только неархивные клиенты; архивные ТТ скрыты, если не запрошено иное.
 * Режим `archivedTradePointsOnly`: только архив — ТТ с флагом архива у активных клиентов
 * плюс все ТТ клиентов из `archivedDealersById` (без смешения с рабочим списком).
 */

import type { ActualizationState, TradePointShowcaseActualization } from "@/lib/client-base-actualization-state";
import { computePortalSummary } from "@/lib/client-base-actualization-portal-math";
import { buildDealerBaseRowsWithActualization, mergeTradePointsForActualization } from "@/lib/client-base-actualization-data-merge";
import { getManualDealerDisplayCode, getTradePointDisplayCodeForActualization } from "@/lib/client-base-actualization-stable-ids";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { roleScopedDealerRows } from "@/lib/dealer-base-role-views";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getClientCategoryLabel, type ClientCategoryId } from "@/lib/client-category";
import {
  computeShowcasePortalOverfill,
  getRequiredShowcaseMatrixDefinitions,
  resolveShowcaseMatrixClientCategory,
  type ShowcasePortalCaps,
} from "@/lib/trade-point-showcase-matrix-required";
import { getProductById } from "@/lib/catalog-data";
import type { MergedTradePointEntry } from "@/lib/dealer-trade-points-overrides";
import { isVirtualDefaultTradePointId } from "@/lib/dealer-trade-points-overrides";
import { getDealerManagerDisplay, getDealerRegionalManagerDisplay, getDealerRopDisplay } from "@/lib/dealer-base-mock-data";

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
  hasShowcase: boolean | null;
  showcaseUpdatedAt: string | null;
  unloadingOrder: number | null;
  isArchived: boolean;
  isVirtual: boolean;
  searchHaystack: string;
};

export type BuildTradePointListOptions = {
  /** Показать ТТ с флагом архива в actualization (по умолчанию только рабочие). */
  includeArchivedTradePoints?: boolean;
  /** Режим «только архив»: в списке исключительно архивные ТТ (рабочие скрыты). */
  archivedTradePointsOnly?: boolean;
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
  if (!sh || sh.hasShowcase === null) {
    return { bucket: "not_filled", label: "Не заполнена" };
  }
  if (sh.hasShowcase === false) {
    return { bucket: "no_showcase", label: "Нет витрины" };
  }
  const summary = computePortalSummary(sh);
  const selected = sh.selectedShowcaseModels?.length ?? 0;
  const portalsDeclared =
    sh.totalPortals != null ||
    sh.entrancePortals != null ||
    sh.interiorPortals != null ||
    sh.tandoorTotalPortals != null ||
    sh.tandoorEntrancePortals != null ||
    sh.tandoorInteriorPortals != null;

  if (summary.needsPrimaryInstall) {
    return { bucket: "needs_attention", label: "Требует заполнения" };
  }
  if (!portalsDeclared || selected === 0) {
    return { bucket: "partial", label: "Заполнена частично" };
  }
  return { bucket: "has_showcase", label: "Есть витрина" };
}

function portalCapsFromShowcase(sh: TradePointShowcaseActualization | undefined): ShowcasePortalCaps {
  if (!sh) return { entrance: null, interior: null, total: null };
  return {
    entrance: sh.entrancePortals ?? sh.tandoorEntrancePortals,
    interior: sh.interiorPortals ?? sh.tandoorInteriorPortals,
    total: sh.totalPortals ?? sh.tandoorTotalPortals,
  };
}

export function countShowcaseMatrixDeficitForDealer(dealer: DealerRow, act: ActualizationState, sh: TradePointShowcaseActualization | undefined): number {
  const fields = dealerMergedFields(dealer.id, act);
  const cat = resolveShowcaseMatrixClientCategory(dealer.clientCategory, fields);
  if (!cat) return 0;
  const required = getRequiredShowcaseMatrixDefinitions(cat);
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
  const archivedOnly = options?.archivedTradePointsOnly === true;
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
      sh?.hasShowcase === true &&
      !(
        sh.totalPortals != null ||
        sh.tandoorTotalPortals != null ||
        sh.entrancePortals != null ||
        sh.interiorPortals != null
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

    const searchHaystack = buildHaystack([
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

    const dealerArchived = Boolean(act.archivedDealersById[dealer.id]);
    byTradePointId.set(tp.id, {
      tradePointId: tp.id,
      dealerId: dealer.id,
      dealer,
      point: tp,
      entry,
      tradePointDisplayCode,
      dealerClientCode,
      dealerName: dealer.name,
      tradePointName: tp.name,
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
      hasShowcase: sh?.hasShowcase ?? null,
      showcaseUpdatedAt: sh?.updatedAt ?? null,
      unloadingOrder: unloading,
      isArchived: entry.isArchived || dealerArchived,
      isVirtual: isVirtualDefaultTradePointId(dealer.id, tp.id),
      searchHaystack,
    });
  };

  const collectForDealers = (dealers: DealerRow[], keepEntry: (e: MergedTradePointEntry) => boolean): void => {
    const scoped = roleScopedDealerRows(dealers, profile);
    for (const dealer of scoped) {
      if (!archivedOnly && act.archivedDealersById[dealer.id]) continue;
      const merged = mergeTradePointsForActualization(dealer, act);
      for (const entry of merged) {
        if (!keepEntry(entry)) continue;
        pushRowForEntry(dealer, entry);
      }
    }
  };

  if (archivedOnly) {
    const activeDealers = buildDealerBaseRowsWithActualization(act, profile, { includeArchivedDealers: false });
    collectForDealers(activeDealers, (e) => e.isArchived);
    const archivedDealers = buildDealerBaseRowsWithActualization(act, profile, { includeArchivedDealers: true });
    collectForDealers(archivedDealers, () => true);
    return Array.from(byTradePointId.values());
  }

  const dealers = buildDealerBaseRowsWithActualization(act, profile, { includeArchivedDealers: false });
  collectForDealers(dealers, (e) => includeArchivedTp || !e.isArchived);
  return Array.from(byTradePointId.values());
}

/** Число неархивных ТТ в зоне ответственности (для бейджа в меню). */
export function countWorkingTradePointsForSidebar(profile: ReleaseDemoProfile, act: ActualizationState): number {
  return buildTradePointListForActualization(act, profile, { includeArchivedTradePoints: false }).length;
}
