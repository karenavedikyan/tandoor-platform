/**
 * Хелперы для секции «Архив» на /trash (Промт 70.5).
 */
import type { ReleaseClient } from "@/lib/release-client-data";
import {
  type ActualizationState,
  type ArchivedDealerInfo,
  type ArchivedTradePointInfo,
  mergeActualizationState,
  type TrashedDealerInfo,
  type TrashedTradePointInfo,
} from "@/lib/client-base-actualization-state";
import {
  makeTrashedDealerInfo,
  makeTrashedTradePointInfo,
  snapshotDealerFromRow,
  snapshotTradePointFromRow,
  type TrashActor,
} from "@/lib/trash-dealer-helper";

export const ARCHIVE_PAGE_SIZE = 100;

export type ArchiveDealerSort = "archived_desc" | "archived_asc" | "name_asc" | "name_desc";

export type ArchiveTpSort = ArchiveDealerSort;

export type ArchivedDealerDisplay = {
  info: ArchivedDealerInfo;
  dealerId: string;
  name: string;
  city: string;
  inn: string;
  dealerCode: string;
  releaseCode: string;
  searchBlob: string;
};

export type ArchivedTpDisplay = {
  info: ArchivedTradePointInfo;
  tradePointId: string;
  name: string;
  address: string;
  city: string;
  tradePointCode: string;
  dealerFullName: string;
  searchBlob: string;
};

function fieldStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function buildReleaseClientByDealerId(clients: ReleaseClient[]): Map<string, ReleaseClient> {
  const m = new Map<string, ReleaseClient>();
  for (const c of clients) m.set(c.id, c);
  return m;
}

export function buildArchivedDealerDisplay(
  info: ArchivedDealerInfo,
  state: ActualizationState,
  releaseById: Map<string, ReleaseClient>,
): ArchivedDealerDisplay {
  const dealerId = info.dealerId;
  const manual = state.manuallyCreatedDealersById?.[dealerId];
  const override = state.dealerOverridesById?.[dealerId];
  const fields = { ...(override?.fields ?? {}), ...(manual?.fields ?? {}) };
  const release = releaseById.get(dealerId);
  const name = fieldStr(fields.name) || release?.name?.trim() || dealerId;
  const city = fieldStr(fields.city) || release?.city?.trim() || "";
  const inn = fieldStr(fields.inn) || "";
  const releaseCode = release?.code?.trim() || "";
  const dealerCode = manual?.internalCode?.trim() || releaseCode;
  const searchBlob = [name, dealerCode, releaseCode, inn, city, dealerId].join(" ").toLowerCase();
  return { info, dealerId, name, city, inn, dealerCode, releaseCode, searchBlob };
}

export function buildArchivedTpDisplay(
  info: ArchivedTradePointInfo,
  state: ActualizationState,
  releaseById: Map<string, ReleaseClient>,
): ArchivedTpDisplay {
  const tradePointId = info.tradePointId;
  const manual = state.manuallyCreatedTradePointsById?.[tradePointId];
  const override = state.tradePointOverridesById?.[tradePointId];
  const fields = { ...(override?.fields ?? {}), ...(manual?.fields ?? {}) };
  const release = releaseById.get(info.dealerId);
  const dealerFullName = release?.name?.trim() || info.dealerId;
  const name = fieldStr(fields.name) || "";
  const address = fieldStr(fields.address) || "";
  const city = fieldStr(fields.city) || release?.city?.trim() || "";
  const tradePointCode = manual?.internalCode?.trim() || fieldStr(fields.tradePointCode) || "";
  const searchBlob = [name, address, city, tradePointCode, dealerFullName, tradePointId, info.dealerId]
    .join(" ")
    .toLowerCase();
  return { info, tradePointId, name, address, city, tradePointCode, dealerFullName, searchBlob };
}

export function sortArchivedDealers(rows: ArchivedDealerDisplay[], sort: ArchiveDealerSort): ArchivedDealerDisplay[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "archived_desc") return Date.parse(b.info.archivedAt) - Date.parse(a.info.archivedAt);
    if (sort === "archived_asc") return Date.parse(a.info.archivedAt) - Date.parse(b.info.archivedAt);
    const cmp = a.name.localeCompare(b.name, "ru");
    return sort === "name_desc" ? -cmp : cmp;
  });
  return copy;
}

export function sortArchivedTps(rows: ArchivedTpDisplay[], sort: ArchiveTpSort): ArchivedTpDisplay[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "archived_desc") return Date.parse(b.info.archivedAt) - Date.parse(a.info.archivedAt);
    if (sort === "archived_asc") return Date.parse(a.info.archivedAt) - Date.parse(b.info.archivedAt);
    const cmp = a.name.localeCompare(b.name, "ru");
    return sort === "name_desc" ? -cmp : cmp;
  });
  return copy;
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
  archived: ArchivedTradePointInfo,
  releaseById: Map<string, ReleaseClient>,
): TrashedTradePointInfo["snapshot"] {
  const manual = state.manuallyCreatedTradePointsById?.[tradePointId];
  const override = state.tradePointOverridesById?.[tradePointId];
  const fields = { ...(override?.fields ?? {}), ...(manual?.fields ?? {}) };
  const release = releaseById.get(archived.dealerId);
  return snapshotTradePointFromRow({
    name: fieldStr(fields.name) || null,
    address: fieldStr(fields.address) || null,
    city: fieldStr(fields.city) || release?.city?.trim() || null,
    tradePointCode: manual?.internalCode?.trim() || fieldStr(fields.tradePointCode) || null,
    dealerFullName: release?.name?.trim() || archived.dealerId,
  });
}

export function restoreArchivedDealersPatch(prev: ActualizationState, ids: string[]): ActualizationState {
  const next = { ...prev.archivedDealersById };
  for (const id of ids) delete next[id];
  return mergeActualizationState(prev, { archivedDealersById: next });
}

export function restoreArchivedTpsPatch(prev: ActualizationState, ids: string[]): ActualizationState {
  const next = { ...prev.archivedTradePointsById };
  for (const id of ids) delete next[id];
  return mergeActualizationState(prev, { archivedTradePointsById: next });
}

export function moveArchivedDealersToTrashPatch(
  prev: ActualizationState,
  ids: string[],
  by: TrashActor,
  releaseById: Map<string, ReleaseClient>,
): ActualizationState {
  const archivedNext = { ...prev.archivedDealersById };
  const trashedNext = { ...prev.trashedDealersById };
  for (const id of ids) {
    if (!archivedNext[id]) continue;
    delete archivedNext[id];
    trashedNext[id] = makeTrashedDealerInfo({
      dealerId: id,
      by,
      snapshot: buildDealerTrashSnapshotFromState(prev, id, releaseById),
      source: "client_bulk_delete",
    });
  }
  return mergeActualizationState(prev, { archivedDealersById: archivedNext, trashedDealersById: trashedNext });
}

export function moveArchivedTpsToTrashPatch(
  prev: ActualizationState,
  ids: string[],
  by: TrashActor,
  releaseById: Map<string, ReleaseClient>,
): ActualizationState {
  const archivedNext = { ...prev.archivedTradePointsById };
  const trashedNext = { ...prev.trashedTradePointsById };
  for (const id of ids) {
    const arch = archivedNext[id];
    if (!arch) continue;
    delete archivedNext[id];
    trashedNext[id] = makeTrashedTradePointInfo({
      tradePointId: id,
      dealerId: arch.dealerId,
      by,
      snapshot: buildTpTrashSnapshotFromState(prev, id, arch, releaseById),
      source: "client_bulk_delete",
    });
  }
  return mergeActualizationState(prev, { archivedTradePointsById: archivedNext, trashedTradePointsById: trashedNext });
}

export function forceDeleteArchivedDealersPatch(prev: ActualizationState, ids: string[]): ActualizationState {
  const archivedNext = { ...prev.archivedDealersById };
  const manualNext = { ...prev.manuallyCreatedDealersById };
  const overridesNext = { ...prev.dealerOverridesById };
  const contactsNext = { ...prev.dealerActualizationContactsById };
  const idSet = new Set(ids);
  for (const id of ids) {
    delete archivedNext[id];
    delete manualNext[id];
    delete overridesNext[id];
  }
  for (const [cid, contact] of Object.entries(contactsNext)) {
    if (idSet.has(contact.dealerId)) delete contactsNext[cid];
  }
  return mergeActualizationState(prev, {
    archivedDealersById: archivedNext,
    manuallyCreatedDealersById: manualNext,
    dealerOverridesById: overridesNext,
    dealerActualizationContactsById: contactsNext,
  });
}

export function forceDeleteArchivedTpsPatch(prev: ActualizationState, ids: string[]): ActualizationState {
  const archivedNext = { ...prev.archivedTradePointsById };
  const manualNext = { ...prev.manuallyCreatedTradePointsById };
  const overridesNext = { ...prev.tradePointOverridesById };
  const idSet = new Set(ids);
  for (const id of ids) {
    delete archivedNext[id];
    delete manualNext[id];
    delete overridesNext[id];
  }
  return mergeActualizationState(prev, {
    archivedTradePointsById: archivedNext,
    manuallyCreatedTradePointsById: manualNext,
    tradePointOverridesById: overridesNext,
  });
}
