/**
 * Фоновый воркер повторной синхронизации overrides (Промт 113.1 / 114.4).
 */

import {
  createManualDealerStrict,
  setDealerTrainingStrict,
  trashDealerStrict,
  untrashDealerStrict,
  upsertDealerOverrideStrict,
} from "./dealer-overrides-api.js";
import {
  setTradePointTrainingStrict,
  trashTradePointStrict,
  untrashTradePointStrict,
  upsertTradePointOverrideStrict,
} from "./trade-point-overrides-api.js";
import { apiCreateComment } from "./client-comments-api.js";
import {
  apiDeleteShipmentRoute,
  apiUpsertShipmentRoute,
} from "./dealer-shipment-routes-api.js";
import {
  apiDeleteMatrixDefStrict,
  apiReplaceMatrixDefModelsStrict,
  apiSetMatrixDefStatusStrict,
  apiUpsertMatrixDefStrict,
  type ShowcaseMatrixCatalogStatus,
  type ShowcaseMatrixDefModelInput,
  type ShowcaseMatrixDefUpsertInput,
} from "./showcase-matrix-catalog-api.js";
import {
  apiUpsertShowcaseMatrixEntryStrict,
  type ShowcasePlacementSegment,
  type ShowcasePlacementType,
  type ShowcaseMatrixStatus,
  type ShowcaseMatrixTargetKind,
} from "./showcase-matrix-api.js";
import { sanitizeDealerOverrideFieldsForApi } from "./overrides-persona-fields.js";
import {
  dequeuePendingSync,
  listPendingSyncItems,
  markPendingSyncDead,
  markPendingSyncFailed,
  purgeStaleDeadPendingSync,
  type PendingSyncItem,
} from "./overrides-pending-sync.js";
import { refreshDbCommentsForClient } from "./client-comments-db-cache.js";
import { invalidateTradePointsScopedQueries } from "./trade-points-scoped-api.js";
import { isDistributionDebugEnabled } from "./distribution-entry-debug.js";
import { refreshMatrixFromServer } from "./showcase-matrix-store.js";

const INTERVAL_MS = 15_000;
const PURGE_INTERVAL_MS = 60 * 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;
let purgeTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

function failureMessage(result: { ok: false; message?: string; code?: string; status?: number }): string {
  if (result.code) return result.code;
  if (result.status) return `HTTP ${result.status}`;
  return result.message ?? "save failed";
}

function isPermanentApiFailure(result: { ok: false; status?: number; code?: string; message?: string }): boolean {
  if (result.status === 400) return true;
  const code = (result.code ?? "").toUpperCase();
  if (code === "INVALID_UUID_FIELD") return true;
  const msg = (result.message ?? "").toLowerCase();
  return msg.includes("invalid input syntax for type uuid");
}

function rollbackShowcaseMatrixOptimistic(payload: Record<string, unknown>): void {
  const tradePointId = typeof payload.tradePointId === "string" ? payload.tradePointId : "";
  const dealerId = typeof payload.dealerId === "string" ? payload.dealerId : undefined;
  if (!tradePointId) return;
  void refreshMatrixFromServer(tradePointId, dealerId);
}

function notifyShowcaseMatrixSyncDead(err: string): void {
  if (typeof window === "undefined") return;
  void import("../hooks/use-toast.js")
    .then(({ toast }) => {
      toast({
        variant: "destructive",
        title: "Не удалось сохранить витрину",
        description: err === "network" ? "Проверьте соединение и попробуйте снова." : err,
      });
    })
    .catch(() => undefined);
}

async function processItem(item: PendingSyncItem): Promise<void> {
  if (item.dead) return;

  const p = item.payload as Record<string, unknown>;
  let result: { ok: boolean; status?: number; code?: string; message?: string; network?: boolean } = { ok: false };

  switch (item.kind) {
    case "dealer-upsert": {
      const rawFields = (p.fields ?? {}) as Record<string, unknown>;
      const fields = sanitizeDealerOverrideFieldsForApi(rawFields);
      if (Object.keys(fields).length === 0) {
        markPendingSyncDead(item.id, "INVALID_UUID_FIELD: empty fields after sanitize");
        return;
      }
      result = await upsertDealerOverrideStrict(String(p.dealer_id), fields);
      break;
    }
    case "dealer-training":
      result = await setDealerTrainingStrict(String(p.dealer_id), {
        product_training_done: p.product_training_done as boolean | undefined,
        needs_new_employees_training: p.needs_new_employees_training as boolean | undefined,
      });
      break;
    case "dealer-trash":
      result = await trashDealerStrict(String(p.dealer_id));
      break;
    case "dealer-untrash":
      result = await untrashDealerStrict(String(p.dealer_id));
      break;
    case "manual-dealer":
      result = await createManualDealerStrict({
        dealer_id: typeof p.dealer_id === "string" ? p.dealer_id : undefined,
        payload: (p.payload ?? p) as Record<string, unknown>,
      });
      break;
    case "tp-upsert":
      result = await upsertTradePointOverrideStrict(
        String(p.tp_id),
        (p.fields ?? {}) as Record<string, unknown>,
        typeof p.dealer_id === "string" ? p.dealer_id : undefined,
      );
      break;
    case "tp-training":
      result = await setTradePointTrainingStrict(String(p.tp_id), {
        product_training_done: p.product_training_done as boolean | undefined,
      });
      break;
    case "tp-trash":
      result = await trashTradePointStrict(String(p.tp_id));
      break;
    case "tp-untrash":
      result = await untrashTradePointStrict(String(p.tp_id));
      break;
    case "shipment-routes-upsert": {
      const r = await apiUpsertShipmentRoute({
        id: typeof p.id === "string" ? p.id : undefined,
        userId: String(p.userId),
        dayId: p.dayId as import("./dealer-shipment-days.js").DealerShipmentDayId,
        name: String(p.name ?? ""),
        cities: Array.isArray(p.cities) ? (p.cities as string[]) : [],
      });
      if (r.ok) {
        dequeuePendingSync(item.id);
      } else {
        const err = r.code ?? "save failed";
        if (r.status === 400) markPendingSyncDead(item.id, err);
        else markPendingSyncFailed(item.id, err);
      }
      return;
    }
    case "shipment-routes-delete": {
      const ok = await apiDeleteShipmentRoute({
        id: String(p.id),
        userId: String(p.userId),
        deletedBy: String(p.deletedBy ?? p.userId),
      });
      if (ok) dequeuePendingSync(item.id);
      else markPendingSyncFailed(item.id, "delete failed");
      return;
    }
    case "client-comments-create": {
      const r = await apiCreateComment(p as Record<string, unknown>);
      if (r.ok) {
        const dealerId = typeof p.dealerId === "string" ? p.dealerId : String(p.clientId ?? "");
        if (dealerId) await refreshDbCommentsForClient(dealerId);
        dequeuePendingSync(item.id);
      } else {
        markPendingSyncFailed(item.id, "comment create failed");
      }
      return;
    }
    case "showcase-matrix-upsert": {
      if (isDistributionDebugEnabled()) {
        console.debug("[dist-recon] pending-sync:matrix-upsert:begin", {
          itemId: item.id,
          payloadKeys: Object.keys(item.payload),
          tradePointId: (item.payload as { tradePointId?: unknown }).tradePointId,
          targetKind: (item.payload as { targetKind?: unknown }).targetKind,
          targetId: (item.payload as { targetId?: unknown }).targetId,
        });
      }
      result = await apiUpsertShowcaseMatrixEntryStrict({
        dealerId: String(p.dealerId),
        tradePointId: String(p.tradePointId),
        targetKind: p.targetKind as ShowcaseMatrixTargetKind,
        targetId: String(p.targetId),
        status: p.status as ShowcaseMatrixStatus,
        comment: typeof p.comment === "string" ? p.comment : null,
        clientOpId: typeof p.clientOpId === "string" ? p.clientOpId : undefined,
        placementType: (p.placementType as ShowcasePlacementType | null | undefined) ?? null,
        placementSegment: (p.placementSegment as ShowcasePlacementSegment | null | undefined) ?? null,
        placementCapacity: typeof p.placementCapacity === "number" ? p.placementCapacity : null,
        placementActual: typeof p.placementActual === "number" ? p.placementActual : null,
        placementRef: typeof p.placementRef === "string" ? p.placementRef : null,
        placementOurModels: Array.isArray(p.placementOurModels) ? p.placementOurModels : undefined,
        placementCompetitors: Array.isArray(p.placementCompetitors) ? p.placementCompetitors : undefined,
        placementLegacyOurs: typeof p.placementLegacyOurs === "number" ? p.placementLegacyOurs : null,
      });
      if (isDistributionDebugEnabled()) {
        console.debug("[dist-recon] pending-sync:matrix-upsert:result", {
          itemId: item.id,
          ok: result.ok,
          status: result.status,
          code: result.code,
          message: result.message,
          network: result.network,
        });
      }
      if (result.ok) {
        dequeuePendingSync(item.id);
        invalidateTradePointsScopedQueries();
        return;
      }
      rollbackShowcaseMatrixOptimistic(p);
      break;
    }
    case "showcase-matrix-catalog-upsert": {
      result = await apiUpsertMatrixDefStrict(p as unknown as ShowcaseMatrixDefUpsertInput);
      break;
    }
    case "showcase-matrix-catalog-set-status": {
      result = await apiSetMatrixDefStatusStrict(
        String(p.id),
        p.status as ShowcaseMatrixCatalogStatus,
      );
      break;
    }
    case "showcase-matrix-catalog-delete": {
      result = await apiDeleteMatrixDefStrict(String(p.id));
      break;
    }
    case "showcase-matrix-catalog-replace-models": {
      const rawModels = p.models;
      const models = Array.isArray(rawModels)
        ? (rawModels as ShowcaseMatrixDefModelInput[])
        : [];
      result = await apiReplaceMatrixDefModelsStrict(String(p.defId), models);
      break;
    }
    default:
      return;
  }

  if (result.ok) {
    dequeuePendingSync(item.id);
    return;
  }

  const err = failureMessage(result as { ok: false; message?: string; code?: string; status?: number });
  if (isPermanentApiFailure(result as { ok: false; status?: number; code?: string; message?: string })) {
    markPendingSyncDead(item.id, err);
    if (item.kind === "showcase-matrix-upsert") {
      if (isDistributionDebugEnabled()) {
        console.debug("[dist-recon] pending-sync:matrix-upsert:dead", {
          itemId: item.id,
          reason: err,
          stillDead: true,
        });
      }
      notifyShowcaseMatrixSyncDead(err);
    }
  } else if ("network" in result && result.network) {
    markPendingSyncFailed(item.id, "network");
    const still = listPendingSyncItems({ includeDead: true }).find((x) => x.id === item.id);
    if (still?.dead && item.kind === "showcase-matrix-upsert") {
      if (isDistributionDebugEnabled()) {
        console.debug("[dist-recon] pending-sync:matrix-upsert:dead", {
          itemId: item.id,
          reason: "network",
          stillDead: !!still?.dead,
        });
      }
      notifyShowcaseMatrixSyncDead("network");
    }
  } else {
    markPendingSyncFailed(item.id, err);
    const still = listPendingSyncItems({ includeDead: true }).find((x) => x.id === item.id);
    if (still?.dead && item.kind === "showcase-matrix-upsert") {
      if (isDistributionDebugEnabled()) {
        console.debug("[dist-recon] pending-sync:matrix-upsert:dead", {
          itemId: item.id,
          reason: err,
          stillDead: !!still?.dead,
        });
      }
      notifyShowcaseMatrixSyncDead(err);
    }
  }
}

export async function runOverridesPendingSyncOnce(): Promise<OverridesPendingSyncRunResult | null> {
  if (running || typeof window === "undefined") return null;
  if (!navigator.onLine) {
    return { processed: 0, succeeded: 0, failed: 0, errors: [{ id: "-", kind: "-", error: "offline" }] };
  }
  running = true;
  const result: OverridesPendingSyncRunResult = { processed: 0, succeeded: 0, failed: 0, errors: [] };
  try {
    const items = listPendingSyncItems();
    for (const item of items) {
      result.processed += 1;
      const beforeFailed = item.lastError;
      await processItem(item);
      const still = listPendingSyncItems({ includeDead: true }).find((x) => x.id === item.id);
      if (!still) {
        result.succeeded += 1;
      } else if (still.dead) {
        result.failed += 1;
        result.errors.push({
          id: item.id,
          kind: item.kind,
          error: still.lastError ?? "dead",
        });
      } else {
        result.failed += 1;
        result.errors.push({
          id: item.id,
          kind: item.kind,
          error: still.lastError ?? beforeFailed ?? "save failed",
        });
      }
    }
    return result;
  } finally {
    running = false;
  }
}

export type OverridesPendingSyncRunResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: { id: string; kind: string; error: string }[];
};

export function startOverridesPendingSyncWorker(): void {
  if (typeof window === "undefined" || timer != null) return;
  purgeStaleDeadPendingSync();
  void runOverridesPendingSyncOnce();
  timer = setInterval(() => void runOverridesPendingSyncOnce(), INTERVAL_MS);
  purgeTimer = setInterval(() => purgeStaleDeadPendingSync(), PURGE_INTERVAL_MS);
  window.addEventListener("online", () => void runOverridesPendingSyncOnce());
}

export function stopOverridesPendingSyncWorker(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
  if (purgeTimer != null) {
    clearInterval(purgeTimer);
    purgeTimer = null;
  }
}
