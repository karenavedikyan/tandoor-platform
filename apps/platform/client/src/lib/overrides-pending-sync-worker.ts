/**
 * Фоновый воркер повторной синхронизации overrides (Промт 113.1).
 */

import {
  createManualDealerStrict,
  setDealerTrainingStrict,
  trashDealerStrict,
  untrashDealerStrict,
  upsertDealerOverrideStrict,
} from "@/lib/dealer-overrides-api";
import {
  setTradePointTrainingStrict,
  trashTradePointStrict,
  untrashTradePointStrict,
  upsertTradePointOverrideStrict,
} from "@/lib/trade-point-overrides-api";
import { apiCreateComment } from "@/lib/client-comments-api";
import {
  apiDeleteShipmentRoute,
  apiUpsertShipmentRoute,
} from "@/lib/dealer-shipment-routes-api";
import {
  dequeuePendingSync,
  listPendingSyncItems,
  markPendingSyncFailed,
  type PendingSyncItem,
} from "@/lib/overrides-pending-sync";
import { refreshDbCommentsForClient } from "@/lib/client-comments-db-cache";

const INTERVAL_MS = 15_000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export type OverridesPendingSyncRunResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: { id: string; kind: string; error: string }[];
};

async function processItem(item: PendingSyncItem): Promise<void> {
  const p = item.payload as Record<string, unknown>;
  let result: { ok: boolean } = { ok: false };

  switch (item.kind) {
    case "dealer-upsert":
      result = await upsertDealerOverrideStrict(
        String(p.dealer_id),
        (p.fields ?? {}) as Record<string, unknown>,
      );
      break;
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
        dayId: p.dayId as import("@/lib/dealer-shipment-days").DealerShipmentDayId,
        name: String(p.name ?? ""),
        cities: Array.isArray(p.cities) ? (p.cities as string[]) : [],
      });
      if (r.ok) {
        dequeuePendingSync(item.id);
      } else {
        markPendingSyncFailed(item.id, r.code ?? "save failed");
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
    default:
      return;
  }

  if (result.ok) {
    dequeuePendingSync(item.id);
  } else {
    const err =
      "message" in result && result.message
        ? String(result.message)
        : "network" in result && result.network
          ? "network"
          : "save failed";
    markPendingSyncFailed(item.id, err);
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
      const still = listPendingSyncItems().find((x) => x.id === item.id);
      if (!still) {
        result.succeeded += 1;
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

export function startOverridesPendingSyncWorker(): void {
  if (typeof window === "undefined" || timer != null) return;
  void runOverridesPendingSyncOnce();
  timer = setInterval(() => void runOverridesPendingSyncOnce(), INTERVAL_MS);
  window.addEventListener("online", () => void runOverridesPendingSyncOnce());
}

export function stopOverridesPendingSyncWorker(): void {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}
