import {
  deriveReleaseClientCategory,
  isClientTopTier,
  type ClientCategoryId,
} from "@/lib/client-category";
import { getReleaseClients, getReleaseClientTypeLabel, type ReleaseClient } from "@/lib/release-client-data";

/** @deprecated Используйте ClientCategoryId из client-category.ts */
export type DealerCategory = ClientCategoryId;

/** Внутренний уровень для моков (обучение / приоритет), не путать с бизнес-категорией клиента. */
export type DealerImportanceTier = "vip" | "standard" | "growth" | "baseline";

function deriveImportanceTier(cat: ClientCategoryId): DealerImportanceTier {
  if (isClientTopTier(cat)) return "vip";
  if (cat === "potential" || cat === "lead") return "growth";
  if (cat === "no_sales") return "baseline";
  return "standard";
}
export type DealerStatus = "активный" | "потенциальный" | "приостановлен" | "требует внимания";
export type DealerFormat = "сетевой" | "одиночный";

/** Статус продуктового обучения от Tandoor (мок; далее API). */
export type ProductTrainingStatus = "not_required" | "recommended" | "planned" | "completed";

/** Подборка ИНДИГО для VIP / ключевых партнёров (мок). */
export type IndigoTrainingStatus = "not_required" | "recommended" | "connected" | "in_progress" | "completed";

export type ProductTrainingFields = {
  productTrainingStatus: ProductTrainingStatus;
  productTrainingCompleted: boolean;
  productTrainingCompletedAt?: string;
  productTrainingComment?: string;
};

export type IndigoTrainingFields = {
  indigoTrainingCandidate: boolean;
  indigoTrainingStatus?: IndigoTrainingStatus;
};

export type DealerContacts = {
  lpr: string;
  buyer: string;
  phone: string;
  email: string;
  channel: string;
};

export type DealerTerms = {
  tandoorClub: string;
  special: string;
  payment: string;
  edo: string;
  limit: string;
  bonuses: string;
};

export type DealerSalesKpis = {
  quarterRub: string;
  mkUnits: string;
  vhUnits: string;
  furnitureRub: string;
};

export type DealerDistributionDetail = {
  mk: number;
  vh: number;
  total: number;
  checkDate: string;
};

export type DealerShowcaseDetail = {
  equipment: string;
  todo: string;
  status: string;
  goalLink: string;
};

export type DealerCompetitorsDetail = {
  list: string;
  strengths: string;
  mgrComment: string;
  rmComment: string;
};

export type DealerIssueDetail = {
  summary: string;
  who: string;
  date: string;
  next: string;
  state: string;
};

export type DealerResponsibles = {
  director: string;
  salesManager: string;
  regionalManager: string;
  assistant: string;
};

export type TradePointTask = {
  title: string;
  priority: "Высокий" | "Средний" | "Низкий";
  status: "Новая" | "В работе" | "Запланирована" | "Закрыта";
  due: string;
  assignee: string;
};

export type TradePointActivity = {
  text: string;
  date: string;
};

export type DealerTradePoint = {
  id: string;
  name: string;
  city: string;
  address: string;
  format: string;
  /** Статус торговой точки */
  status: string;
  equipment: string;
  hardwareStockStatus: string;
  doorsStockStatus: string;
  distribution: { mk: number; vh: number; total: number };
  showcaseStatus: string;
  showcaseNeeds: string;
  lastVisitDate: string;
  nextVisitDate: string;
  responsibleRegionalManager: string;
  issues: string;
  tasks: TradePointTask[];
  activityHistory: TradePointActivity[];
  /** Заглушка: вложения фото пока нет */
  photos: { attached: boolean };
} & ProductTrainingFields;

export type DealerRow = {
  id: string;
  /** Код клиента из Excel Release 1 (если есть). */
  releaseCode?: string;
  /** Тип клиента (как в Excel / справочнике Release 1). */
  clientTypeLabel?: string;
  /** Адрес из Excel (для списка и поиска). */
  releaseAddress?: string;
  name: string;
  city: string;
  region: string;
  /** Бизнес-категория клиента (ТОП 150 … Б/П). */
  clientCategory: ClientCategoryId;
  /** Внутренний уровень значимости (не отображать как категорию клиента). */
  importanceTier: DealerImportanceTier;
  status: DealerStatus;
  format: DealerFormat;
  outlets: number;
  manager: string;
  regionalManager: string;
  /** Команда (РОП) из Release 1 — для фильтров. */
  releaseTeamId?: string;
  /** Менеджер (id из sales-control) из Release 1 — для фильтров. */
  releaseManagerId?: string;
  lastActivity: string;
  nextAction: string;
  distribution: number;
  showcaseStatus: string;
  hasProblem: boolean;
  comment: string;
  hasRecentActivity: boolean;
  /** Карточка клиента (полная структура UI; часть полей — заглушки для пилота). */
  legalEntity: string;
  holding: string;
  tradePoints: DealerTradePoint[];
  responsibles: DealerResponsibles;
  contacts: DealerContacts;
  terms: DealerTerms;
  salesKpis: DealerSalesKpis;
  distributionDetail: DealerDistributionDetail;
  showcase: DealerShowcaseDetail;
  competitors: DealerCompetitorsDetail;
  issues: DealerIssueDetail;
} & ProductTrainingFields & IndigoTrainingFields;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapReleaseStatus(c: ReleaseClient): DealerStatus {
  if (c.isClosed || c.normalizedClientType === "closed") return "приостановлен";
  if (c.normalizedClientType === "potential") return "потенциальный";
  if (c.normalizedClientType === "nonTarget") return "требует внимания";
  return "активный";
}

function mapReleaseClientToDealerRow(c: ReleaseClient): DealerRow {
  const rop = c.ropName?.trim() || "—";
  const mgr = c.managerName?.trim() || "—";
  const city = c.city?.trim() || "—";
  const addr = c.address?.trim() || "";
  const typeLabel = c.clientType?.trim() ? c.clientType : getReleaseClientTypeLabel(c.normalizedClientType);
  const clientCategory = deriveReleaseClientCategory({
    clientType: c.clientType,
    normalizedClientType: c.normalizedClientType,
  });
  const importanceTier = deriveImportanceTier(clientCategory);
  const status = mapReleaseStatus(c);
  const mkPct = 55;
  const vhPct = 52;
  const totalPct = 54;
  const pointId = `${c.id}-01`;
  const tradePoints: DealerTradePoint[] = [
    {
      id: pointId,
      name: addr ? `Торговая точка · ${city}` : `Основная точка · ${c.name}`,
      city,
      address: addr || `г. ${city}, адрес уточняется`,
      format: "Розница / салон",
      status: c.isActive ? "Активна" : "На контроле",
      equipment: "Данные планируются",
      hardwareStockStatus: "—",
      doorsStockStatus: "—",
      distribution: { mk: mkPct, vh: vhPct, total: totalPct },
      showcaseStatus: "—",
      showcaseNeeds: "",
      lastVisitDate: "—",
      nextVisitDate: "—",
      responsibleRegionalManager: rop,
      issues: "Детальная аналитика точки — в следующих релизах.",
      tasks: [],
      activityHistory: [],
      photos: { attached: false },
      productTrainingCompleted: false,
      productTrainingStatus: isClientTopTier(clientCategory) || clientCategory === "lead" ? "recommended" : "not_required",
    },
  ];
  const hasProblem = c.normalizedClientType === "nonTarget" || c.isClosed;
  return {
    id: c.id,
    clientTypeLabel: typeLabel,
    releaseCode: c.code?.trim() || undefined,
    releaseAddress: addr || undefined,
    name: c.name?.trim() || "Клиент без названия",
    city,
    region: rop,
    clientCategory,
    importanceTier,
    status,
    format: "одиночный",
    outlets: 1,
    manager: mgr,
    regionalManager: rop,
    releaseTeamId: c.teamId,
    releaseManagerId: c.managerId,
    lastActivity: "—",
    nextAction: "Актуализация данных в учётных системах (после интеграции).",
    distribution: 0,
    showcaseStatus: "—",
    hasProblem,
    comment: hasProblem ? `Тип: ${typeLabel}` : "Без критичных отметок в пилотных данных.",
    hasRecentActivity: c.isActive,
    legalEntity: c.name?.trim() || "—",
    holding: "—",
    tradePoints,
    responsibles: {
      director: "—",
      salesManager: mgr,
      regionalManager: rop,
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
      mk: mkPct,
      vh: vhPct,
      total: totalPct,
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
      summary: "Карточка упрощена для пилота Release 1 (данные из Excel).",
      who: rop,
      date: "—",
      next: "—",
      state: "—",
    },
    productTrainingCompleted: false,
    productTrainingStatus: isClientTopTier(clientCategory) || clientCategory === "lead" ? "recommended" : "not_required",
    indigoTrainingCandidate: isClientTopTier(clientCategory),
    indigoTrainingStatus: isClientTopTier(clientCategory) ? "recommended" : "not_required",
  };
}

/** Защита от случайных дублей id в исходном Excel: уникализируем суффиксом `-dup-N`. */
function dedupeDealerIds(rows: DealerRow[]): DealerRow[] {
  const used = new Set<string>();
  for (const row of rows) {
    let id = row.id;
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${row.id}-dup-${n}`)) n += 1;
      id = `${row.id}-dup-${n}`;
      row.id = id;
      const pointSuffix = "-01";
      const newPointId = `${id}${pointSuffix}`;
      if (row.tradePoints[0]) row.tradePoints[0].id = newPointId;
    }
    used.add(id);
  }
  return rows;
}

/** Клиентская база Release 1: строки из импорта Excel (release-client-seed). */
export const DEALER_BASE_ROWS: DealerRow[] = dedupeDealerIds(
  getReleaseClients().map(mapReleaseClientToDealerRow),
);

function padLegacyDealer(n: number): string {
  return String(n).padStart(3, "0");
}

export function normalizeDealerId(raw: string): string {
  const t = raw.trim();
  if (/^\d{1,3}$/.test(t)) {
    return padLegacyDealer(parseInt(t, 10));
  }
  return t;
}

export function getDealerById(rawId: string): DealerRow | undefined {
  const id = normalizeDealerId(rawId);
  return DEALER_BASE_ROWS.find((r) => r.id === id);
}

/** Нормализует id точки: `<dealerId>-NN` или legacy `001-1` → `001-01`. */
export function normalizeTradePointId(dealerIdRaw: string, rawPointId: string): string {
  const dealerId = normalizeDealerId(dealerIdRaw);
  const t = rawPointId.trim();
  const direct = new RegExp(`^${escapeRegExp(dealerId)}-(\\d{2})$`);
  if (direct.test(t)) return t;
  const m = t.match(/^(\d{3})-(\d{1,3})$/);
  if (m && m[1] === dealerId) {
    return `${dealerId}-${String(parseInt(m[2], 10)).padStart(2, "0")}`;
  }
  if (/^\d{3}-\d{2}$/.test(t)) return t;
  return t;
}

export function getTradePointByIds(
  rawDealerId: string,
  rawPointId: string,
): { dealer: DealerRow; point: DealerTradePoint } | undefined {
  const dealer = getDealerById(rawDealerId);
  if (!dealer) return undefined;
  const normalizedPoint = normalizeTradePointId(dealer.id, rawPointId);
  const point = dealer.tradePoints.find((p) => p.id === normalizedPoint);
  if (!point) return undefined;
  return { dealer, point };
}
