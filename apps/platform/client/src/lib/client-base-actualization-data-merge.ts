/**
 * Слияние данных клиентской базы с ActualizationState (поверх release + localStorage overrides).
 */

import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import {
  DEALER_BASE_ROWS,
  getDealerById,
  getDealerRegionalManagerDisplay,
  normalizeDealerId,
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
import { DEALER_SHIPMENT_DAY_LABELS, type DealerShipmentDayId } from "@/lib/dealer-shipment-days";

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t || undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return v;
}

function isShipmentDayId(v: unknown): v is DealerShipmentDayId {
  return (
    v === "monday" ||
    v === "tuesday" ||
    v === "wednesday" ||
    v === "thursday" ||
    v === "friday" ||
    v === "saturday"
  );
}

/** Слияние полей дилера из dealerOverridesById + unloadingOrder в state. */
export function mergeDealerRowWithActualization(row: DealerRow, act: ActualizationState): DealerRow {
  const base = getDealerRowWithProfileOverrides(row);
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

  const shipmentDayId = f.shipmentDayId;
  if (isShipmentDayId(shipmentDayId)) {
    r = { ...r, nextAction: `День отгрузки: ${DEALER_SHIPMENT_DAY_LABELS[shipmentDayId]}` };
  }

  const uo = act.unloadingOrderByDealerId?.[row.id];
  const uoNum = num(uo) ?? num(f.unloadingOrder);
  if (uoNum != null && uoNum > 0) {
    r = { ...r, distribution: uoNum };
  }

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

  const merged = Array.from(byId.values());
  const active = merged.filter((m) => !m.isArchived);
  if (active.length > 0) return merged;

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
  return [virtualEntry, ...merged.filter((m) => m.isArchived)];
}

export function mergeTradePointsActiveForActualization(row: DealerRow, act: ActualizationState): MergedTradePointEntry[] {
  return mergeTradePointsForActualization(row, act).filter((e) => !e.isArchived);
}

/** Юрлица: база из LS+паспорт + overrides/archived из actualization. */
export function mergeLegalEntitiesForActualization(row: DealerRow, act: ActualizationState): MergedDealerLegalEntity[] {
  const base = getMergedDealerLegalEntities(row);
  const st = act.legalEntityOverridesByDealerId[row.id];
  if (!st) return base;

  const archived = new Set(Object.keys(st.archivedById ?? {}));
  const overrides = st.overridesById ?? {};

  const knownIds = new Set(base.map((e) => e.id));
  const extra: MergedDealerLegalEntity[] = [];

  for (const [id, raw] of Object.entries(overrides)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    if (!knownIds.has(id)) {
      const name = str(o.name);
      if (!name) continue;
      extra.push({
        id,
        name,
        inn: str(o.inn),
        kpp: str(o.kpp),
        ogrn: str(o.ogrn),
        legalAddress: str(o.legalAddress),
        actualAddress: str(o.actualAddress),
        status: (str(o.status) as MergedDealerLegalEntity["status"]) === "archived" ? "archived" : "additional",
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
    if (!o || typeof o !== "object" || Array.isArray(o)) {
      return archived.has(e.id) ? { ...e, status: "archived" as const } : e;
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
      status: archived.has(e.id) ? ("archived" as const) : e.status,
    } as MergedDealerLegalEntity;
  });

  return [...mergedBase, ...extra];
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

  const template = DEALER_BASE_ROWS[0]!;
  const row: DealerRow = {
    ...template,
    id: m.id,
    name,
    city,
    region: str(f.region) ?? city,
    releaseAddress: str(f.address),
    clientCategory: "lead",
    importanceTier: "growth",
    status: "активный",
    format: "одиночный",
    outlets: 0,
    manager: managerName || mgrUser?.name || "—",
    regionalManager: rm,
    ropName: rop,
    releaseTeamId,
    releaseManagerId,
    lastActivity: "—",
    nextAction: str(f.shipmentDayLabel) ? `День отгрузки: ${String(f.shipmentDayLabel)}` : "—",
    distribution: num(f.unloadingOrder) ?? 0,
    showcaseStatus: "—",
    hasProblem: false,
    comment: str(f.comment) ?? "",
    hasRecentActivity: false,
    actualizationInn: str(f.inn),
    legalEntity: template.legalEntity,
    holding: "—",
    tradePoints: [],
    responsibles: {
      director: rop || "—",
      salesManager: managerName || mgrUser?.name || "—",
      regionalManager: rm || "—",
      assistant: "—",
    },
    contacts: {
      lpr: "—",
      buyer: "—",
      phone: str(f.phone) ?? "—",
      email: str(f.email) ?? "—",
      channel: "—",
    },
    terms: template.terms,
    salesKpis: template.salesKpis,
    distributionDetail: template.distributionDetail,
    showcase: template.showcase,
    competitors: template.competitors,
    issues: template.issues,
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

/** Строки для клиентской базы: manual сверху, затем release с merge. */
export function buildDealerBaseRowsWithActualization(act: ActualizationState, profile: ReleaseDemoProfile): DealerRow[] {
  const manuals = Object.values(act.manuallyCreatedDealersById).map((m) => mergeDealerRowWithActualization(manualDealerToRow(m, profile), act));
  const rest = DEALER_BASE_ROWS.map((r) => mergeDealerRowWithActualization(r, act));
  return [...manuals, ...rest];
}

export function patchActualizationState(prev: ActualizationState, patch: Partial<ActualizationState>): ActualizationState {
  return mergeActualizationState(prev, patch);
}
