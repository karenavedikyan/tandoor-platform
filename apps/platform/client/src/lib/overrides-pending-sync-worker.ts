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
import {
  dequeuePendingSync,
  listPendingSyncItems,
  markPendingSyncFailed,
  type PendingSyncItem,
} from "@/lib/overrides-pending-sync";

const INTERVAL_MS = 15_000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

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

export async function runOverridesPendingSyncOnce(): Promise<void> {
  if (running || typeof window === "undefined") return;
  if (!navigator.onLine) return;
  running = true;
  try {
    const items = listPendingSyncItems();
    for (const item of items) {
      await processItem(item);
    }
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
