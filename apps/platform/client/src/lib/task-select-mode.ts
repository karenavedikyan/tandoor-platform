import type { ActualizationState } from "./client-base-actualization-state.js";
import { mergeTradePointsForActualization } from "./client-base-actualization-data-merge.js";
import type { DealerRow } from "./dealer-base-mock-data.js";

export type TaskSelectTarget = {
  dealerId: string;
  tradePointId: string;
  dealerName: string;
  tradePointName: string;
  city: string;
};

const KEY_SEP = "|";

export function taskSelectTargetKey(dealerId: string, tradePointId: string): string {
  return `${dealerId}${KEY_SEP}${tradePointId}`;
}

export function parseTaskSelectTargetKey(key: string): { dealerId: string; tradePointId: string } | null {
  const idx = key.indexOf(KEY_SEP);
  if (idx <= 0) return null;
  const dealerId = key.slice(0, idx);
  const tradePointId = key.slice(idx + 1);
  if (!dealerId || !tradePointId) return null;
  return { dealerId, tradePointId };
}

export function activeTradePointsForDealerRow(row: DealerRow, act: ActualizationState) {
  return mergeTradePointsForActualization(row, act).filter((e) => !e.isArchived);
}

export function isTaskSelectModeFromParams(params: URLSearchParams): boolean {
  return params.get("taskSelect") === "1";
}
