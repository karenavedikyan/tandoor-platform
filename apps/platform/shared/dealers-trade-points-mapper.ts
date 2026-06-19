/**
 * Маппинг строк БД → `DealerRow` (Промт 348).
 * Поля, вычисляемые на клиенте в промте 349, заполняются заглушками.
 */

import {
  isClientTopTier,
  type ClientCategoryId,
} from "../client/src/lib/client-category.js";
import type {
  DealerRow,
  DealerTradePoint,
  DealerFormat,
  DealerImportanceTier,
  DealerStatus,
} from "../client/src/lib/dealer-base-mock-data.js";

export type DbDealerRow = {
  external_key: string;
  name: string;
  release_code: string | null;
  city: string | null;
  region: string | null;
  client_type: string | null;
  client_category: string | null;
  status: string | null;
  format: string | null;
  is_active: boolean;
  is_priority: boolean;
  is_closed: boolean;
  legal_entity: string | null;
  holding: string | null;
  comment: string | null;
  manager_name: string | null;
  release_address: string | null;
  client_type_label: string | null;
  release_team_id: string | null;
  release_manager_id: string | null;
};

export type DbTradePointRow = {
  external_key: string;
  dealer_external_key: string;
  name: string;
  city: string | null;
  address: string | null;
  format: string | null;
  is_active: boolean;
  is_primary: boolean;
  importance_tier: string | null;
};

function deriveImportanceTier(cat: ClientCategoryId): DealerImportanceTier {
  if (isClientTopTier(cat)) return "vip";
  if (cat === "new_client") return "growth";
  return "standard";
}

function mapTradePoint(tp: DbTradePointRow, dealerActive: boolean): DealerTradePoint {
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
    distribution: { mk: 0, vh: 0, total: 0 },
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
    productTrainingStatus: "not_required",
    isPrimary: tp.is_primary,
  };
}

export function mapDbRowsToDealerRow(dealer: DbDealerRow, tradePoints: DbTradePointRow[]): DealerRow {
  const clientCategory = (dealer.client_category?.trim() || "new_client") as ClientCategoryId;
  const importanceTier = deriveImportanceTier(clientCategory);
  const status = (dealer.status?.trim() || "активный") as DealerStatus;
  const format = (dealer.format?.trim() || "одиночный") as DealerFormat;
  const city = dealer.city?.trim() || "—";
  const rop = dealer.region?.trim() || "";
  const mgr = dealer.manager_name?.trim() || "—";
  const mappedTradePoints = tradePoints.map((tp) => mapTradePoint(tp, dealer.is_active));
  const hasProblem = dealer.client_type === "nonTarget" || dealer.is_closed;

  return {
    id: dealer.external_key,
    releaseCode: dealer.release_code?.trim() || undefined,
    releaseAddress: dealer.release_address?.trim() || undefined,
    clientTypeLabel: dealer.client_type_label?.trim() || undefined,
    name: dealer.name?.trim() || "Клиент без названия",
    city,
    region: rop || "—",
    clientCategory,
    importanceTier,
    status,
    format,
    outlets: mappedTradePoints.length,
    manager: mgr,
    regionalManager: "",
    ropName: rop,
    releaseTeamId: dealer.release_team_id?.trim() || undefined,
    releaseManagerId: dealer.release_manager_id?.trim() || undefined,
    lastActivity: "—",
    nextAction: "Актуализация данных в учётных системах (после интеграции).",
    distribution: 0,
    showcaseStatus: "—",
    hasProblem,
    comment: dealer.comment?.trim() || "",
    hasRecentActivity: dealer.is_active,
    legalEntity: dealer.legal_entity?.trim() || "—",
    holding: dealer.holding?.trim() || "—",
    tradePoints: mappedTradePoints,
    responsibles: {
      director: rop || "—",
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
      mk: 0,
      vh: 0,
      total: 0,
      checkDate: "—",
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
      summary: "Карточка упрощена для пилота Release 1 (данные из server seed).",
      who: rop || "—",
      date: "—",
      next: "—",
      state: "—",
    },
    productTrainingCompleted: false,
    productTrainingStatus: "not_required",
    indigoTrainingCandidate: isClientTopTier(clientCategory),
    indigoTrainingStatus: isClientTopTier(clientCategory) ? "recommended" : "not_required",
  };
}
