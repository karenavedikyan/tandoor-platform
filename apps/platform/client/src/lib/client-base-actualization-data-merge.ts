/**
 * Слияние данных клиентской базы с ActualizationState (поверх release + localStorage overrides).
 */

import type { DealerRow, DealerFormat, DealerStatus, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import {
  type DealerTerms,
  type DealerSalesKpis,
  type DealerDistributionDetail,
  type DealerShowcaseDetail,
  type DealerCompetitorsDetail,
  type DealerIssueDetail,
  DEALER_BASE_ROWS,
  getDealerById,
  getDealerRegionalManagerDisplay,
  normalizeDealerId,
  normalizeTradePointId,
} from "@/lib/dealer-base-mock-data";
import { getDealerRowWithProfileOverrides } from "@/lib/dealer-profile-overrides";
import {
  getMergedDealerTradePoints,
  virtualDefaultTradePointId,
  type MergedTradePointEntry,
} from "@/lib/dealer-trade-points-overrides";
import { getMergedDealerLegalEntities, type MergedDealerLegalEntity } from "@/lib/dealer-legal-entities";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getSalesUserById } from "@/lib/sales-control-data";
import type {
  ActualizationState,
  ManualDealer,
  ManualTradePoint,
  TradePointActualizationOverride,
} from "@/lib/client-base-actualization-state";
import { mergeActualizationState } from "@/lib/client-base-actualization-state";
import {
  getManualDealerDisplayCode,
  getManualTradePointDisplayCode,
  isManualActualizationDealerId,
} from "@/lib/client-base-actualization-stable-ids";
import { isLegalEntityArchivedInActualization } from "@/lib/client-base-actualization-legal-entities";
import { normalizeClientCategory, getClientCategoryLabel } from "@/lib/client-category";
import { getDealerCoverDisplayUrls, getTradePointCoverDisplayUrls } from "@/lib/client-base-actualization-photos";
import {
  readCommercialBoolNull,
  readCommercialString,
} from "@/lib/dealer-commercial-characteristics";
import {
  dealerFieldsIncludeShipmentKeys,
  formatShipmentDaysForDisplay,
  normalizeManualDealerShipmentDayIdsFromFields,
} from "@/lib/dealer-shipment-days";

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return v;
}

const MANUAL_DEALER_EMPTY_TERMS: DealerTerms = {
  tandoorClub: "—",
  special: "—",
  payment: "—",
  edo: "—",
  limit: "—",
  bonuses: "—",
};

const MANUAL_DEALER_EMPTY_SALES_KPIS: DealerSalesKpis = {
  quarterRub: "—",
  mkUnits: "—",
  vhUnits: "—",
  furnitureRub: "—",
};

const MANUAL_DEALER_EMPTY_DISTRIBUTION_DETAIL: DealerDistributionDetail = {
  mk: 0,
  vh: 0,
  total: 0,
  checkDate: "—",
};

const MANUAL_DEALER_EMPTY_SHOWCASE: DealerShowcaseDetail = {
  equipment: "—",
  todo: "—",
  status: "—",
  goalLink: "—",
};

const MANUAL_DEALER_EMPTY_COMPETITORS: DealerCompetitorsDetail = {
  list: "",
  strengths: "",
  mgrComment: "",
  rmComment: "",
};

const MANUAL_DEALER_EMPTY_ISSUES: DealerIssueDetail = {
  summary: "—",
  who: "—",
  date: "—",
  next: "—",
  state: "—",
};

export function mergeDealerRowWithActualization(row: DealerRow, act: ActualizationState): DealerRow {
  const base = getDealerRowWithProfileOverrides(row);
  const baseNextAction = base.nextAction;
  const ov = act.dealerOverridesById[row.id];
  const f = (ov?.fields ?? {}) as Record<string, unknown>;
  let r: DealerRow = { ...base };

  const name = str(f.dealerName) ?? str(f.name);
  if (name) r = { ...r, name };

  const city = str(f.city);
  if (city) r = { ...r, city };

  const releaseAddress = str(f.address) ?? str(f.releaseAddress);
  if (releaseAddress) r = { ...r, releaseAddress };

  const inn = str(f.inn);
  if (inn) r = { ...r, actualizationInn: inn };

  const comment = str(f.comment) ?? str(f.note);
  if (comment !== undefined && comment !== "") r = { ...r, comment: comment ?? r.comment };

  const manager = str(f.manager) ?? str(f.salesManager);
  if (manager) {
    r = {
      ...r,
      manager,
      responsibles: { ...r.responsibles, salesManager: manager },
    };
  }

  const regionalManager = str(f.regionalManager) ?? str(f.regional_manager);
  if (regionalManager) {
    r = {
      ...r,
      regionalManager,
      responsibles: { ...r.responsibles, regionalManager },
    };
  }

  const ropName = str(f.ropName) ?? str(f.rop);
  if (ropName) {
    r = { ...r, ropName, responsibles: { ...r.responsibles, director: ropName } };
  }

  const phone = str(f.phone) ?? str(f.contactPhone);
  const email = str(f.email);
  if (phone || email) {
    r = {
      ...r,
      contacts: {
        ...r.contacts,
        ...(phone ? { phone } : {}),
        ...(email ? { email } : {}),
      },
    };
  }

  if (dealerFieldsIncludeShipmentKeys(f)) {
    const shipmentIds = normalizeManualDealerShipmentDayIdsFromFields(f);
    if (shipmentIds.length > 0) {
      r = {
        ...r,
        releaseShipmentDayIds: shipmentIds,
        nextAction: `Дни отгрузки: ${formatShipmentDaysForDisplay(shipmentIds)}`,
      };
    } else {
      r = { ...r, releaseShipmentDayIds: undefined, nextAction: baseNextAction };
    }
  }

  const uo = act.unloadingOrderByDealerId?.[row.id];
  const uoNum = num(uo) ?? num(f.unloadingOrder);
  if (uoNum != null && uoNum > 0) {
    r = { ...r, distribution: uoNum };
  }

  const catRaw = str(f.clientCategory);
  if (catRaw) {
    r = { ...r, clientCategory: normalizeClientCategory(catRaw) };
  }
  const typeLbl = str(f.clientTypeLabel);
  if (typeLbl) r = { ...r, clientTypeLabel: typeLbl };

  const stRaw = str(f.status);
  if (stRaw && ["активный", "потенциальный", "приостановлен", "требует внимания"].includes(stRaw)) {
    r = { ...r, status: stRaw as DealerStatus };
  }

  const contactPerson = str(f.contactPerson) ?? str(f.lpr);
  if (contactPerson) {
    r = { ...r, contacts: { ...r.contacts, lpr: contactPerson } };
  }

  const cf = f as Record<string, unknown>;
  if ("hasDoorWarehouse" in cf) r = { ...r, hasDoorWarehouse: readCommercialBoolNull(cf, "hasDoorWarehouse") };
  if ("doorWarehouseComment" in cf) {
    const t = readCommercialString(cf, "doorWarehouseComment").trim();
    r = { ...r, doorWarehouseComment: t || undefined };
  }
  if ("hasHardwareWarehouse" in cf) r = { ...r, hasHardwareWarehouse: readCommercialBoolNull(cf, "hasHardwareWarehouse") };
  if ("hardwareWarehouseComment" in cf) {
    const t = readCommercialString(cf, "hardwareWarehouseComment").trim();
    r = { ...r, hardwareWarehouseComment: t || undefined };
  }
  if ("isTandoorClubMember" in cf) r = { ...r, isTandoorClubMember: readCommercialBoolNull(cf, "isTandoorClubMember") };
  if ("tandoorClubComment" in cf) {
    const t = readCommercialString(cf, "tandoorClubComment").trim();
    r = { ...r, tandoorClubComment: t || undefined };
  }
  if ("hasSpecialTerms" in cf) r = { ...r, hasSpecialTerms: readCommercialBoolNull(cf, "hasSpecialTerms") };
  if ("specialTermsComment" in cf) {
    const t = readCommercialString(cf, "specialTermsComment").trim();
    r = { ...r, specialTermsComment: t || undefined };
  }
  if ("isCashbackClient" in cf) r = { ...r, isCashbackClient: readCommercialBoolNull(cf, "isCashbackClient") };
  if ("cashbackComment" in cf) {
    const t = readCommercialString(cf, "cashbackComment").trim();
    r = { ...r, cashbackComment: t || undefined };
  }
  if ("external1cCode" in cf) {
    const t = str(cf.external1cCode);
    r = { ...r, ...(t ? { external1cCode: t } : { external1cCode: undefined }) };
  }

  const cov = getDealerCoverDisplayUrls(act, row.id);
  if (cov) r = { ...r, coverPhotoUrl: cov.url, coverPhotoThumbnailUrl: cov.thumb };

  return r;
}

function tradePointFromManualActualization(m: ManualTradePoint, dealer: DealerRow): DealerTradePoint {
  const fields = (m.fields ?? {}) as Record<string, unknown>;
  const rm = getDealerRegionalManagerDisplay(dealer) || "—";
  const name = str(fields.name) ?? "Торговая точка";
  const city = str(fields.city) ?? "—";
  const address = str(fields.address) ?? "—";
  const format = str(fields.format) ?? "Розница / салон";
  return {
    id: m.id,
    name,
    city,
    address,
    format,
    releaseCode: getManualTradePointDisplayCode(m),
    status: str(fields.status) ?? "Активна",
    equipment: "—",
    hardwareStockStatus: "—",
    doorsStockStatus: "—",
    distribution: { mk: 0, vh: 0, total: 0 },
    showcaseStatus: "—",
    showcaseNeeds: "",
    lastVisitDate: "—",
    nextVisitDate: "—",
    responsibleRegionalManager: rm,
    issues: "",
    tasks: [],
    activityHistory: [],
    photos: { attached: false },
    productTrainingStatus: "not_required",
    productTrainingCompleted: false,
    contactPhone: str(fields.contactPhone) ?? str(fields.phone),
    contactEmail: str(fields.email) ?? undefined,
    contactName: str(fields.contactName),
    tpComment: str(fields.comment) ?? str(fields.tpComment),
  };
}

function applyTradePointFields(base: DealerTradePoint, fields: Record<string, unknown>): DealerTradePoint {
  const o: DealerTradePoint = { ...base };
  if (fields.name !== undefined) o.name = String(fields.name ?? o.name);
  if (fields.city !== undefined) o.city = String(fields.city ?? o.city);
  if (fields.address !== undefined) o.address = String(fields.address ?? o.address);
  if (fields.format !== undefined) o.format = String(fields.format ?? o.format);
  if (fields.status !== undefined) o.status = String(fields.status ?? o.status);
  if (fields.contactName !== undefined) o.contactName = str(fields.contactName);
  if (fields.contactPhone !== undefined) o.contactPhone = str(fields.contactPhone);
  if (fields.phone !== undefined) o.contactPhone = str(fields.phone) ?? o.contactPhone;
  if (fields.email !== undefined) {
    o.contactEmail = str(fields.email) ?? undefined;
  }
  if (fields.comment !== undefined || fields.tpComment !== undefined) {
    o.tpComment = str(fields.tpComment) ?? str(fields.comment) ?? o.tpComment;
  }
  return o;
}

function minimalTradePoint(id: string, dealer: DealerRow): DealerTradePoint {
  const rm = getDealerRegionalManagerDisplay(dealer) || "—";
  return {
    id,
    name: "Торговая точка",
    city: "—",
    address: "—",
    format: "Розница / салон",
    status: "Активна",
    equipment: "—",
    hardwareStockStatus: "—",
    doorsStockStatus: "—",
    distribution: { mk: 0, vh: 0, total: 0 },
    showcaseStatus: "—",
    showcaseNeeds: "",
    lastVisitDate: "—",
    nextVisitDate: "—",
    responsibleRegionalManager: rm,
    issues: "",
    tasks: [],
    activityHistory: [],
    photos: { attached: false },
    productTrainingStatus: "not_required",
    productTrainingCompleted: false,
  };
}

function entryFromOverride(o: TradePointActualizationOverride, dealer: DealerRow): MergedTradePointEntry {
  const base = minimalTradePoint(o.tradePointId, dealer);
  return {
    point: applyTradePointFields(base, o.fields as Record<string, unknown>),
    isManual: true,
    isEdited: true,
    isArchived: false,
  };
}

function attachTradePointCoverPhotos(entries: MergedTradePointEntry[], act: ActualizationState): MergedTradePointEntry[] {
  return entries.map((e) => {
    const u = getTradePointCoverDisplayUrls(act, e.point.id);
    if (!u) return e;
    return {
      ...e,
      point: { ...e.point, coverPhotoUrl: u.url, coverPhotoThumbnailUrl: u.thumb },
    };
  });
}

/** Торговые точки: release + LS + actualization (manual / overrides / archive). */
export function mergeTradePointsForActualization(row: DealerRow, act: ActualizationState): MergedTradePointEntry[] {
  const displayRow = mergeDealerRowWithActualization(row, act);
  const base = getMergedDealerTradePoints(displayRow, { includeArchived: true });
  const byId = new Map<string, MergedTradePointEntry>();
  for (const e of base) {
    byId.set(e.point.id, { ...e, point: { ...e.point } });
  }

  for (const m of Object.values(act.manuallyCreatedTradePointsById)) {
    if (m.dealerId !== row.id) continue;
    if (byId.has(m.id)) continue;
    const entry: MergedTradePointEntry = {
      point: tradePointFromManualActualization(m, displayRow),
      isManual: true,
      isEdited: false,
      isArchived: false,
    };
    byId.set(m.id, entry);
  }

  for (const o of Object.values(act.tradePointOverridesById)) {
    if (o.dealerId !== row.id) continue;
    const prev = byId.get(o.tradePointId);
    if (prev) {
      byId.set(o.tradePointId, {
        ...prev,
        point: applyTradePointFields(prev.point, o.fields as Record<string, unknown>),
        isEdited: true,
      });
    } else {
      byId.set(o.tradePointId, entryFromOverride(o, displayRow));
    }
  }

  for (const arch of Object.values(act.archivedTradePointsById)) {
    if (arch.dealerId !== row.id) continue;
    const prev = byId.get(arch.tradePointId);
    if (prev) {
      byId.set(arch.tradePointId, { ...prev, isArchived: true, point: { ...prev.point, status: "Архив" } });
    }
  }

  /** Актуальный человекочитаемый код ТТ для ручных точек (после overrides). */
  for (const [id, entry] of Array.from(byId.entries())) {
    const m = act.manuallyCreatedTradePointsById[id];
    if (!m || m.dealerId !== row.id) continue;
    byId.set(id, {
      ...entry,
      point: { ...entry.point, releaseCode: getManualTradePointDisplayCode(m) },
    });
  }

  const merged = attachTradePointCoverPhotos(Array.from(byId.values()), act);
  const active = merged.filter((m) => !m.isArchived);
  if (active.length > 0) return merged;

  /** У ручного клиента без ТТ не подставляем виртуальную точку из адреса дилера. */
  if (isManualActualizationDealerId(row.id)) {
    return merged;
  }

  const virtualEntry: MergedTradePointEntry = {
    point: {
      id: virtualDefaultTradePointId(row.id),
      name: "Основная торговая точка",
      city: displayRow.city?.trim() || "—",
      address: displayRow.releaseAddress?.trim() || "Адрес не указан",
      format: "Розница / салон",
      status: "Активна",
      equipment: "—",
      hardwareStockStatus: "—",
      doorsStockStatus: "—",
      distribution: { mk: 0, vh: 0, total: 0 },
      showcaseStatus: "—",
      showcaseNeeds: "",
      lastVisitDate: "—",
      nextVisitDate: "—",
      responsibleRegionalManager: getDealerRegionalManagerDisplay(displayRow) || "—",
      issues: "",
      tasks: [],
      activityHistory: [],
      photos: { attached: false },
      productTrainingStatus: "not_required",
      productTrainingCompleted: false,
      contactPhone: displayRow.contacts?.phone?.trim() || undefined,
    },
    isManual: false,
    isEdited: false,
    isArchived: false,
  };
  return attachTradePointCoverPhotos([virtualEntry, ...merged.filter((m) => m.isArchived)], act);
}

export function mergeTradePointsActiveForActualization(row: DealerRow, act: ActualizationState): MergedTradePointEntry[] {
  return mergeTradePointsForActualization(row, act).filter((e) => !e.isArchived);
}

/**
 * Для списков/KPI рабочей базы: `outlets`, `tradePoints` и `format` отражают только неархивные ТТ.
 * В режиме списка «только архивные клиенты» оставляем полный merge ТТ (в т.ч. архивные точки) для карточки архива.
 */
export function applyDealerRowTradePointOutletProjection(
  row: DealerRow,
  act: ActualizationState,
  archivedDealerListMode: boolean,
): DealerRow {
  const merged = mergeTradePointsForActualization(row, act);
  const slice = archivedDealerListMode ? merged : merged.filter((e) => !e.isArchived);
  const points = slice.map((e) => e.point);
  const outlets = points.length;
  const format: DealerFormat = outlets > 1 ? "сетевой" : "одиночный";
  return { ...row, tradePoints: points, outlets, format };
}

/** Юрлица: база из LS+паспорт + overrides/archived из actualization. */
export function mergeLegalEntitiesForActualization(row: DealerRow, act: ActualizationState): MergedDealerLegalEntity[] {
  const base = isManualActualizationDealerId(row.id) ? [] : getMergedDealerLegalEntities(row);
  const st = act.legalEntityOverridesByDealerId[row.id];

  const isArchived = (entityId: string) => isLegalEntityArchivedInActualization(act, row.id, entityId);

  if (!st) {
    return base.map((e) => (isArchived(e.id) ? { ...e, status: "archived" as const } : e));
  }

  const overrides = st.overridesById ?? {};

  const knownIds = new Set(base.map((e) => e.id));
  const extra: MergedDealerLegalEntity[] = [];

  for (const [id, raw] of Object.entries(overrides)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    if (!knownIds.has(id)) {
      const name = str(o.name);
      if (!name) continue;
      const archivedFlag = isArchived(id);
      const stFromO = str(o.status) as MergedDealerLegalEntity["status"];
      extra.push({
        id,
        name,
        inn: str(o.inn),
        kpp: str(o.kpp),
        ogrn: str(o.ogrn),
        legalAddress: str(o.legalAddress),
        actualAddress: str(o.actualAddress),
        internalCode: str(o.internalCode) || undefined,
        entityType: str(o.entityType) || undefined,
        primaryContact: str(o.primaryContact) || undefined,
        phone: str(o.phone) || undefined,
        email: str(o.email) || undefined,
        status: archivedFlag ? "archived" : stFromO === "archived" ? "archived" : "additional",
        comment: str(o.comment),
        createdAt: str(o.createdAt) ?? new Date().toISOString(),
        updatedAt: str(o.updatedAt) ?? new Date().toISOString(),
        updatedBy: str(o.updatedBy) ?? "",
        updatedByName: str(o.updatedByName) ?? "",
        isPassportSeed: false,
      });
      knownIds.add(id);
    }
  }

  const mergedBase = base.map((e) => {
    const o = overrides[e.id];
    const archivedFlag = isArchived(e.id);
    if (!o || typeof o !== "object" || Array.isArray(o)) {
      return archivedFlag ? { ...e, status: "archived" as const } : e;
    }
    const rec = o as Record<string, unknown>;
    return {
      ...e,
      name: str(rec.name) ?? e.name,
      inn: str(rec.inn) ?? e.inn,
      kpp: str(rec.kpp) ?? e.kpp,
      ogrn: str(rec.ogrn) ?? e.ogrn,
      legalAddress: str(rec.legalAddress) ?? e.legalAddress,
      actualAddress: str(rec.actualAddress) ?? e.actualAddress,
      comment: str(rec.comment) ?? e.comment,
      internalCode: str(rec.internalCode) || e.internalCode,
      entityType: str(rec.entityType) || e.entityType,
      primaryContact: str(rec.primaryContact) || e.primaryContact,
      phone: str(rec.phone) || e.phone,
      email: str(rec.email) || e.email,
      status: archivedFlag ? ("archived" as const) : e.status,
    } as MergedDealerLegalEntity;
  });

  return [...mergedBase, ...extra];
}

const DEALER_STATUS_SET = new Set<string>(["активный", "потенциальный", "приостановлен", "требует внимания"]);

function parseDealerStatus(v: unknown): DealerStatus {
  const s = str(v);
  if (s && DEALER_STATUS_SET.has(s)) return s as DealerStatus;
  return "активный";
}

/** Собрать DealerRow из записи manual dealer (актуализация). */
export function manualDealerToRow(m: ManualDealer, profile: ReleaseDemoProfile): DealerRow {
  const f = (m.fields ?? {}) as Record<string, unknown>;
  const name = str(f.name) ?? "Новый клиент";
  const city = str(f.city) ?? "—";
  const managerName = str(f.manager) ?? "";
  const rm = str(f.regionalManager) ?? "";
  const rop = str(f.ropName) ?? "";
  const mgrUserIdRaw = str(f.managerUserId) ?? profile.personaUserId;
  const mgrUser = getSalesUserById(mgrUserIdRaw) ?? getSalesUserById(profile.personaUserId);
  const teamId = mgrUser?.teamId ?? getSalesUserById(profile.personaUserId)?.teamId;
  const releaseManagerId = str(f.releaseManagerId) ?? mgrUser?.id ?? profile.personaUserId;
  const releaseTeamId = str(f.releaseTeamId) ?? teamId;

  const shipmentDayIds = normalizeManualDealerShipmentDayIdsFromFields(f);
  const shipmentDaysLine =
    shipmentDayIds.length > 0 ? `Дни отгрузки: ${formatShipmentDaysForDisplay(shipmentDayIds)}` : "";
  const routeLine = str(f.routeLabel) ? `Маршрут: ${String(f.routeLabel)}` : "";
  const nextActionFromLogistics = [shipmentDaysLine, routeLine].filter(Boolean).join(" · ") || "—";

  const clientCategory = normalizeClientCategory(str(f.clientCategory));
  const status = parseDealerStatus(f.status);
  const typeLabel = str(f.clientTypeLabel) ?? getClientCategoryLabel(clientCategory);

  const row: DealerRow = {
    id: m.id,
    name,
    city,
    hasDoorWarehouse: readCommercialBoolNull(f, "hasDoorWarehouse"),
    doorWarehouseComment: readCommercialString(f, "doorWarehouseComment").trim() || undefined,
    hasHardwareWarehouse: readCommercialBoolNull(f, "hasHardwareWarehouse"),
    hardwareWarehouseComment: readCommercialString(f, "hardwareWarehouseComment").trim() || undefined,
    isTandoorClubMember: readCommercialBoolNull(f, "isTandoorClubMember"),
    tandoorClubComment: readCommercialString(f, "tandoorClubComment").trim() || undefined,
    hasSpecialTerms: readCommercialBoolNull(f, "hasSpecialTerms"),
    specialTermsComment: readCommercialString(f, "specialTermsComment").trim() || undefined,
    isCashbackClient: readCommercialBoolNull(f, "isCashbackClient"),
    cashbackComment: readCommercialString(f, "cashbackComment").trim() || undefined,
    external1cCode: str(f.external1cCode),
    region: str(f.region) ?? city,
    releaseAddress: str(f.address),
    releaseCode: getManualDealerDisplayCode(m),
    clientTypeLabel: typeLabel,
    clientCategory,
    importanceTier: "baseline",
    status,
    format: "одиночный",
    outlets: 0,
    manager: managerName || mgrUser?.name || "—",
    regionalManager: rm,
    ropName: rop,
    releaseTeamId,
    releaseManagerId,
    lastActivity: "—",
    nextAction: nextActionFromLogistics,
    distribution: num(f.unloadingOrder) ?? 0,
    showcaseStatus: "—",
    hasProblem: false,
    comment: str(f.comment) ?? "",
    hasRecentActivity: false,
    actualizationInn: str(f.inn),
    legalEntity: "",
    holding: "—",
    tradePoints: [],
    releaseShipmentDayIds: shipmentDayIds.length > 0 ? shipmentDayIds : undefined,
    responsibles: {
      director: rop || "—",
      salesManager: managerName || mgrUser?.name || "—",
      regionalManager: rm || "—",
      assistant: "—",
    },
    contacts: {
      lpr: str(f.contactPerson) ?? str(f.lpr) ?? "—",
      buyer: "—",
      phone: str(f.phone) ?? "—",
      email: str(f.email) ?? "—",
      channel: "—",
    },
    terms: { ...MANUAL_DEALER_EMPTY_TERMS },
    salesKpis: { ...MANUAL_DEALER_EMPTY_SALES_KPIS },
    distributionDetail: { ...MANUAL_DEALER_EMPTY_DISTRIBUTION_DETAIL },
    showcase: { ...MANUAL_DEALER_EMPTY_SHOWCASE },
    competitors: { ...MANUAL_DEALER_EMPTY_COMPETITORS },
    issues: { ...MANUAL_DEALER_EMPTY_ISSUES },
    productTrainingStatus: "not_required",
    productTrainingCompleted: false,
    indigoTrainingCandidate: false,
  };
  return row;
}

export function resolveDealerRowForCard(dealerIdRaw: string, act: ActualizationState, profile: ReleaseDemoProfile): DealerRow | undefined {
  const id = normalizeDealerId(dealerIdRaw);
  const base = getDealerById(id);
  if (base) return mergeDealerRowWithActualization(base, act);
  const manual = act.manuallyCreatedDealersById[id];
  if (manual) return mergeDealerRowWithActualization(manualDealerToRow(manual, profile), act);
  return undefined;
}

export type BuildDealerBaseRowsOptions = {
  /**
   * `true` — режим «Архив» в клиентской базе: в списке **только** клиенты из `archivedDealersById`.
   * `false` / не задано — рабочая база: архивные клиенты **скрыты**.
   */
  includeArchivedDealers?: boolean;
  /**
   * `true` — режим «Корзина» в клиентской базе: в списке **только** клиенты из
   * `trashedDealersById`. По умолчанию (Промт 45) корзинные клиенты НЕ видны
   * ни в рабочем, ни в архивном списке — корзина живёт на отдельной странице.
   */
  includeTrashedDealers?: boolean;
  /** Подмена статического `DEALER_BASE_ROWS` (например, после фильтра по видимым кодам из БД). */
  releaseDealerRows?: DealerRow[];
};

/** Строки для клиентской базы: manual сверху, затем release с merge. По умолчанию только рабочие (не архив, не корзина). */
export function buildDealerBaseRowsWithActualization(
  act: ActualizationState,
  profile: ReleaseDemoProfile,
  opts?: BuildDealerBaseRowsOptions,
): DealerRow[] {
  const archivedListMode = opts?.includeArchivedDealers === true;
  const trashedListMode = opts?.includeTrashedDealers === true;
  const includeId = (id: string) => {
    const isArchived = Boolean(act.archivedDealersById[id]);
    const isTrashed = Boolean(act.trashedDealersById?.[id]);
    if (trashedListMode) return isTrashed;
    if (archivedListMode) return isArchived && !isTrashed;
    return !isArchived && !isTrashed;
  };

  const mapBuilt = (baseRow: DealerRow): DealerRow => {
    const mergedFields = mergeDealerRowWithActualization(baseRow, act);
    return applyDealerRowTradePointOutletProjection(mergedFields, act, archivedListMode);
  };

  const manuals = Object.values(act.manuallyCreatedDealersById)
    .filter((m) => includeId(m.id))
    .map((m) => mapBuilt(manualDealerToRow(m, profile)));
  const sourceRows = opts?.releaseDealerRows ?? DEALER_BASE_ROWS;
  const rest = sourceRows.filter((r) => includeId(r.id)).map((r) => mapBuilt(r));
  return [...manuals, ...rest];
}

/**
 * Активные строки + архивные-only (для подписей событий активности по id, которые уже в архиве клиентов).
 */
export function buildDealerBaseRowsUnionForActivityLabels(
  act: ActualizationState,
  profile: ReleaseDemoProfile,
  releaseDealerRows?: DealerRow[],
): DealerRow[] {
  const active = buildDealerBaseRowsWithActualization(act, profile, { includeArchivedDealers: false, releaseDealerRows });
  const archivedOnly = buildDealerBaseRowsWithActualization(act, profile, { includeArchivedDealers: true, releaseDealerRows });
  const byId = new Map(active.map((r) => [r.id, r]));
  for (const r of archivedOnly) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  return Array.from(byId.values());
}

/** Карточка торговой точки: дилер из actualization + merge ТТ. */
export function resolveActualizationTradePointDetail(
  rawDealerId: string,
  rawPointId: string,
  act: ActualizationState,
  profile: ReleaseDemoProfile,
): { dealer: DealerRow; point: DealerTradePoint; entry: MergedTradePointEntry } | undefined {
  const dealer = resolveDealerRowForCard(rawDealerId, act, profile);
  if (!dealer) return undefined;
  const pidTrim = rawPointId.trim();
  const merged = mergeTradePointsForActualization(dealer, act);
  const entry =
    merged.find((e) => e.point.id === pidTrim) ??
    merged.find((e) => e.point.id === normalizeTradePointId(dealer.id, pidTrim));
  if (!entry) return undefined;
  return { dealer, point: entry.point, entry };
}

export function patchActualizationState(prev: ActualizationState, patch: Partial<ActualizationState>): ActualizationState {
  return mergeActualizationState(prev, patch);
}
