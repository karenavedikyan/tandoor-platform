/**
 * Однократный бэкфил localStorage → API при логине (Промт 113.1).
 */

import { fetchDealerOverridesList } from "@/lib/dealer-overrides-api";
import { fetchTradePointOverridesList } from "@/lib/trade-point-overrides-api";
import { hydrateAllDealerAndTradePointOverrides } from "@/lib/dealer-overrides-sync";
import {
  DEALER_PROFILE_OVERRIDES_STORAGE_KEY,
  type DealerProfileOverride,
  type DealerProfileOverridesState,
} from "@/lib/dealer-profile-overrides";
import { DEALER_UNLOADING_ORDER_STORAGE_KEY } from "@/lib/dealer-unloading-order-storage";
import {
  DEALER_REGIONAL_MANAGER_OVERRIDES_STORAGE_KEY,
  type DealerRegionalManagerOverridesState,
} from "@/lib/dealer-regional-manager-overrides";
import {
  DEALER_TRADE_POINTS_STORAGE_KEY,
  tradePointKey,
  type DealerTradePointsState,
} from "@/lib/dealer-trade-points-overrides";
import { dealerProductTrainingStorageKey, tradePointProductTrainingStorageKey } from "@/lib/training-attention";
import { DEALER_TRAINING_FLAGS_KEY, loadDealerTrainingFlagsStorage } from "@/lib/dealer-card-release-signals";
import {
  enqueuePendingSync,
  makePendingId,
} from "@/lib/overrides-pending-sync";
import type { DealerOverrideRow } from "../../../shared/dealer-overrides-types";
import type { TradePointOverrideRow } from "../../../shared/trade-point-overrides-types";
import { buildBulkImportItemsFromLocalState } from "@/lib/dealer-shipment-route-definitions";
import {
  apiBulkImportShipmentRoutes,
  fetchShipmentRoutesList,
  SHIPMENT_ROUTES_BACKFILL_DONE_PREFIX,
} from "@/lib/dealer-shipment-routes-api";
import { DEALER_CARD_COMMENTS_STORAGE_KEY } from "@/lib/dealer-card-comments";
import { TRADE_POINT_COMMENTS_STORAGE_KEY } from "@/lib/trade-point-comments";
import { apiBulkImport, buildBulkImportPayloadFromLocal, fetchClientComments } from "@/lib/client-comments-api";
import { loadDealerCardCommentsState } from "@/lib/dealer-card-comments";
import { loadTradePointCommentsState } from "@/lib/trade-point-comments";

export const CLIENT_COMMENTS_BACKFILL_DONE_PREFIX = "tandoor-client-comments-backfill-done-v1-";

export const OVERRIDES_BACKFILL_DONE_KEY = "tandoor:overrides:backfill-v1:done";
export const OVERRIDES_BACKFILL_CONFLICTS_KEY = "tandoor:overrides:backfill-conflicts";

export type BackfillConflict = {
  at: string;
  entity: "dealer" | "tp";
  entityId: string;
  field: string;
  localValue: unknown;
  serverValue: unknown;
};

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function logConflict(c: Omit<BackfillConflict, "at">): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(OVERRIDES_BACKFILL_CONFLICTS_KEY);
    const prev: BackfillConflict[] = raw ? (JSON.parse(raw) as BackfillConflict[]) : [];
    prev.unshift({ ...c, at: new Date().toISOString() });
    window.localStorage.setItem(OVERRIDES_BACKFILL_CONFLICTS_KEY, JSON.stringify(prev.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

function serverDealerMap(overrides: DealerOverrideRow[]): Map<string, DealerOverrideRow> {
  return new Map(overrides.map((o) => [o.dealer_id, o]));
}

function serverTpMap(overrides: TradePointOverrideRow[]): Map<string, TradePointOverrideRow> {
  return new Map(overrides.map((o) => [o.tp_id, o]));
}

function maybeEnqueueDealerFields(
  dealerId: string,
  server: DealerOverrideRow | undefined,
  fieldChecks: [string, unknown, unknown][],
): void {
  const patch: Record<string, unknown> = {};
  for (const [field, localVal, serverVal] of fieldChecks) {
    if (localVal == null || localVal === "") continue;
    if (server && serverVal != null && !valuesEqual(localVal, serverVal)) {
      logConflict({ entity: "dealer", entityId: dealerId, field, localValue: localVal, serverValue: serverVal });
      continue;
    }
    if (!server || serverVal == null) patch[field] = localVal;
  }
  if (Object.keys(patch).length === 0) return;
  enqueuePendingSync({
    id: makePendingId("dealer-upsert", `${dealerId}:backfill`),
    kind: "dealer-upsert",
    payload: { dealer_id: dealerId, fields: patch },
  });
}

export async function runOverridesBackfillIfNeeded(_currentUserId: string): Promise<void> {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (localStorage.getItem(OVERRIDES_BACKFILL_DONE_KEY) === "1") return;

  await hydrateAllDealerAndTradePointOverrides();

  const dealerList = await fetchDealerOverridesList();
  const tpList = await fetchTradePointOverridesList();
  const dealerById = serverDealerMap(dealerList?.overrides ?? []);
  const tpById = serverTpMap(tpList?.overrides ?? []);
  const trainingByDealer = new Map((dealerList?.training ?? []).map((t) => [t.dealer_id, t]));
  const trainingByTp = new Map((tpList?.training ?? []).map((t) => [t.tp_id, t]));

  try {
    const profRaw = localStorage.getItem(DEALER_PROFILE_OVERRIDES_STORAGE_KEY);
    if (profRaw) {
      const st = JSON.parse(profRaw) as DealerProfileOverridesState;
      for (const [dealerId, o] of Object.entries(st.overridesByDealer ?? {})) {
        const row = o as DealerProfileOverride;
        const srv = dealerById.get(dealerId);
        maybeEnqueueDealerFields(dealerId, srv, [
          ["name", row.displayName, srv?.name],
          ["city", row.city, srv?.city],
          ["contact_name", row.mainContactName, srv?.contact_name],
          ["contact_phone", row.mainContactPhone, srv?.contact_phone],
          ["contact_email", row.mainContactEmail, srv?.contact_email],
          ["general_comment", row.comment, srv?.general_comment],
        ]);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const uoRaw = localStorage.getItem(DEALER_UNLOADING_ORDER_STORAGE_KEY);
    if (uoRaw) {
      const st = JSON.parse(uoRaw) as { orderByDealer?: Record<string, number> };
      for (const [dealerId, order] of Object.entries(st.orderByDealer ?? {})) {
        const srv = dealerById.get(dealerId);
        const local = String(order);
        if (!srv?.unloading_order) {
          maybeEnqueueDealerFields(dealerId, srv, [["unloading_order", local, srv?.unloading_order]]);
        } else if (srv.unloading_order !== local) {
          logConflict({
            entity: "dealer",
            entityId: dealerId,
            field: "unloading_order",
            localValue: local,
            serverValue: srv.unloading_order,
          });
        }
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const rmRaw = localStorage.getItem(DEALER_REGIONAL_MANAGER_OVERRIDES_STORAGE_KEY);
    if (rmRaw) {
      const st = JSON.parse(rmRaw) as DealerRegionalManagerOverridesState;
      for (const [dealerId, rm] of Object.entries(st.byDealerId ?? {})) {
        const srv = dealerById.get(dealerId);
        maybeEnqueueDealerFields(dealerId, srv, [
          ["regional_manager_id", rm.userId, srv?.regional_manager_id],
          ["regional_manager_name", rm.updatedByName, srv?.regional_manager_name],
        ]);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const flags = loadDealerTrainingFlagsStorage();
    for (const [dealerId, d] of Object.entries(flags.dealers)) {
      const srv = trainingByDealer.get(dealerId);
      if (!srv) {
        enqueuePendingSync({
          id: makePendingId("dealer-training", `${dealerId}:backfill-needs`),
          kind: "dealer-training",
          payload: { dealer_id: dealerId, needs_new_employees_training: d.newStaffTrainingNeeded },
        });
      }
    }
  } catch {
    /* ignore */
  }

  if (typeof sessionStorage !== "undefined") {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (key.startsWith("dealer-product-training-done-")) {
        const dealerId = key.replace("dealer-product-training-done-", "");
        const local = sessionStorage.getItem(key) === "1";
        const srv = trainingByDealer.get(dealerId);
        if (!srv) {
          enqueuePendingSync({
            id: makePendingId("dealer-training", `${dealerId}:backfill-product`),
            kind: "dealer-training",
            payload: { dealer_id: dealerId, product_training_done: local },
          });
        }
      }
    }
  }

  try {
    const tpRaw = localStorage.getItem(DEALER_TRADE_POINTS_STORAGE_KEY);
    if (tpRaw) {
      const st = JSON.parse(tpRaw) as DealerTradePointsState;
      for (const [key, edit] of Object.entries(st.editsByTradePoint ?? {})) {
        const [dealerId, tpId] = key.split("|");
        if (!dealerId || !tpId) continue;
        const srv = tpById.get(tpId);
        const fields: Record<string, unknown> = {};
        const checks: [string, unknown, unknown][] = [
          ["name", edit.name, srv?.name],
          ["city", edit.city, srv?.city],
          ["address", edit.address, srv?.address],
          ["contact_name", edit.contactName, srv?.contact_name],
          ["contact_phone", edit.contactPhone, srv?.contact_phone],
          ["comment", edit.comment, srv?.comment],
          ["showcase_status", edit.showcaseStatus, srv?.showcase_status],
          [
            "shipment_days",
            edit.shipmentDayIds ? JSON.stringify(edit.shipmentDayIds) : null,
            srv?.shipment_days,
          ],
          ["is_main_warehouse", edit.hasMainWarehouse, srv?.is_main_warehouse],
          ["is_hardware_warehouse", edit.hasHardwareWarehouse, srv?.is_hardware_warehouse],
          ["dealer_id", dealerId, srv?.dealer_id],
        ];
        for (const [field, localVal, serverVal] of checks) {
          if (localVal == null) continue;
          if (srv && serverVal != null && !valuesEqual(localVal, serverVal)) {
            logConflict({ entity: "tp", entityId: tpId, field, localValue: localVal, serverValue: serverVal });
          } else if (!srv || serverVal == null) {
            fields[field] = localVal;
          }
        }
        if (Object.keys(fields).length > 0) {
          enqueuePendingSync({
            id: makePendingId("tp-upsert", `${tpId}:backfill`),
            kind: "tp-upsert",
            payload: { tp_id: tpId, dealer_id: dealerId, fields },
          });
        }
        void tradePointKey;
      }
    }
  } catch {
    /* ignore */
  }

  if (typeof sessionStorage !== "undefined") {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith("trade-point-product-training-done-")) continue;
      const rest = key.replace("trade-point-product-training-done-", "");
      const sep = rest.lastIndexOf("-");
      if (sep < 0) continue;
      const dealerId = rest.slice(0, sep);
      const tpId = rest.slice(sep + 1);
      const local = sessionStorage.getItem(key) === "1";
      const srv = trainingByTp.get(tpId);
      if (!srv) {
        enqueuePendingSync({
          id: makePendingId("tp-training", `${tpId}:backfill`),
          kind: "tp-training",
          payload: { tp_id: tpId, product_training_done: local, dealer_id: dealerId },
        });
      }
    }
  }

  void DEALER_TRAINING_FLAGS_KEY;

  localStorage.setItem(OVERRIDES_BACKFILL_DONE_KEY, "1");
}

export async function backfillShipmentRoutesFromLocalStorage(
  authUserId: string,
  localUserId: string,
): Promise<void> {
  if (typeof window === "undefined" || !window.localStorage) return;
  const flagKey = `${SHIPMENT_ROUTES_BACKFILL_DONE_PREFIX}${authUserId}`;
  if (localStorage.getItem(flagKey) === "1") return;

  const items = buildBulkImportItemsFromLocalState(localUserId);
  if (items.length === 0) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  const existing = await fetchShipmentRoutesList(authUserId);
  if (existing && existing.items.length > 0) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  const r = await apiBulkImportShipmentRoutes(authUserId, items);
  if (r.ok) {
    localStorage.setItem(flagKey, "1");
  }
}

function collectClientIdsWithLocalComments(): string[] {
  const ids = new Set<string>();
  try {
    const dealerRaw = localStorage.getItem(DEALER_CARD_COMMENTS_STORAGE_KEY);
    if (dealerRaw) {
      const st = JSON.parse(dealerRaw) as { commentsByDealer?: Record<string, unknown[]> };
      for (const [dealerId, list] of Object.entries(st.commentsByDealer ?? {})) {
        if (Array.isArray(list) && list.length > 0) ids.add(dealerId);
      }
    }
    const tpRaw = localStorage.getItem(TRADE_POINT_COMMENTS_STORAGE_KEY);
    if (tpRaw) {
      const st = JSON.parse(tpRaw) as { commentsByTradePoint?: Record<string, unknown[]> };
      for (const key of Object.keys(st.commentsByTradePoint ?? {})) {
        const sep = key.indexOf("|");
        if (sep > 0) ids.add(key.slice(0, sep));
      }
    }
  } catch {
    /* ignore */
  }
  return Array.from(ids);
}

export async function backfillClientCommentsFromLocalStorage(authUserId: string): Promise<void> {
  if (typeof window === "undefined" || !window.localStorage) return;
  const flagKey = `${CLIENT_COMMENTS_BACKFILL_DONE_PREFIX}${authUserId}`;
  if (localStorage.getItem(flagKey) === "1") return;

  const clientIds = collectClientIdsWithLocalComments();
  if (clientIds.length === 0) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  let allOk = true;
  for (const clientId of clientIds) {
    const existing = await fetchClientComments(clientId);
    const active = (existing?.items ?? []).filter((c) => !c.isDeleted);
    if (active.length > 0) continue;

    const dealerState = loadDealerCardCommentsState();
    const tpState = loadTradePointCommentsState();
    const dealerComments = dealerState.commentsByDealer[clientId] ?? [];
    const tpComments: Record<string, import("@/lib/trade-point-comments").TradePointComment[]> = {};
    const prefix = `${clientId}|`;
    for (const [key, list] of Object.entries(tpState.commentsByTradePoint)) {
      if (!key.startsWith(prefix)) continue;
      tpComments[key.slice(prefix.length)] = list;
    }
    if (dealerComments.length === 0 && Object.keys(tpComments).length === 0) continue;

    const payload = buildBulkImportPayloadFromLocal(clientId, dealerState, tpState);
    const { ok } = await apiBulkImport(payload);
    if (!ok) allOk = false;
  }

  if (allOk) {
    localStorage.setItem(flagKey, "1");
  }
}

export function readBackfillConflicts(): BackfillConflict[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(OVERRIDES_BACKFILL_CONFLICTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BackfillConflict[];
  } catch {
    return [];
  }
}
