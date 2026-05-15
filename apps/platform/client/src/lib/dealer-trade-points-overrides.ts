/**
 * Ручные торговые точки и правки ТТ (localStorage, без backend).
 */

import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { getDealerById, normalizeTradePointId } from "@/lib/dealer-base-mock-data";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";

export const DEALER_TRADE_POINTS_STORAGE_KEY = "tandoor-dealer-trade-points-v1";
export const DEALER_TRADE_POINTS_EVENT = "tandoor-dealer-trade-points-changed";

export type ManualTradePointRecord = {
  id: string;
  name: string;
  city: string;
  address: string;
  contactName?: string;
  contactPhone?: string;
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
    const p = JSON.parse(raw) as Partial<DealerTradePointsState>;
    return {
      tradePointsByDealer:
        p.tradePointsByDealer && typeof p.tradePointsByDealer === "object" ? p.tradePointsByDealer : {},
      editsByTradePoint:
        p.editsByTradePoint && typeof p.editsByTradePoint === "object" ? p.editsByTradePoint : {},
      historyByDealer: p.historyByDealer && typeof p.historyByDealer === "object" ? p.historyByDealer : {},
    };
  } catch {
    return emptyState();
  }
}

export function saveDealerTradePointsState(state: DealerTradePointsState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_TRADE_POINTS_STORAGE_KEY, JSON.stringify(state));
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
  const rop = dealer.regionalManager?.trim() && dealer.regionalManager !== "—" ? dealer.regionalManager : "—";
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
    responsibleRegionalManager: rop,
    issues: m.comment?.trim() || "",
    tasks: [],
    activityHistory: [],
    photos: { attached: false },
    productTrainingStatus: "not_required",
    productTrainingCompleted: false,
    contactPhone: m.contactPhone?.trim() || undefined,
    contactName: m.contactName?.trim() || undefined,
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

export function getResolvedTradePointByIds(
  rawDealerId: string,
  rawPointId: string,
  state: DealerTradePointsState = loadDealerTradePointsState(),
): { dealer: DealerRow; point: DealerTradePoint; entry: MergedTradePointEntry } | undefined {
  const dealer = getDealerById(rawDealerId);
  if (!dealer) return undefined;
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
  const dealer = getDealerById(dealerId);
  if (!dealer) return tradePointId;
  const merged = getMergedDealerTradePoints(dealer, { includeArchived: true }, state);
  return merged.find((m) => m.point.id === tradePointId)?.point.name ?? tradePointId;
}

export function updateTradePoint(
  dealerId: string,
  tradePointId: string,
  patch: Partial<
    Omit<TradePointEditRecord, "updatedAt" | "updatedBy" | "updatedByName" | "isArchived">
  > & { isArchived?: boolean },
  profile: ReleaseDemoProfile,
): void {
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
