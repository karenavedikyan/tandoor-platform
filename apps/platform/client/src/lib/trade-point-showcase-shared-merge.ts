import type {
  ActualizationState,
  TradePointShowcaseActualization,
} from "@/lib/client-base-actualization-state";

function recordUpdatedAtMs(rec: TradePointShowcaseActualization | undefined): number {
  if (!rec?.updatedAt) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(rec.updatedAt);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

export function mergeActualizationWithSharedShowcaseStore(
  act: ActualizationState,
  recordByTradePointId: Record<string, TradePointShowcaseActualization>,
): ActualizationState {
  const entries = Object.entries(recordByTradePointId);
  if (entries.length === 0) return act;

  const nextMap = { ...act.tradePointShowcaseActualizationById };
  let changed = false;

  for (const [tradePointId, sharedRec] of entries) {
    const localRec = nextMap[tradePointId];
    if (!localRec) {
      nextMap[tradePointId] = sharedRec;
      changed = true;
      continue;
    }
    if (recordUpdatedAtMs(sharedRec) > recordUpdatedAtMs(localRec)) {
      nextMap[tradePointId] = sharedRec;
      changed = true;
    }
  }

  if (!changed) return act;
  return { ...act, tradePointShowcaseActualizationById: nextMap };
}

export function sharedShowcaseStoreContentKey(
  recordByTradePointId: Record<string, TradePointShowcaseActualization>,
): string {
  const entries = Object.entries(recordByTradePointId);
  if (entries.length === 0) return "";
  return entries
    .map(([id, rec]) => `${id}:${rec.updatedAt ?? ""}`)
    .sort()
    .join("|");
}
