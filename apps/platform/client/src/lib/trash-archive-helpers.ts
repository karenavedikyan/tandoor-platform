/**
 * Хелперы для секции «Корзина» на /trash.
 */
import type { ReleaseClient } from "./release-client-data.js";
import {
  type ActualizationState,
  type TrashedDealerInfo,
  type TrashedTradePointInfo,
} from "./client-base-actualization-state.js";
import {
  snapshotDealerFromRow,
  snapshotTradePointFromRow,
} from "./trash-dealer-helper.js";

function fieldStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function buildReleaseClientByDealerId(clients: ReleaseClient[]): Map<string, ReleaseClient> {
  const m = new Map<string, ReleaseClient>();
  for (const c of clients) m.set(c.id, c);
  return m;
}

export function buildDealerTrashSnapshotFromState(
  state: ActualizationState,
  dealerId: string,
  releaseById: Map<string, ReleaseClient>,
): TrashedDealerInfo["snapshot"] {
  const manual = state.manuallyCreatedDealersById?.[dealerId];
  const override = state.dealerOverridesById?.[dealerId];
  const fields = { ...(override?.fields ?? {}), ...(manual?.fields ?? {}) };
  const release = releaseById.get(dealerId);
  const fullName = fieldStr(fields.name) || release?.name?.trim() || null;
  const city = fieldStr(fields.city) || release?.city?.trim() || null;
  const inn = fieldStr(fields.inn) || null;
  const dealerCode = manual?.internalCode?.trim() || release?.code?.trim() || null;
  const legalEntityName = fieldStr(fields.legalEntityName) || null;
  return snapshotDealerFromRow({ fullName, city, inn, dealerCode, legalEntityName });
}

export function buildTpTrashSnapshotFromState(
  state: ActualizationState,
  tradePointId: string,
  dealerId: string,
  releaseById: Map<string, ReleaseClient>,
): TrashedTradePointInfo["snapshot"] {
  const manual = state.manuallyCreatedTradePointsById?.[tradePointId];
  const override = state.tradePointOverridesById?.[tradePointId];
  const fields = { ...(override?.fields ?? {}), ...(manual?.fields ?? {}) };
  const release = releaseById.get(dealerId);
  return snapshotTradePointFromRow({
    name: fieldStr(fields.name) || null,
    address: fieldStr(fields.address) || null,
    city: fieldStr(fields.city) || release?.city?.trim() || null,
    tradePointCode: manual?.internalCode?.trim() || fieldStr(fields.tradePointCode) || null,
    dealerFullName: release?.name?.trim() || dealerId,
  });
}
