/**
 * In-memory снимок оверрайдов дилера после гидрации с API (Промт 113).
 */

import type { ClientCategoryId } from "@/lib/client-category";
import { normalizeClientCategory } from "@/lib/client-category";
import type { ActualizationState, TrashedDealerInfo, TrashedTradePointInfo } from "@/lib/client-base-actualization-state";
import { computeTrashExpiresAt } from "@/lib/client-base-actualization-state";
import { isPrompt113BlobFallbackActive } from "@/lib/dealer-overrides-fallback";
import type { DealerOverrideRow, DealerTrainingRow } from "../../../shared/dealer-overrides-types";
import type { TradePointOverrideRow, TradePointTrainingRow } from "../../../shared/trade-point-overrides-types";

let dealerHydrated = false;
let tpHydrated = false;

const dbTrashedDealersById: Record<string, TrashedDealerInfo> = {};
const dbTrashedTradePointsById: Record<string, TrashedTradePointInfo> = {};
const dbClientCategoryByDealerId: Record<string, ClientCategoryId> = {};
const dbDealerTrainingById: Record<string, DealerTrainingRow> = {};
const dbTpTrainingById: Record<string, TradePointTrainingRow> = {};
const dbManualDealerPayloads: Record<string, Record<string, unknown>> = {};

export function isDealerOverridesHydrated(): boolean {
  return dealerHydrated;
}

export function isTradePointOverridesHydrated(): boolean {
  return tpHydrated;
}

function trashedDealerFromOverride(row: DealerOverrideRow): TrashedDealerInfo | null {
  if (!row.trashed_at) return null;
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
  if (!row.trashed_at || !row.dealer_id) return null;
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
  for (const k of Object.keys(dbClientCategoryByDealerId)) delete dbClientCategoryByDealerId[k];
  for (const k of Object.keys(dbDealerTrainingById)) delete dbDealerTrainingById[k];
  for (const k of Object.keys(dbManualDealerPayloads)) delete dbManualDealerPayloads[k];

  for (const row of overrides) {
    const tr = trashedDealerFromOverride(row);
    if (tr) dbTrashedDealersById[row.dealer_id] = tr;
    if (row.client_category) {
      dbClientCategoryByDealerId[row.dealer_id] = normalizeClientCategory(row.client_category) as ClientCategoryId;
    }
  }
  for (const t of training) dbDealerTrainingById[t.dealer_id] = t;
  for (const m of manual) dbManualDealerPayloads[m.dealer_id] = m.payload;
  dealerHydrated = true;
}

export function applyTradePointOverridesRuntime(
  overrides: TradePointOverrideRow[],
  training: TradePointTrainingRow[],
): void {
  for (const k of Object.keys(dbTrashedTradePointsById)) delete dbTrashedTradePointsById[k];
  for (const k of Object.keys(dbTpTrainingById)) delete dbTpTrainingById[k];

  for (const row of overrides) {
    const tr = trashedTpFromOverride(row);
    if (tr) dbTrashedTradePointsById[row.tp_id] = tr;
  }
  for (const t of training) dbTpTrainingById[t.tp_id] = t;
  tpHydrated = true;
}

export function patchDealerTrashRuntime(dealerId: string, info: TrashedDealerInfo | null): void {
  if (info) dbTrashedDealersById[dealerId] = info;
  else delete dbTrashedDealersById[dealerId];
}

export function patchTradePointTrashRuntime(tpId: string, info: TrashedTradePointInfo | null): void {
  if (info) dbTrashedTradePointsById[tpId] = info;
  else delete dbTrashedTradePointsById[tpId];
}

export function patchDealerCategoryRuntime(dealerId: string, category: ClientCategoryId | null): void {
  if (category) dbClientCategoryByDealerId[dealerId] = category;
  else delete dbClientCategoryByDealerId[dealerId];
}

export function getDbClientCategoryOverride(dealerId: string): ClientCategoryId | undefined {
  return dbClientCategoryByDealerId[dealerId];
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

export function isDealerTrashedInRuntime(dealerId: string, act: ActualizationState | null): boolean {
  if (dbTrashedDealersById[dealerId]) return true;
  if (isPrompt113BlobFallbackActive() && act?.trashedDealersById?.[dealerId]) return true;
  return false;
}

export function isTradePointTrashedInRuntime(tpId: string, act: ActualizationState | null): boolean {
  if (dbTrashedTradePointsById[tpId]) return true;
  if (isPrompt113BlobFallbackActive() && act?.trashedTradePointsById?.[tpId]) return true;
  return false;
}

export function getRuntimeTrashedDealersById(): Readonly<Record<string, TrashedDealerInfo>> {
  return dbTrashedDealersById;
}

export function getRuntimeTrashedTradePointsById(): Readonly<Record<string, TrashedTradePointInfo>> {
  return dbTrashedTradePointsById;
}

export function mergeTrashedDealersForUi(act: ActualizationState): Record<string, TrashedDealerInfo> {
  const out = { ...(isPrompt113BlobFallbackActive() ? act.trashedDealersById ?? {} : {}) };
  for (const [id, info] of Object.entries(dbTrashedDealersById)) {
    out[id] = info;
  }
  return out;
}

export function mergeTrashedTradePointsForUi(act: ActualizationState): Record<string, TrashedTradePointInfo> {
  const out = { ...(isPrompt113BlobFallbackActive() ? act.trashedTradePointsById ?? {} : {}) };
  for (const [id, info] of Object.entries(dbTrashedTradePointsById)) {
    out[id] = info;
  }
  return out;
}
