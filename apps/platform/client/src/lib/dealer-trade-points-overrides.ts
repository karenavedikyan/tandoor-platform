/**
 * Ручные торговые точки и правки ТТ (localStorage, без backend).
 */

import type { DealerRow, DealerTradePoint } from "./dealer-base-mock-data.js";
import { getDealerRegionalManagerDisplay, normalizeTradePointId } from "./dealer-base-mock-data.js";
import { getCatalogDealerById } from "./dealer-base-source.js";
import { isManualActualizationDealerId } from "./client-base-actualization-stable-ids.js";
import { canEditClientNextStep } from "./client-next-step-data.js";
import { saveTradePointFields } from "./use-dealer-field-saver.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import { userLabelFromProfile } from "./showcase-distribution-data.js";

export const DEALER_TRADE_POINTS_STORAGE_KEY = "tandoor-dealer-trade-points-v1";
export const DEALER_TRADE_POINTS_EVENT = "tandoor-dealer-trade-points-changed";

/** Стабильный id виртуальной (дефолтной) ТТ дилера без отдельно заведённых точек. */
export function virtualDefaultTradePointId(dealerId: string): string {
  return `${dealerId}-default`;
}

export function isVirtualDefaultTradePointId(dealerId: string, tradePointId: string): boolean {
  return tradePointId === virtualDefaultTradePointId(dealerId);
}

export type ManualTradePointRecord = {
  id: string;
  name: string;
  city: string;
  address: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  comment?: string;
  showcaseStatus?: string;
  shipmentDayIds?: string[];
  hasMainWarehouse?: boolean;
  hasHardwareWarehouse?: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type TradePointEditRecord = {
  name?: string;
  city?: string;
  address?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  comment?: string;
  showcaseStatus?: string;
  shipmentDayIds?: string[];
  hasMainWarehouse?: boolean;
  hasHardwareWarehouse?: boolean;
  isArchived?: boolean;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
};

export type TradePointHistoryEntry = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

export type DealerTradePointsState = {
  tradePointsByDealer: Record<string, ManualTradePointRecord[]>;
  editsByTradePoint: Record<string, TradePointEditRecord>;
  historyByDealer: Record<string, TradePointHistoryEntry[]>;
};

function emptyState(): DealerTradePointsState {
  return { tradePointsByDealer: {}, editsByTradePoint: {}, historyByDealer: {} };
}

let cachedState: DealerTradePointsState | null = null;
let cachedRaw: string | null = null;

function invalidateDealerTradePointsCache(): void {
  cachedState = null;
  cachedRaw = null;
}

function parseDealerTradePointsState(raw: string): DealerTradePointsState {
  const p = JSON.parse(raw) as Partial<DealerTradePointsState>;
  return {
    tradePointsByDealer:
      p.tradePointsByDealer && typeof p.tradePointsByDealer === "object" ? p.tradePointsByDealer : {},
    editsByTradePoint:
      p.editsByTradePoint && typeof p.editsByTradePoint === "object" ? p.editsByTradePoint : {},
    historyByDealer: p.historyByDealer && typeof p.historyByDealer === "object" ? p.historyByDealer : {},
  };
}

if (typeof window !== "undefined") {
  window.addEventListener(DEALER_TRADE_POINTS_EVENT, invalidateDealerTradePointsCache);
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key === DEALER_TRADE_POINTS_STORAGE_KEY) {
      invalidateDealerTradePointsCache();
    }
  });
}

export function tradePointKey(dealerId: string, tradePointId: string): string {
  return `${dealerId}|${tradePointId}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function formatMetaRu(iso: string, name: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return `${iso.trim()} · ${name}`;
  return `${m[3]}.${m[2]}.${m[1]} · ${name}`;
}

function pushDealerTpHistory(state: DealerTradePointsState, dealerId: string, body: string, byName: string): void {
  const at = isoNow();
  const ev: TradePointHistoryEntry = {
    id: `tph-${dealerId}-${Date.now()}`,
    at,
    meta: formatMetaRu(at, byName),
    body,
  };
  const prev = state.historyByDealer[dealerId] ?? [];
  state.historyByDealer[dealerId] = [ev, ...prev].slice(0, 120);
}

export function loadDealerTradePointsState(): DealerTradePointsState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_TRADE_POINTS_STORAGE_KEY);
    if (!raw) return emptyState();
    if (cachedState !== null && cachedRaw === raw) return cachedState;
    const parsed = parseDealerTradePointsState(raw);
    cachedState = parsed;
    cachedRaw = raw;
    return parsed;
  } catch {
    invalidateDealerTradePointsCache();
    return emptyState();
  }
}

export function saveDealerTradePointsState(state: DealerTradePointsState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_TRADE_POINTS_STORAGE_KEY, JSON.stringify(state));
  invalidateDealerTradePointsCache();
  window.dispatchEvent(new CustomEvent(DEALER_TRADE_POINTS_EVENT));
}

export function getManualTradePoints(
  dealerId: string,
  state: DealerTradePointsState = loadDealerTradePointsState(),
): ManualTradePointRecord[] {
  return [...(state.tradePointsByDealer[dealerId] ?? [])];
}

export function getTradePointEdit(
  dealerId: string,
  tradePointId: string,
  state: DealerTradePointsState = loadDealerTradePointsState(),
): TradePointEditRecord | undefined {
  return state.editsByTradePoint[tradePointKey(dealerId, tradePointId)];
}

export function canEditDealerTradePoints(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return canEditClientNextStep(profile, dealer);
}

function actorFromProfile(profile: ReleaseDemoProfile): { id: string; name: string } {
  return { id: profile.personaUserId, name: userLabelFromProfile(profile) };
}

function defaultTradePointFromManual(m: ManualTradePointRecord, dealer: DealerRow): DealerTradePoint {
  const rm = getDealerRegionalManagerDisplay(dealer) || "—";
  return {
    id: m.id,
    name: m.name,
    city: m.city,
    address: m.address,
    format: "Розница / салон",
    status: "Активна",
    equipment: "—",
    hardwareStockStatus: m.hasHardwareWarehouse ? "есть" : "—",
    doorsStockStatus: m.hasMainWarehouse ? "есть" : "—",
    distribution: { mk: 0, vh: 0, total: 0 },
    showcaseStatus: m.showcaseStatus?.trim() || "—",
    showcaseNeeds: "",
    lastVisitDate: "—",
    nextVisitDate: "—",
    responsibleRegionalManager: rm,
    issues: m.comment?.trim() || "",
    tasks: [],
    activityHistory: [],
    photos: { attached: false },
    productTrainingStatus: "not_required",
    productTrainingCompleted: false,
    contactPhone: m.contactPhone?.trim() || undefined,
    contactName: m.contactName?.trim() || undefined,
    contactEmail: m.contactEmail?.trim() || undefined,
    tpComment: m.comment?.trim() || undefined,
    shipmentDayIds: m.shipmentDayIds,
    tpHasMainWarehouse: m.hasMainWarehouse,
    tpHasHardwareWarehouse: m.hasHardwareWarehouse,
  };
}

function applyTradePointEdit(base: DealerTradePoint, edit?: TradePointEditRecord): DealerTradePoint {
  if (!edit) return { ...base };
  return {
    ...base,
    name: edit.name ?? base.name,
    city: edit.city ?? base.city,
    address: edit.address ?? base.address,
    contactName: edit.contactName ?? base.contactName,
    contactPhone: edit.contactPhone ?? base.contactPhone,
    contactEmail: edit.contactEmail ?? base.contactEmail,
    tpComment: edit.comment ?? base.tpComment,
    showcaseStatus: edit.showcaseStatus ?? base.showcaseStatus,
    shipmentDayIds: edit.shipmentDayIds ?? base.shipmentDayIds,
    tpHasMainWarehouse: edit.hasMainWarehouse ?? base.tpHasMainWarehouse,
    tpHasHardwareWarehouse: edit.hasHardwareWarehouse ?? base.tpHasHardwareWarehouse,
    hardwareStockStatus:
      edit.hasHardwareWarehouse === true ? "есть" : edit.hasHardwareWarehouse === false ? "—" : base.hardwareStockStatus,
    doorsStockStatus:
      edit.hasMainWarehouse === true ? "есть" : edit.hasMainWarehouse === false ? "—" : base.doorsStockStatus,
  };
}

export type MergedTradePointEntry = {
  point: DealerTradePoint;
  isManual: boolean;
  isEdited: boolean;
  isArchived: boolean;
};

export function getMergedDealerTradePoints(
  row: DealerRow,
  opts?: { includeArchived?: boolean },
  state: DealerTradePointsState = loadDealerTradePointsState(),
): MergedTradePointEntry[] {
  const includeArchived = opts?.includeArchived === true;
  const dealerId = row.id;
  const out: MergedTradePointEntry[] = [];
  const manualList = getManualTradePoints(dealerId, state);
  const metaKeys = new Set(["updatedAt", "updatedBy", "updatedByName"]);

  for (const seed of row.tradePoints) {
    const edit = getTradePointEdit(dealerId, seed.id, state);
    const point = applyTradePointEdit({ ...seed }, edit);
    const archived = edit?.isArchived === true;
    if (!includeArchived && archived) continue;
    const isEdited = Boolean(
      edit && Object.keys(edit).some((k) => !metaKeys.has(k) && (edit as Record<string, unknown>)[k] !== undefined),
    );
    out.push({ point, isManual: false, isEdited, isArchived: archived });
  }

  const seedIds = new Set(row.tradePoints.map((t) => t.id));
  for (const m of manualList) {
    if (seedIds.has(m.id)) continue;
    const edit = getTradePointEdit(dealerId, m.id, state);
    const base = defaultTradePointFromManual(m, row);
    const point = applyTradePointEdit(base, edit);
    const archived = edit?.isArchived === true || m.isArchived === true;
    if (!includeArchived && archived) continue;
    const isEdited = Boolean(
      edit && Object.keys(edit).some((k) => !metaKeys.has(k) && (edit as Record<string, unknown>)[k] !== undefined),
    );
    out.push({ point, isManual: true, isEdited, isArchived: archived });
  }

  return out;
}

function isFilledStr(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

/** Виртуальная (дефолтная) ТТ дилера: использовать, когда у дилера нет ни одной активной точки. */
export function buildVirtualDefaultTradePoint(dealer: DealerRow): DealerTradePoint {
  const city = isFilledStr(dealer.city) ? dealer.city.trim() : "—";
  const address = isFilledStr(dealer.releaseAddress) ? dealer.releaseAddress!.trim() : "Адрес не указан";
  const phone = isFilledStr(dealer.contacts?.phone) ? dealer.contacts.phone.trim() : undefined;
  const email = isFilledStr(dealer.contacts?.email) ? dealer.contacts.email.trim() : undefined;
  const rm = getDealerRegionalManagerDisplay(dealer) || "—";
  return {
    id: virtualDefaultTradePointId(dealer.id),
    name: "Основная торговая точка",
    city,
    address,
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
    contactPhone: phone,
    contactEmail: email,
    contactName: undefined,
    tpComment: undefined,
  };
}

/**
 * Синтетическая ТТ для аналитики дистрибуции: backend-ТТ, которой нет в локальном
 * состоянии актуализации (создана другим пользователем). Используется ТОЛЬКО для
 * подсчёта скоупа/покрытия, НЕ для справочника клиентов.
 */
export function buildSyntheticBackendTradePoint(dealer: DealerRow, tradePointId: string): DealerTradePoint {
  const base = buildVirtualDefaultTradePoint(dealer);
  return {
    ...base,
    id: tradePointId,
    name: "Точка (синхронизирована)",
    status: "Активна",
  };
}

/**
 * Объединение реальных ТТ и виртуальной дефолтной: если активных точек нет — добавляется виртуальная.
 * Виртуальная исчезает, как только появляется хотя бы одна явная активная точка.
 */
export function getEffectiveDealerTradePoints(
  row: DealerRow,
  opts?: { includeArchived?: boolean },
  state: DealerTradePointsState = loadDealerTradePointsState(),
): MergedTradePointEntry[] {
  const merged = getMergedDealerTradePoints(row, opts, state);
  const includeArchived = opts?.includeArchived === true;
  const activeCount = includeArchived
    ? merged.filter((m) => !m.isArchived).length
    : merged.length;
  if (activeCount > 0) return merged;
  if (isManualActualizationDealerId(row.id)) {
    return merged;
  }
  const virtualEntry: MergedTradePointEntry = {
    point: buildVirtualDefaultTradePoint(row),
    isManual: false,
    isEdited: false,
    isArchived: false,
  };
  return [virtualEntry, ...merged.filter((m) => includeArchived && m.isArchived)];
}

export function getResolvedTradePointByIds(
  rawDealerId: string,
  rawPointId: string,
  state: DealerTradePointsState = loadDealerTradePointsState(),
): { dealer: DealerRow; point: DealerTradePoint; entry: MergedTradePointEntry } | undefined {
  const dealer = getCatalogDealerById(rawDealerId);
  if (!dealer) return undefined;
  const trimmedRaw = rawPointId.trim();
  if (trimmedRaw === virtualDefaultTradePointId(dealer.id)) {
    const activeMerged = getMergedDealerTradePoints(dealer, { includeArchived: false }, state);
    if (activeMerged.length === 0) {
      const entry: MergedTradePointEntry = {
        point: buildVirtualDefaultTradePoint(dealer),
        isManual: false,
        isEdited: false,
        isArchived: false,
      };
      return { dealer, point: entry.point, entry };
    }
    return undefined;
  }
  const id = normalizeTradePointId(dealer.id, rawPointId);
  const merged = getMergedDealerTradePoints(dealer, { includeArchived: true }, state);
  const entry = merged.find((m) => m.point.id === id);
  if (!entry) return undefined;
  return { dealer, point: entry.point, entry };
}

export function getDealerTradePointHistoryEvents(
  dealerId: string,
  state: DealerTradePointsState = loadDealerTradePointsState(),
): TradePointHistoryEntry[] {
  return [...(state.historyByDealer[dealerId] ?? [])].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function addManualTradePoint(
  dealerId: string,
  payload: {
    name: string;
    city: string;
    address: string;
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
    comment?: string;
  },
  profile: ReleaseDemoProfile,
): string | null {
  const name = payload.name.trim();
  const city = payload.city.trim();
  const address = payload.address.trim();
  const contactName = payload.contactName.trim();
  const contactPhone = payload.contactPhone.trim();
  if (!name || !city || !address || !contactName || !contactPhone) return null;
  const state = loadDealerTradePointsState();
  const id = `${dealerId}-m${Date.now()}`;
  const now = isoNow();
  const act = actorFromProfile(profile);
  const rec: ManualTradePointRecord = {
    id,
    name,
    city,
    address,
    contactName,
    contactPhone,
    contactEmail: payload.contactEmail?.trim() || undefined,
    comment: payload.comment?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    updatedBy: act.id,
    updatedByName: act.name,
    isArchived: false,
  };
  const prev = state.tradePointsByDealer[dealerId] ?? [];
  state.tradePointsByDealer[dealerId] = [rec, ...prev];
  pushDealerTpHistory(state, dealerId, `Добавлена торговая точка: ${name}`, act.name);
  saveDealerTradePointsState(state);
  return id;
}

function resolveTradePointDisplayName(dealerId: string, tradePointId: string, state: DealerTradePointsState): string {
  const dealer = getCatalogDealerById(dealerId);
  if (!dealer) return tradePointId;
  const merged = getMergedDealerTradePoints(dealer, { includeArchived: true }, state);
  return merged.find((m) => m.point.id === tradePointId)?.point.name ?? tradePointId;
}

export async function updateTradePoint(
  dealerId: string,
  tradePointId: string,
  patch: Partial<
    Omit<TradePointEditRecord, "updatedAt" | "updatedBy" | "updatedByName" | "isArchived">
  > & { isArchived?: boolean },
  profile: ReleaseDemoProfile,
): Promise<void> {
  const state = loadDealerTradePointsState();
  const label = patch.name?.trim() || resolveTradePointDisplayName(dealerId, tradePointId, state);
  const key = tradePointKey(dealerId, tradePointId);
  const now = isoNow();
  const act = actorFromProfile(profile);
  const prevEdit = state.editsByTradePoint[key] ?? {
    updatedAt: now,
    updatedBy: act.id,
    updatedByName: act.name,
  };
  const next: TradePointEditRecord = {
    ...prevEdit,
    ...patch,
    updatedAt: now,
    updatedBy: act.id,
    updatedByName: act.name,
  };
  state.editsByTradePoint[key] = next;
  pushDealerTpHistory(state, dealerId, `Обновлена торговая точка: ${label}`, act.name);
  saveDealerTradePointsState(state);

  const fields = {
    name: next.name ?? null,
    city: next.city ?? null,
    address: next.address ?? null,
    contact_name: next.contactName ?? null,
    contact_phone: next.contactPhone ?? null,
    comment: next.comment ?? null,
    showcase_status: next.showcaseStatus ?? null,
    shipment_days: next.shipmentDayIds ? JSON.stringify(next.shipmentDayIds) : null,
    is_main_warehouse: next.hasMainWarehouse ?? null,
    is_hardware_warehouse: next.hasHardwareWarehouse ?? null,
  };
  await saveTradePointFields(tradePointId, fields, dealerId, {
    fieldLabel: "Торговая точка",
    source: "dealer-trade-points-overrides",
  });
}

export function archiveTradePoint(dealerId: string, tradePointId: string, profile: ReleaseDemoProfile): void {
  const state = loadDealerTradePointsState();
  const label = resolveTradePointDisplayName(dealerId, tradePointId, state);
  const key = tradePointKey(dealerId, tradePointId);
  const now = isoNow();
  const act = actorFromProfile(profile);
  const prevEdit = state.editsByTradePoint[key] ?? {
    updatedAt: now,
    updatedBy: act.id,
    updatedByName: act.name,
  };
  state.editsByTradePoint[key] = {
    ...prevEdit,
    isArchived: true,
    updatedAt: now,
    updatedBy: act.id,
    updatedByName: act.name,
  };
  pushDealerTpHistory(state, dealerId, `Торговая точка архивирована: ${label}`, act.name);

  const ml = state.tradePointsByDealer[dealerId] ?? [];
  const mi = ml.findIndex((m) => m.id === tradePointId);
  if (mi >= 0) {
    ml[mi] = { ...ml[mi]!, isArchived: true, updatedAt: now, updatedBy: act.id, updatedByName: act.name };
    state.tradePointsByDealer[dealerId] = ml;
  }

  saveDealerTradePointsState(state);
}
