/**
 * Гидрация оверрайдов дилера из API в localStorage-кеши (Промт 113).
 */

import type { DealerOverrideRow } from "../../../shared/dealer-overrides-types";
import type { TradePointOverrideRow } from "../../../shared/trade-point-overrides-types";
import type { DealerShipmentDayId } from "./dealer-shipment-days.js";
import {
  DEALER_PROFILE_OVERRIDES_EVENT,
  DEALER_PROFILE_OVERRIDES_STORAGE_KEY,
  type DealerProfileOverride,
  type DealerProfileOverridesState,
} from "./dealer-profile-overrides.js";
import {
  DEALER_UNLOADING_ORDER_EVENT,
  DEALER_UNLOADING_ORDER_STORAGE_KEY,
} from "./dealer-unloading-order-storage.js";
import {
  DEALER_REGIONAL_MANAGER_OVERRIDES_EVENT,
  DEALER_REGIONAL_MANAGER_OVERRIDES_STORAGE_KEY,
  type DealerRegionalManagerOverridesState,
} from "./dealer-regional-manager-overrides.js";
import {
  DEALER_ROP_OVERRIDES_EVENT,
  DEALER_ROP_OVERRIDES_STORAGE_KEY,
  type DealerRopOverridesState,
} from "./dealer-rop-overrides.js";
import {
  TP_ROP_RM_OVERRIDES_EVENT,
  TP_ROP_RM_OVERRIDES_STORAGE_KEY,
  type TradePointRopRmOverridesState,
} from "./trade-point-rop-rm-overrides.js";
import {
  DEALER_TRADE_POINTS_EVENT,
  DEALER_TRADE_POINTS_STORAGE_KEY,
  tradePointKey,
  type DealerTradePointsState,
  type TradePointEditRecord,
} from "./dealer-trade-points-overrides.js";
import { dealerProductTrainingStorageKey } from "./training-attention.js";
import { tradePointProductTrainingStorageKey } from "./training-attention.js";
import {
  fetchDealerOverridesList,
  notifyDealerOverridesHydrated,
} from "./dealer-overrides-api.js";
import {
  fetchTradePointOverridesList,
  notifyTradePointOverridesHydrated,
} from "./trade-point-overrides-api.js";
import { applyDealerOverridesRuntime, applyTradePointOverridesRuntime } from "./dealer-overrides-runtime.js";
import { pushOverridesTrace } from "./overrides-trace-log.js";

function profileFromOverride(row: DealerOverrideRow): DealerProfileOverride | null {
  const has =
    row.name ||
    row.city ||
    row.contact_name ||
    row.contact_phone ||
    row.contact_email ||
    row.general_comment;
  if (!has) return null;
  return {
    displayName: row.name ?? undefined,
    city: row.city ?? undefined,
    mainContactName: row.contact_name ?? undefined,
    mainContactPhone: row.contact_phone ?? undefined,
    mainContactEmail: row.contact_email ?? undefined,
    comment: row.general_comment ?? undefined,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? "",
    updatedByName: "",
  };
}

function applyDealerProfileHydration(overrides: DealerOverrideRow[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  let state: DealerProfileOverridesState = { overridesByDealer: {}, historyByDealer: {} };
  try {
    const raw = window.localStorage.getItem(DEALER_PROFILE_OVERRIDES_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<DealerProfileOverridesState>;
      state = {
        overridesByDealer: p.overridesByDealer ?? {},
        historyByDealer: p.historyByDealer ?? {},
      };
    }
  } catch {
    /* ignore */
  }
  for (const row of overrides) {
    const next = profileFromOverride(row);
    if (next) state.overridesByDealer[row.dealer_id] = next;
  }
  window.localStorage.setItem(DEALER_PROFILE_OVERRIDES_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_PROFILE_OVERRIDES_EVENT));
}

function applyUnloadingOrderHydration(overrides: DealerOverrideRow[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  type St = { orderByDealer: Record<string, number>; historyByDealer: Record<string, unknown[]> };
  let state: St = { orderByDealer: {}, historyByDealer: {} };
  try {
    const raw = window.localStorage.getItem(DEALER_UNLOADING_ORDER_STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as St;
  } catch {
    /* ignore */
  }
  for (const row of overrides) {
    if (!row.unloading_order) continue;
    const n = Number(row.unloading_order);
    if (Number.isFinite(n) && n > 0) state.orderByDealer[row.dealer_id] = Math.floor(n);
  }
  window.localStorage.setItem(DEALER_UNLOADING_ORDER_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_UNLOADING_ORDER_EVENT));
}

function applyRegionalManagerHydration(overrides: DealerOverrideRow[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  let state: DealerRegionalManagerOverridesState = { byDealerId: {}, historyByDealer: {} };
  try {
    const raw = window.localStorage.getItem(DEALER_REGIONAL_MANAGER_OVERRIDES_STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as DealerRegionalManagerOverridesState;
  } catch {
    /* ignore */
  }
  for (const row of overrides) {
    if (!row.regional_manager_id) continue;
    state.byDealerId[row.dealer_id] = {
      userId: row.regional_manager_id,
      displayName: row.regional_manager_name ?? "",
      updatedAt: row.updated_at,
      updatedBy: row.updated_by ?? "",
      updatedByName: row.regional_manager_name ?? "",
    };
  }
  window.localStorage.setItem(DEALER_REGIONAL_MANAGER_OVERRIDES_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_REGIONAL_MANAGER_OVERRIDES_EVENT));
}

function applyRopHydration(overrides: DealerOverrideRow[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  let state: DealerRopOverridesState = { byDealerId: {} };
  try {
    const raw = window.localStorage.getItem(DEALER_ROP_OVERRIDES_STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as DealerRopOverridesState;
  } catch {
    /* ignore */
  }
  for (const row of overrides) {
    if (!row.rop_id) continue;
    state.byDealerId[row.dealer_id] = {
      userId: row.rop_id,
      displayName: row.rop_name ?? "",
      updatedAt: row.updated_at,
      updatedBy: row.updated_by ?? "",
      updatedByName: row.rop_name ?? "",
    };
  }
  window.localStorage.setItem(DEALER_ROP_OVERRIDES_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_ROP_OVERRIDES_EVENT));
}

function applyTradePointRopRmHydration(overrides: TradePointOverrideRow[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  let state: TradePointRopRmOverridesState = { byTpId: {} };
  try {
    const raw = window.localStorage.getItem(TP_ROP_RM_OVERRIDES_STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as TradePointRopRmOverridesState;
  } catch {
    /* ignore */
  }
  for (const row of overrides) {
    if (!row.rop_id && !row.regional_manager_id) continue;
    state.byTpId[row.tp_id] = {
      ropId: row.rop_id,
      ropName: row.rop_name,
      regionalManagerId: row.regional_manager_id,
      regionalManagerName: row.regional_manager_name,
      updatedAt: row.updated_at,
    };
  }
  window.localStorage.setItem(TP_ROP_RM_OVERRIDES_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(TP_ROP_RM_OVERRIDES_EVENT));
}

function applyDealerTrainingHydration(
  training: { dealer_id: string; product_training_done: boolean; needs_new_employees_training: boolean }[],
): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  for (const t of training) {
    sessionStorage.setItem(dealerProductTrainingStorageKey(t.dealer_id), t.product_training_done ? "1" : "0");
  }
}

function tpEditFromOverride(row: TradePointOverrideRow): TradePointEditRecord | null {
  const has =
    row.name ||
    row.city ||
    row.address ||
    row.contact_name ||
    row.contact_phone ||
    row.comment ||
    row.showcase_status ||
    row.shipment_days ||
    row.is_main_warehouse != null ||
    row.is_hardware_warehouse != null;
  if (!has || !row.dealer_id) return null;
  let shipmentDayIds: string[] | undefined;
  if (row.shipment_days) {
    try {
      const parsed = JSON.parse(row.shipment_days) as unknown;
      if (Array.isArray(parsed)) shipmentDayIds = parsed.map(String);
    } catch {
      shipmentDayIds = row.shipment_days.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return {
    name: row.name ?? undefined,
    city: row.city ?? undefined,
    address: row.address ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    comment: row.comment ?? undefined,
    showcaseStatus: row.showcase_status ?? undefined,
    shipmentDayIds: shipmentDayIds as DealerShipmentDayId[] | undefined,
    hasMainWarehouse: row.is_main_warehouse ?? undefined,
    hasHardwareWarehouse: row.is_hardware_warehouse ?? undefined,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? "",
    updatedByName: "",
  };
}

function applyTradePointEditsHydration(overrides: TradePointOverrideRow[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  let state: DealerTradePointsState = {
    tradePointsByDealer: {},
    editsByTradePoint: {},
    historyByDealer: {},
  };
  try {
    const raw = window.localStorage.getItem(DEALER_TRADE_POINTS_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<DealerTradePointsState>;
      state = {
        tradePointsByDealer: p.tradePointsByDealer ?? {},
        editsByTradePoint: p.editsByTradePoint ?? {},
        historyByDealer: p.historyByDealer ?? {},
      };
    }
  } catch {
    /* ignore */
  }
  for (const row of overrides) {
    if (!row.dealer_id) continue;
    const edit = tpEditFromOverride(row);
    if (edit) state.editsByTradePoint[tradePointKey(row.dealer_id, row.tp_id)] = edit;
  }
  window.localStorage.setItem(DEALER_TRADE_POINTS_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_TRADE_POINTS_EVENT));
}

function applyTpTrainingHydration(
  overrides: TradePointOverrideRow[],
  training: { tp_id: string; product_training_done: boolean }[],
): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  const dealerByTp = new Map(overrides.map((o) => [o.tp_id, o.dealer_id]));
  for (const t of training) {
    const dealerId = dealerByTp.get(t.tp_id);
    if (!dealerId) continue;
    sessionStorage.setItem(
      tradePointProductTrainingStorageKey(dealerId, t.tp_id),
      t.product_training_done ? "1" : "0",
    );
  }
}

function countDealerOverridesInLocalCaches(): number {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  let n = 0;
  try {
    const prof = window.localStorage.getItem(DEALER_PROFILE_OVERRIDES_STORAGE_KEY);
    if (prof) {
      const p = JSON.parse(prof) as DealerProfileOverridesState;
      n += Object.keys(p.overridesByDealer ?? {}).length;
    }
    const tp = window.localStorage.getItem(DEALER_TRADE_POINTS_STORAGE_KEY);
    if (tp) {
      const t = JSON.parse(tp) as DealerTradePointsState;
      n += Object.keys(t.editsByTradePoint ?? {}).length;
    }
  } catch {
    /* ignore */
  }
  return n;
}

/** Загрузить оверрайды дилера с сервера и записать в LS + runtime. */
export async function hydrateDealerOverridesFromServer(opts?: { dealerIds?: string[] }): Promise<boolean> {
  const countBefore = countDealerOverridesInLocalCaches();
  pushOverridesTrace({
    fn: "hydrateDealerOverridesFromServer",
    stage: "hydrate_started",
    fieldsKeys: opts?.dealerIds,
    newValue: countBefore,
  });
  const data = await fetchDealerOverridesList(opts?.dealerIds);
  if (!data) {
    pushOverridesTrace({
      fn: "hydrateDealerOverridesFromServer",
      stage: "hydrate_finished",
      message: "fetch failed",
      newValue: countBefore,
    });
    return false;
  }
  applyDealerOverridesRuntime(data.overrides, data.training, data.manual);
  applyDealerProfileHydration(data.overrides);
  applyUnloadingOrderHydration(data.overrides);
  applyRegionalManagerHydration(data.overrides);
  applyRopHydration(data.overrides);
  applyDealerTrainingHydration(data.training);
  notifyDealerOverridesHydrated();
  const countAfter = countDealerOverridesInLocalCaches();
  pushOverridesTrace({
    fn: "hydrateDealerOverridesFromServer",
    stage: "hydrate_finished",
    newValue: data.overrides.length,
    result: { count_loaded: data.overrides.length, count_local_after: countAfter },
  });
  return true;
}

/** Загрузить оверрайды ТТ с сервера и записать в LS + runtime. */
export async function hydrateTradePointOverridesFromServer(opts?: {
  dealerId?: string;
  tpIds?: string[];
}): Promise<boolean> {
  const countBefore = countDealerOverridesInLocalCaches();
  pushOverridesTrace({
    fn: "hydrateTradePointOverridesFromServer",
    stage: "hydrate_started",
    dealerId: opts?.dealerId,
    tpId: opts?.tpIds?.[0],
    newValue: countBefore,
  });
  const data = await fetchTradePointOverridesList(
    opts?.tpIds?.length
      ? { tpIds: opts.tpIds }
      : opts?.dealerId
        ? { dealerId: opts.dealerId }
        : undefined,
  );
  if (!data) {
    pushOverridesTrace({
      fn: "hydrateTradePointOverridesFromServer",
      stage: "hydrate_finished",
      message: "fetch failed",
    });
    return false;
  }
  applyTradePointOverridesRuntime(data.overrides, data.training);
  applyTradePointEditsHydration(data.overrides);
  applyTradePointRopRmHydration(data.overrides);
  applyTpTrainingHydration(data.overrides, data.training);
  notifyTradePointOverridesHydrated();
  pushOverridesTrace({
    fn: "hydrateTradePointOverridesFromServer",
    stage: "hydrate_finished",
    newValue: data.overrides.length,
    result: { count_loaded: data.overrides.length },
  });
  return true;
}

/** Полная гидрация дилер + ТТ (при старте сессии). */
export async function hydrateAllOverridesFromServer(): Promise<void> {
  await hydrateAllDealerAndTradePointOverrides();
}

/** Полная гидрация дилер + ТТ (alias). */
export async function hydrateAllDealerAndTradePointOverrides(): Promise<void> {
  await Promise.all([hydrateDealerOverridesFromServer(), hydrateTradePointOverridesFromServer()]);
}

/** Точечная гидрация одного дилера (перестраховка на карточке). */
export async function hydrateDealerOverridesForDealer(dealerId: string): Promise<boolean> {
  return hydrateDealerOverridesFromServer({ dealerIds: [dealerId] });
}

/** Точечная гидрация ТТ дилера или одной точки. */
export async function hydrateTradePointOverridesForEntity(opts: {
  dealerId?: string;
  tpId?: string;
}): Promise<boolean> {
  if (opts.tpId) {
    return hydrateTradePointOverridesFromServer({ tpIds: [opts.tpId] });
  }
  if (opts.dealerId) {
    return hydrateTradePointOverridesFromServer({ dealerId: opts.dealerId });
  }
  return false;
}
