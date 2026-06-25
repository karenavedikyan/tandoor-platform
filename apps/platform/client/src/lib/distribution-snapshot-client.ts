import type { ActualizationState } from "./client-base-actualization-state.js";
import {
  createEmptyActualizationState,
  mergeActualizationState,
  normalizeActualizationStateShowcases,
} from "./client-base-actualization-state.js";
import { ACTUALIZATION_STATE_CACHE_KEY } from "./client-base-actualization-api.js";
import { computeDistributionForTradePoint } from "./distribution-analytics/distribution-analytics-math.js";
import type { DistributionSnapshotByTypeNumbers } from "./distribution-snapshot-aggregate.js";
import { loadCachedMatrix } from "./showcase-matrix-store.js";

export type DistributionSnapshotInput = {
  tradePointId: string;
  dealerId?: string | null;
  byType: DistributionSnapshotByTypeNumbers;
};

function normalizeCachedActualizationState(raw: unknown): ActualizationState {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return createEmptyActualizationState();
  }
  return normalizeActualizationStateShowcases(
    mergeActualizationState(createEmptyActualizationState(), raw as Partial<ActualizationState>),
  );
}

export function readCachedActualizationStateLoose(): ActualizationState | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(ACTUALIZATION_STATE_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { state?: unknown };
    if (!p?.state) return null;
    return normalizeCachedActualizationState(p.state);
  } catch {
    return null;
  }
}

export function buildDistributionSnapshotByTypeForTradePoint(
  tradePointId: string,
  act: ActualizationState,
): DistributionSnapshotByTypeNumbers {
  const sh = act.tradePointShowcaseActualizationById[tradePointId];
  const installedEntries = loadCachedMatrix(tradePointId).filter((e) => e.status === "installed");
  const m = computeDistributionForTradePoint(sh, installedEntries);
  return {
    entrance: {
      capacity: m.byType.entrance.capacity ?? 0,
      onShelf: m.byType.entrance.tandoorOnShelf,
    },
    interior: {
      capacity: m.byType.interior.capacity ?? 0,
      onShelf: m.byType.interior.tandoorOnShelf,
    },
    hardware: {
      capacity: m.byType.hardware.capacity ?? 0,
      onShelf: m.byType.hardware.tandoorOnShelf,
    },
  };
}

export function buildDistributionSnapshotInput(
  tradePointId: string,
  act: ActualizationState,
  dealerId?: string | null,
): DistributionSnapshotInput {
  return {
    tradePointId,
    dealerId: dealerId ?? shDealerId(act, tradePointId),
    byType: buildDistributionSnapshotByTypeForTradePoint(tradePointId, act),
  };
}

function shDealerId(act: ActualizationState, tradePointId: string): string | null {
  const sh = act.tradePointShowcaseActualizationById[tradePointId];
  return sh?.dealerId?.trim() || null;
}

export async function apiUpsertDistributionSnapshot(input: DistributionSnapshotInput): Promise<void> {
  try {
    await fetch("/api/showcase-matrix/snapshot-upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
  } catch (e) {
    console.warn("[distribution-snapshot] upsert failed", e);
  }
}

export async function triggerDistributionSnapshotAfterMatrixSave(params: {
  tradePointId: string;
  dealerId?: string | null;
  act?: ActualizationState;
}): Promise<void> {
  const act = params.act ?? readCachedActualizationStateLoose();
  if (!act) return;
  const input = buildDistributionSnapshotInput(params.tradePointId, act, params.dealerId);
  await apiUpsertDistributionSnapshot(input);
}

export async function triggerDistributionSnapshotsAfterBatchSave(
  operations: readonly { tradePointId?: string; dealerId?: string }[],
  act?: ActualizationState,
): Promise<void> {
  const resolvedAct = act ?? readCachedActualizationStateLoose();
  if (!resolvedAct) return;

  const seen = new Set<string>();
  for (const op of operations) {
    const tradePointId = typeof op.tradePointId === "string" ? op.tradePointId.trim() : "";
    if (!tradePointId || seen.has(tradePointId)) continue;
    seen.add(tradePointId);
    const dealerId = typeof op.dealerId === "string" ? op.dealerId.trim() : null;
    const input = buildDistributionSnapshotInput(tradePointId, resolvedAct, dealerId);
    await apiUpsertDistributionSnapshot(input);
  }
}
