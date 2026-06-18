/**
 * In-memory снимок оверрайдов дилера/ТТ после гидрации с API (Промт 113 / 113.4).
 */

import { useSyncExternalStore } from "react";
import { DEALER_OVERRIDES_HYDRATED_EVENT } from "./dealer-overrides-api.js";
import { TRADE_POINT_OVERRIDES_HYDRATED_EVENT } from "./trade-point-overrides-api.js";
import type { ClientCategoryId } from "./client-category.js";
import { normalizeClientCategory } from "./client-category.js";
import type { ActualizationState, TrashedDealerInfo, TrashedTradePointInfo } from "./client-base-actualization-state.js";
import { computeTrashExpiresAt } from "./client-base-actualization-state.js";
import type { DealerOverrideRow, DealerTrainingRow } from "../../../shared/dealer-overrides-types";
import type { TradePointOverrideRow, TradePointTrainingRow } from "../../../shared/trade-point-overrides-types";

export const OVERRIDES_RUNTIME_CHANGED_EVENT = "tandoor-overrides-runtime-changed";

let dealerHydrated = false;
let tpHydrated = false;
let runtimeVersion = 0;

const dbTrashedDealersById: Record<string, TrashedDealerInfo> = {};
const dbTrashedTradePointsById: Record<string, TrashedTradePointInfo> = {};
const dbPurgePendingDealersById: Record<string, true> = {};
const dbPurgePendingTradePointsById: Record<string, true> = {};
const dbClientCategoryByDealerId: Record<string, ClientCategoryId> = {};
const dbDealerTrainingById: Record<string, DealerTrainingRow> = {};
const dbTpTrainingById: Record<string, TradePointTrainingRow> = {};
const dbManualDealerPayloads: Record<string, Record<string, unknown>> = {};
const dbDealerOverridesById: Record<string, DealerOverrideRow> = {};
const dbTradePointOverridesById: Record<string, TradePointOverrideRow> = {};
const dbUnloadingOrderByDealerId: Record<string, number> = {};

function bumpRuntimeVersion(): void {
  runtimeVersion += 1;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OVERRIDES_RUNTIME_CHANGED_EVENT));
  }
}

export function getOverridesRuntimeVersion(): number {
  return runtimeVersion;
}

export function subscribeOverridesRuntime(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const fn = () => onStoreChange();
  window.addEventListener(OVERRIDES_RUNTIME_CHANGED_EVENT, fn);
  window.addEventListener(DEALER_OVERRIDES_HYDRATED_EVENT, fn);
  window.addEventListener(TRADE_POINT_OVERRIDES_HYDRATED_EVENT, fn);
  return () => {
    window.removeEventListener(OVERRIDES_RUNTIME_CHANGED_EVENT, fn);
    window.removeEventListener(DEALER_OVERRIDES_HYDRATED_EVENT, fn);
    window.removeEventListener(TRADE_POINT_OVERRIDES_HYDRATED_EVENT, fn);
  };
}

export function useOverridesRuntimeVersion(): number {
  return useSyncExternalStore(subscribeOverridesRuntime, getOverridesRuntimeVersion, () => 0);
}

export function isDealerOverridesHydrated(): boolean {
  return dealerHydrated;
}

export function isTradePointOverridesHydrated(): boolean {
  return tpHydrated;
}

export function getDealerOverride(dealerId: string): DealerOverrideRow | null {
  return dbDealerOverridesById[dealerId] ?? null;
}

export function getTradePointOverride(tpId: string): TradePointOverrideRow | null {
  return dbTradePointOverridesById[tpId] ?? null;
}

export function useDealerOverride(dealerId: string | undefined): DealerOverrideRow | null {
  const version = useOverridesRuntimeVersion();
  void version;
  if (!dealerId) return null;
  return getDealerOverride(dealerId);
}

export function useTradePointOverride(tpId: string | undefined): TradePointOverrideRow | null {
  const version = useOverridesRuntimeVersion();
  void version;
  if (!tpId) return null;
  return getTradePointOverride(tpId);
}

function trashedDealerFromOverride(row: DealerOverrideRow): TrashedDealerInfo | null {
  if (!row.trashed_at || row.purge_requested_at) return null;
  const trashedAt = row.trashed_at;
  return {
    dealerId: row.dealer_id,
    trashedAt,
    trashedBy: row.trashed_by ?? "",
    trashedByName: "",
    expiresAt: computeTrashExpiresAt(trashedAt),
    source: "client_card_delete",
    snapshot: {
      fullName: null,
      city: null,
      inn: null,
      dealerCode: null,
      legalEntityName: null,
    },
  };
}

function trashedTpFromOverride(row: TradePointOverrideRow): TrashedTradePointInfo | null {
  if (!row.trashed_at || row.purge_requested_at || !row.dealer_id) return null;
  const trashedAt = row.trashed_at;
  return {
    tradePointId: row.tp_id,
    dealerId: row.dealer_id,
    trashedAt,
    trashedBy: row.trashed_by ?? "",
    trashedByName: "",
    expiresAt: computeTrashExpiresAt(trashedAt),
    source: "client_card_delete",
    snapshot: {
      name: null,
      address: null,
      city: null,
      tradePointCode: null,
      dealerFullName: null,
    },
  };
}

export function applyDealerOverridesRuntime(
  overrides: DealerOverrideRow[],
  training: DealerTrainingRow[],
  manual: { dealer_id: string; payload: Record<string, unknown> }[],
): void {
  for (const k of Object.keys(dbTrashedDealersById)) delete dbTrashedDealersById[k];
  for (const k of Object.keys(dbPurgePendingDealersById)) delete dbPurgePendingDealersById[k];
  for (const k of Object.keys(dbClientCategoryByDealerId)) delete dbClientCategoryByDealerId[k];
  for (const k of Object.keys(dbDealerTrainingById)) delete dbDealerTrainingById[k];
  for (const k of Object.keys(dbManualDealerPayloads)) delete dbManualDealerPayloads[k];
  for (const k of Object.keys(dbDealerOverridesById)) delete dbDealerOverridesById[k];
  for (const k of Object.keys(dbUnloadingOrderByDealerId)) delete dbUnloadingOrderByDealerId[k];

  for (const row of overrides) {
    dbDealerOverridesById[row.dealer_id] = row;
    if (row.purge_requested_at && !row.purged_at) {
      dbPurgePendingDealersById[row.dealer_id] = true;
    }
    const tr = trashedDealerFromOverride(row);
    if (tr) dbTrashedDealersById[row.dealer_id] = tr;
    if (row.client_category) {
      dbClientCategoryByDealerId[row.dealer_id] = normalizeClientCategory(row.client_category) as ClientCategoryId;
    }
    if (row.unloading_order) {
      const n = Number(row.unloading_order);
      if (Number.isFinite(n) && n > 0) dbUnloadingOrderByDealerId[row.dealer_id] = Math.floor(n);
    }
  }
  for (const t of training) dbDealerTrainingById[t.dealer_id] = t;
  for (const m of manual) dbManualDealerPayloads[m.dealer_id] = m.payload;
  dealerHydrated = true;
  bumpRuntimeVersion();
}

export function applyTradePointOverridesRuntime(
  overrides: TradePointOverrideRow[],
  training: TradePointTrainingRow[],
): void {
  for (const k of Object.keys(dbTrashedTradePointsById)) delete dbTrashedTradePointsById[k];
  for (const k of Object.keys(dbPurgePendingTradePointsById)) delete dbPurgePendingTradePointsById[k];
  for (const k of Object.keys(dbTpTrainingById)) delete dbTpTrainingById[k];
  for (const k of Object.keys(dbTradePointOverridesById)) delete dbTradePointOverridesById[k];

  for (const row of overrides) {
    dbTradePointOverridesById[row.tp_id] = row;
    if (row.purge_requested_at && !row.purged_at) {
      dbPurgePendingTradePointsById[row.tp_id] = true;
    }
    const tr = trashedTpFromOverride(row);
    if (tr) dbTrashedTradePointsById[row.tp_id] = tr;
  }
  for (const t of training) dbTpTrainingById[t.tp_id] = t;
  tpHydrated = true;
  bumpRuntimeVersion();
}

export function patchDealerTrashRuntime(dealerId: string, info: TrashedDealerInfo | null): void {
  if (info) dbTrashedDealersById[dealerId] = info;
  else delete dbTrashedDealersById[dealerId];
  bumpRuntimeVersion();
}

export function patchTradePointTrashRuntime(tpId: string, info: TrashedTradePointInfo | null): void {
  if (info) dbTrashedTradePointsById[tpId] = info;
  else delete dbTrashedTradePointsById[tpId];
  bumpRuntimeVersion();
}

export function patchDealerPurgePendingRuntime(dealerId: string, pending: boolean): void {
  if (pending) dbPurgePendingDealersById[dealerId] = true;
  else delete dbPurgePendingDealersById[dealerId];
  bumpRuntimeVersion();
}

export function patchTradePointPurgePendingRuntime(tpId: string, pending: boolean): void {
  if (pending) dbPurgePendingTradePointsById[tpId] = true;
  else delete dbPurgePendingTradePointsById[tpId];
  bumpRuntimeVersion();
}

export function patchDealerCategoryRuntime(dealerId: string, category: ClientCategoryId | null): void {
  if (category) dbClientCategoryByDealerId[dealerId] = category;
  else delete dbClientCategoryByDealerId[dealerId];
  const row = dbDealerOverridesById[dealerId];
  if (row) row.client_category = category;
  bumpRuntimeVersion();
}

export function getDbClientCategoryOverride(dealerId: string): ClientCategoryId | undefined {
  return dbClientCategoryByDealerId[dealerId];
}

export function getDbUnloadingOrderOverride(dealerId: string): number | undefined {
  return dbUnloadingOrderByDealerId[dealerId];
}

export function patchDealerUnloadingOrderRuntime(dealerId: string, order: number | null): void {
  if (order != null && order > 0) dbUnloadingOrderByDealerId[dealerId] = Math.floor(order);
  else delete dbUnloadingOrderByDealerId[dealerId];
  const row = dbDealerOverridesById[dealerId];
  if (row) row.unloading_order = order != null && order > 0 ? String(Math.floor(order)) : null;
  bumpRuntimeVersion();
}

export function useDealerUnloadingOrder(dealerId: string | undefined): number | null {
  const version = useOverridesRuntimeVersion();
  void version;
  if (!dealerId) return null;
  const fromDb = getDbUnloadingOrderOverride(dealerId);
  if (fromDb != null) return fromDb;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("tandoor-dealer-unloading-order-v1");
    if (!raw) return null;
    const p = JSON.parse(raw) as { orderByDealer?: Record<string, number> };
    const v = p.orderByDealer?.[dealerId];
    return typeof v === "number" && v > 0 ? Math.floor(v) : null;
  } catch {
    return null;
  }
}

export function getDbDealerTraining(dealerId: string): DealerTrainingRow | undefined {
  return dbDealerTrainingById[dealerId];
}

export function getDbTradePointTraining(tpId: string): TradePointTrainingRow | undefined {
  return dbTpTrainingById[tpId];
}

export function getDbManualDealerPayload(dealerId: string): Record<string, unknown> | undefined {
  return dbManualDealerPayloads[dealerId];
}

export function isDealerTrashedInRuntime(dealerId: string, act?: ActualizationState | null): boolean {
  const ov = dbDealerOverridesById[dealerId];
  if (ov?.purged_at) return false;
  if (dbTrashedDealersById[dealerId]) return true;
  if (dbPurgePendingDealersById[dealerId]) return true;
  if (act?.trashedDealersById?.[dealerId]) return true;
  return false;
}

export function isTradePointTrashedInRuntime(tpId: string, act?: ActualizationState | null): boolean {
  const ov = dbTradePointOverridesById[tpId];
  if (ov?.purged_at) return false;
  if (dbTrashedTradePointsById[tpId]) return true;
  if (dbPurgePendingTradePointsById[tpId]) return true;
  if (act?.trashedTradePointsById?.[tpId]) return true;
  return false;
}

function pickNewerTrashed<T extends { trashedAt: string }>(a: T, b: T): T {
  const ta = Date.parse(a.trashedAt);
  const tb = Date.parse(b.trashedAt);
  if (Number.isFinite(ta) && (!Number.isFinite(tb) || ta > tb)) return a;
  return b;
}

function mergeTrashedRecordMaps<T extends { trashedAt: string }>(
  blob: Record<string, T>,
  runtime: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, info] of Object.entries(blob)) {
    if (info) out[id] = info;
  }
  for (const [id, info] of Object.entries(runtime)) {
    const existing = out[id];
    out[id] = existing ? pickNewerTrashed(info, existing) : info;
  }
  return out;
}

export function getRuntimeTrashedDealersById(): Readonly<Record<string, TrashedDealerInfo>> {
  return dbTrashedDealersById;
}

export function getRuntimeTrashedTradePointsById(): Readonly<Record<string, TrashedTradePointInfo>> {
  return dbTrashedTradePointsById;
}

/** Промт 397: jsonb-state (client_bulk_delete) + dealer_overrides.trashed_at. */
export function mergeTrashedDealersForUi(act: ActualizationState): Record<string, TrashedDealerInfo> {
  const merged = mergeTrashedRecordMaps(act?.trashedDealersById ?? {}, dbTrashedDealersById);
  for (const id of Object.keys(merged)) {
    if (dbPurgePendingDealersById[id]) delete merged[id];
  }
  return merged;
}

export function mergeTrashedTradePointsForUi(act: ActualizationState): Record<string, TrashedTradePointInfo> {
  const merged = mergeTrashedRecordMaps(act?.trashedTradePointsById ?? {}, dbTrashedTradePointsById);
  for (const id of Object.keys(merged)) {
    if (dbPurgePendingTradePointsById[id]) delete merged[id];
  }
  return merged;
}
