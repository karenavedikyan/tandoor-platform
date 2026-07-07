/**
 * Маппинг exchange_legals_raw / exchange_stores_raw → DealerRow / DealerTradePoint для UI ЛК.
 */

import type { ClientCategoryId } from "@/lib/client-category";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";

export type OneCLegalShapeInput = {
  id_1c: string;
  name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  region: string | null;
  city: string | null;
  client_type: string | null;
  payment_form: string | null;
  phone: string | null;
  email: string | null;
  discount_code: string | null;
  discount_percent: number | null;
  responsible_manager_name: string | null;
  regional_manager_name: string | null;
  plan_sum: number | null;
  plan_retro_bonus: string | null;
};

export type OneCStoreShapeInput = {
  id_1c: string;
  address: string | null;
  name: string;
  manager_name: string | null;
  manager_phone: string | null;
  legal_entity_1c: string | null;
};

function deriveClientCategory(clientType: string | null | undefined): ClientCategoryId {
  const t = (clientType ?? "").toLowerCase();
  if (t.includes("150")) return "top150";
  if (t.includes("350")) return "top350";
  if (t.includes("500+") || t.includes("500plus")) return "top500plus";
  if (t.includes("500")) return "top500";
  return "new_client";
}

const EMPTY_TERMS = {
  tandoorClub: "—",
  special: "—",
  payment: "—",
  edo: "—",
  limit: "—",
  bonuses: "—",
};

export function build1cDealerRow(
  legal: OneCLegalShapeInput,
  opts?: { canEditDistribution?: boolean },
): DealerRow & { source1c: true; oneCDistributionCanEdit?: boolean } {
  const city = legal.city?.trim() || "—";
  const region = legal.region?.trim() || "—";
  const clientCategory = deriveClientCategory(legal.client_type);
  return {
    id: legal.id_1c,
    name: legal.name?.trim() || legal.legal_name?.trim() || "Клиент 1С",
    city,
    region,
    clientCategory,
    importanceTier: "standard",
    status: "активный",
    format: "одиночный",
    outlets: 1,
    manager: legal.responsible_manager_name?.trim() || "—",
    regionalManager: legal.regional_manager_name?.trim() || "",
    ropName: "—",
    lastActivity: "—",
    nextAction: "—",
    distribution: 0,
    showcaseStatus: "—",
    hasProblem: false,
    comment: "",
    hasRecentActivity: true,
    legalEntity: legal.legal_name?.trim() || legal.name,
    holding: "—",
    tradePoints: [],
    responsibles: {
      director: "—",
      salesManager: legal.responsible_manager_name?.trim() || "—",
      regionalManager: legal.regional_manager_name?.trim() || "",
      assistant: "—",
    },
    contacts: {
      lpr: "—",
      buyer: "—",
      phone: legal.phone?.trim() || "—",
      email: legal.email?.trim() || "—",
      channel: "—",
    },
    terms: {
      ...EMPTY_TERMS,
      payment: legal.payment_form?.trim() || "—",
    },
    salesKpis: { quarterRub: "—", mkUnits: "—", vhUnits: "—", furnitureRub: "—" },
    distributionDetail: { mk: 0, vh: 0, total: 0, checkDate: "—" },
    showcase: { equipment: "—", todo: "—", status: "—", goalLink: "—" },
    competitors: { list: "—", strengths: "—", mgrComment: "—", rmComment: "—" },
    issues: { summary: "—", who: "—", date: "—", next: "—", state: "—" },
    productTrainingCompleted: false,
    productTrainingStatus: "not_required",
    indigoTrainingCandidate: false,
    indigoTrainingStatus: "not_required",
    actualizationInn: legal.inn ?? undefined,
    clientTypeLabel: legal.client_type ?? undefined,
    source1c: true,
    oneCDistributionCanEdit: opts?.canEditDistribution,
  };
}

export function build1cPoint(store: OneCStoreShapeInput, legal: OneCLegalShapeInput): DealerTradePoint {
  const city = legal.city?.trim() || "—";
  const address = store.address?.trim() || "—";
  return {
    id: store.id_1c,
    name: store.name?.trim() || address,
    city,
    address,
    format: "ТТ",
    status: "Активна",
    equipment: "—",
    hardwareStockStatus: "—",
    doorsStockStatus: "—",
    distribution: { mk: 0, vh: 0, total: 0 },
    showcaseStatus: "—",
    showcaseNeeds: "",
    lastVisitDate: "—",
    nextVisitDate: "—",
    responsibleRegionalManager: legal.regional_manager_name?.trim() || "—",
    contactPhone: store.manager_phone ?? undefined,
    issues: "",
    tasks: [],
    activityHistory: [],
    photos: { attached: false },
    productTrainingCompleted: false,
    productTrainingStatus: "not_required",
  };
}
