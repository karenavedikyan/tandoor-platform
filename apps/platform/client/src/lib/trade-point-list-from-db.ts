/**
 * Промт 393 — TradePointListRow[] из плоского списка БД.
 */

import type { ActualizationState } from "./client-base-actualization-state.js";
import { normalizeHasShowcase } from "./client-base-actualization-state.js";
import { computePortalSummary } from "./client-base-actualization-portal-math.js";
import type { DealerRow, DealerTradePoint } from "./dealer-base-mock-data.js";
import type { ClientCategoryId } from "./client-category.js";
import { getClientCategoryLabel } from "./client-category.js";
import {
  computeShowcasePortalOverfill,
} from "./trade-point-showcase-matrix-required.js";
import { getProductById } from "./catalog-data.js";
import type { MergedTradePointEntry } from "./dealer-trade-points-overrides.js";
import {
  deriveShowcaseBucket,
  countShowcaseMatrixDeficitForDealer,
  type TradePointListRow,
} from "./trade-point-list-for-actualization.js";
import type { ScopedTradePointDto } from "./trade-points-scoped-api.js";

function buildHaystack(parts: (string | null | undefined)[]): string {
  return parts
    .filter((x) => x != null && String(x).trim() !== "")
    .map((x) => String(x).toLowerCase())
    .join(" ");
}

function stubDealerRow(tp: ScopedTradePointDto, catalog?: DealerRow): DealerRow {
  if (catalog) return catalog;
  const clientCategory = (tp.dealerClientCategory?.trim() || "new_client") as ClientCategoryId;
  return {
    id: tp.dealerExternalKey,
    releaseCode: tp.dealerReleaseCode?.trim() || undefined,
    name: tp.dealerName,
    city: tp.dealerCity?.trim() || "—",
    region: "—",
    clientCategory,
    importanceTier: "standard",
    status: "активный",
    format: "одиночный",
    outlets: 1,
    manager: tp.managerFullName?.trim() || "—",
    regionalManager: "",
    ropName: tp.ropFullName?.trim() || "—",
    lastActivity: "—",
    nextAction: "—",
    distribution: 0,
    showcaseStatus: "—",
    hasProblem: false,
    comment: "",
    hasRecentActivity: true,
    legalEntity: "—",
    holding: "—",
    tradePoints: [],
    responsibles: {
      director: "—",
      salesManager: tp.managerFullName?.trim() || "—",
      regionalManager: "",
      assistant: "—",
    },
    contacts: { lpr: "—", buyer: "—", phone: "—", email: "—", channel: "—" },
    terms: { tandoorClub: "—", special: "—", payment: "—", edo: "—", limit: "—", bonuses: "—" },
    salesKpis: { quarterRub: "—", mkUnits: "—", vhUnits: "—", furnitureRub: "—" },
    distributionDetail: { mk: 0, vh: 0, total: 0, checkDate: "—" },
    showcase: { equipment: "—", todo: "—", status: "—", goalLink: "—" },
    competitors: { list: "—", strengths: "—", mgrComment: "—", rmComment: "—" },
    issues: { summary: "—", who: "—", date: "—", next: "—", state: "—" },
    productTrainingCompleted: false,
    productTrainingStatus: "not_required",
    indigoTrainingCandidate: false,
    indigoTrainingStatus: "not_required",
  };
}

function stubTradePoint(tp: ScopedTradePointDto): DealerTradePoint {
  return {
    id: tp.externalKey,
    name: tp.name,
    city: tp.city?.trim() || tp.dealerCity?.trim() || "—",
    address: tp.address?.trim() || "",
    format: tp.format?.trim() || "Розница / салон",
    status: tp.isActive ? "Активна" : "На контроле",
    equipment: "Данные планируются",
    hardwareStockStatus: "—",
    doorsStockStatus: "—",
    distribution: { mk: 0, vh: 0, total: 0 },
    showcaseStatus: "—",
    showcaseNeeds: "",
    lastVisitDate: "—",
    nextVisitDate: "—",
    responsibleRegionalManager: "—",
    issues: "",
    tasks: [],
    activityHistory: [],
    photos: { attached: false },
    productTrainingCompleted: false,
    productTrainingStatus: "not_required",
  };
}

export function buildTradePointListFromDb(
  tradePoints: ScopedTradePointDto[],
  act: ActualizationState,
  catalogRows?: DealerRow[],
): TradePointListRow[] {
  const catalogByKey = new Map<string, DealerRow>();
  for (const row of catalogRows ?? []) {
    catalogByKey.set(row.id, row);
  }

  const rows: TradePointListRow[] = [];

  for (const tp of tradePoints) {
    const dealer = stubDealerRow(tp, catalogByKey.get(tp.dealerExternalKey));
    const point = stubTradePoint(tp);
    const entry: MergedTradePointEntry = {
      point,
      isManual: false,
      isEdited: false,
      isArchived: false,
    };
    const sh = act.tradePointShowcaseActualizationById[point.id] ?? act.tradePointShowcaseActualizationById[tp.id];
    const { bucket, label: showcaseBucketLabel } = deriveShowcaseBucket(sh);
    const caps = {
      entrance: sh?.entrancePortals ?? sh?.tandoorEntrancePortals ?? null,
      interior: sh?.interiorPortals ?? sh?.tandoorInteriorPortals ?? null,
      total: sh?.totalPortals ?? sh?.tandoorTotalPortals ?? null,
      hardware: sh?.hardwareSections ?? null,
    };
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
    const dealerClientCode = tp.dealerReleaseCode?.trim() || "—";
    const tradePointDisplayCode = tp.externalKey;
    const mgr = tp.managerFullName?.trim() || dealer.manager?.trim() || "—";
    const rm = dealer.regionalManager?.trim() || "—";
    const rop = tp.ropFullName?.trim() || dealer.ropName?.trim() || "—";

    rows.push({
      tradePointId: point.id,
      dealerId: dealer.id,
      dealer,
      point,
      entry,
      tradePointDisplayCode,
      dealerClientCode,
      dealerName: dealer.name,
      tradePointName: point.name,
      city: point.city?.trim() || "—",
      address: point.address?.trim() || "—",
      tradePointFormatLabel: point.format?.trim() || null,
      manager: mgr,
      regionalManager: rm,
      rop,
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
      unloadingOrder: typeof dealer.distribution === "number" ? dealer.distribution : null,
      isArchived: false,
      isVirtual: false,
      searchHaystack: buildHaystack([
        point.name,
        point.city,
        point.address,
        dealer.name,
        tradePointDisplayCode,
        dealerClientCode,
        mgr,
        rm,
        rop,
      ]),
    });
  }

  return rows;
}
