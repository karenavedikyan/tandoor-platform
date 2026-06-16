/**
 * Адаптер БД → `DealerRow` с выравниванием под seed (`buildDealerRowsFromReleaseClients`).
 * Промт 374.
 */

import {
  deriveReleaseClientCategory,
  isClientTopTier,
  type ClientCategoryId,
} from "../../client/src/lib/client-category.js";
import type {
  DealerFormat,
  DealerImportanceTier,
  DealerRow,
  DealerStatus,
  DealerTradePoint,
} from "../../client/src/lib/dealer-base-mock-data.js";
import type { DbDealerRow, DbTradePointRow } from "../../shared/dealers-trade-points-mapper.js";
import type { DbDealerBundle } from "./db-dealers-loader.js";

const MK_PCT = 55;
const VH_PCT = 52;
const TOTAL_PCT = 54;

function deriveImportanceTier(cat: ClientCategoryId): DealerImportanceTier {
  if (isClientTopTier(cat)) return "vip";
  if (cat === "new_client") return "growth";
  return "standard";
}

function distributionCheckDate(externalKey: string): string {
  const idSum = externalKey.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return idSum % 3 === 0 ? `${12 + (idSum % 8)}.02.2026` : `${3 + (idSum % 18)}.04.2026`;
}

function mapTradePoint(
  tp: DbTradePointRow,
  dealerActive: boolean,
  clientCategory: ClientCategoryId,
): DealerTradePoint {
  return {
    id: tp.external_key,
    name: tp.name,
    city: tp.city?.trim() || "—",
    address: tp.address?.trim() || "",
    format: tp.format?.trim() || "Розница / салон",
    status: dealerActive && tp.is_active ? "Активна" : "На контроле",
    equipment: "Данные планируются",
    hardwareStockStatus: "—",
    doorsStockStatus: "—",
    distribution: { mk: MK_PCT, vh: VH_PCT, total: TOTAL_PCT },
    showcaseStatus: "—",
    showcaseNeeds: "",
    lastVisitDate: "—",
    nextVisitDate: "—",
    responsibleRegionalManager: "—",
    issues: "Детальная аналитика точки — в следующих релизах.",
    tasks: [],
    activityHistory: [],
    photos: { attached: false },
    productTrainingCompleted: false,
    productTrainingStatus:
      isClientTopTier(clientCategory) || clientCategory === "new_client" ? "recommended" : "not_required",
  };
}

export function dbDealerToDealerRow(bundle: DbDealerBundle): DealerRow {
  const dealer = bundle.dealer;
  const rop = dealer.region?.trim() || "—";
  const mgr = dealer.manager_name?.trim() || "—";
  const city = dealer.city?.trim() || "—";
  const addr = dealer.release_address?.trim() || "";
  const typeLabel = dealer.client_type_label?.trim() || dealer.client_type?.trim() || "";
  const clientCategory = (dealer.client_category?.trim() || "new_client") as ClientCategoryId;
  const importanceTier = deriveImportanceTier(clientCategory);
  const status = (dealer.status?.trim() || "активный") as DealerStatus;
  const format = (dealer.format?.trim() || "одиночный") as DealerFormat;
  const mappedTradePoints = bundle.tradePoints.map((tp) => mapTradePoint(tp, dealer.is_active, clientCategory));
  const hasProblem = dealer.client_type === "nonTarget" || dealer.is_closed;
  const outlets = mappedTradePoints.length;

  return {
    id: dealer.external_key,
    clientTypeLabel: typeLabel || undefined,
    releaseCode: dealer.release_code?.trim() || undefined,
    releaseAddress: addr || undefined,
    name: dealer.name?.trim() || "Клиент без названия",
    city,
    region: rop,
    clientCategory,
    importanceTier,
    status,
    format,
    outlets,
    manager: mgr,
    regionalManager: "",
    ropName: rop === "—" ? "" : rop,
    releaseTeamId: dealer.release_team_id?.trim() || undefined,
    releaseManagerId: dealer.release_manager_id?.trim() || undefined,
    lastActivity: "—",
    nextAction: "Актуализация данных в учётных системах (после интеграции).",
    distribution: 0,
    showcaseStatus: "—",
    hasProblem,
    comment: dealer.comment?.trim() || (hasProblem ? `Тип: ${typeLabel}` : "Без критичных отметок в пилотных данных."),
    hasRecentActivity: dealer.is_active,
    legalEntity: dealer.legal_entity?.trim() || "—",
    holding: dealer.holding?.trim() || "—",
    tradePoints: mappedTradePoints,
    responsibles: {
      director: rop === "—" ? "—" : rop,
      salesManager: mgr,
      regionalManager: "",
      assistant: "—",
    },
    contacts: {
      lpr: "—",
      buyer: "—",
      phone: "—",
      email: "—",
      channel: "—",
    },
    terms: {
      tandoorClub: "—",
      special: "—",
      payment: "—",
      edo: "—",
      limit: "—",
      bonuses: "—",
    },
    salesKpis: {
      quarterRub: "—",
      mkUnits: "—",
      vhUnits: "—",
      furnitureRub: "—",
    },
    distributionDetail: {
      mk: MK_PCT,
      vh: VH_PCT,
      total: TOTAL_PCT,
      checkDate: distributionCheckDate(dealer.external_key),
    },
    showcase: {
      equipment: "—",
      todo: "—",
      status: "—",
      goalLink: "—",
    },
    competitors: {
      list: "—",
      strengths: "—",
      mgrComment: "—",
      rmComment: "—",
    },
    issues: {
      summary: "Карточка упрощена для пилота Release 1 (данные из Excel).",
      who: rop === "—" ? "—" : rop,
      date: "—",
      next: "—",
      state: "—",
    },
    productTrainingCompleted: false,
    productTrainingStatus:
      isClientTopTier(clientCategory) || clientCategory === "new_client" ? "recommended" : "not_required",
    indigoTrainingCandidate: isClientTopTier(clientCategory),
    indigoTrainingStatus: isClientTopTier(clientCategory) ? "recommended" : "not_required",
  };
}

export function dbBundlesToDealerRows(bundles: DbDealerBundle[]): DealerRow[] {
  return bundles.map(dbDealerToDealerRow);
}

/** Нормализованная категория из DB-строки (для фильтров seed-совместимости). */
export function dbClientCategory(dealer: DbDealerRow): ClientCategoryId {
  if (dealer.client_category?.trim()) {
    return dealer.client_category.trim() as ClientCategoryId;
  }
  return deriveReleaseClientCategory({
    clientType: dealer.client_type_label ?? "",
    normalizedClientType: (dealer.client_type ?? "unknown") as never,
  });
}
