/**
 * Клиентский слой витринной матрицы: кэш + оффлайн-очередь (Промт 151).
 */

import {
  fetchShowcaseMatrixList,
  type ShowcaseMatrixEntryDto,
  type ShowcasePlacementSegment,
  type ShowcasePlacementType,
  type ShowcaseMatrixStatus,
  type ShowcaseMatrixTargetKind,
} from "@/lib/showcase-matrix-api";
import { enqueuePendingSync, makePendingId } from "@/lib/overrides-pending-sync";
import { runOverridesPendingSyncOnce } from "@/lib/overrides-pending-sync-worker";

export const SHOWCASE_MATRIX_STORE_CACHE_KEY = "tandoor:showcase-matrix:cache-v1";
export const SHOWCASE_MATRIX_STORE_CHANGED_EVENT = "tandoor:showcase-matrix:changed";

export const SHOWCASE_MATRIX_REMOTE_UPDATE_EVENT = "tandoor:showcase-matrix:remote-update";

export function showcaseMatrixCacheKey(
  tradePointId: string,
  targetKind: ShowcaseMatrixTargetKind,
  targetId: string,
): string {
  return `${tradePointId}|${targetKind}|${targetId}`;
}

function newClientOpId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function loadCacheRecord(): Record<string, ShowcaseMatrixEntryDto> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, ShowcaseMatrixEntryDto>;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function saveCacheRecord(record: Record<string, ShowcaseMatrixEntryDto>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SHOWCASE_MATRIX_STORE_CACHE_KEY, JSON.stringify(record));
  window.dispatchEvent(new CustomEvent(SHOWCASE_MATRIX_STORE_CHANGED_EVENT));
}

function entriesForTradePoint(
  record: Record<string, ShowcaseMatrixEntryDto>,
  tradePointId: string,
): ShowcaseMatrixEntryDto[] {
  const prefix = `${tradePointId}|`;
  return Object.entries(record)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, entry]) => entry);
}

function cacheSnapshot(entries: ShowcaseMatrixEntryDto[]): string {
  if (entries.length === 0) return "0:";
  const maxUpdatedAt = entries.reduce(
    (max, e) => (e.updatedAt > max ? e.updatedAt : max),
    entries[0]!.updatedAt,
  );
  return `${entries.length}:${maxUpdatedAt}`;
}

function mergeTradePointEntries(
  record: Record<string, ShowcaseMatrixEntryDto>,
  tradePointId: string,
  entries: ShowcaseMatrixEntryDto[],
): Record<string, ShowcaseMatrixEntryDto> {
  const next = { ...record };
  const prefix = `${tradePointId}|`;
  for (const key of Object.keys(next)) {
    if (key.startsWith(prefix)) delete next[key];
  }
  for (const entry of entries) {
    next[showcaseMatrixCacheKey(entry.tradePointId, entry.targetKind, entry.targetId)] = entry;
  }
  return next;
}

/** Записать entries batch scope-fetch в существующий кэш матрицы. */
export function applyScopeEntriesToMatrixCache(entries: readonly ShowcaseMatrixEntryDto[]): void {
  if (entries.length === 0) return;
  let record = loadCacheRecord();
  const byTp = new Map<string, ShowcaseMatrixEntryDto[]>();
  for (const entry of entries) {
    const list = byTp.get(entry.tradePointId) ?? [];
    list.push(entry);
    byTp.set(entry.tradePointId, list);
  }
  for (const [tradePointId, list] of Array.from(byTp.entries())) {
    record = mergeTradePointEntries(record, tradePointId, list);
  }
  saveCacheRecord(record);
}

export function notifyMatrixUpdated(detail: {
  tradePointId: string;
  dealerId?: string;
  byName?: string;
}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SHOWCASE_MATRIX_REMOTE_UPDATE_EVENT, { detail }),
  );
}

export function loadCachedMatrix(tradePointId: string): ShowcaseMatrixEntryDto[] {
  return entriesForTradePoint(loadCacheRecord(), tradePointId);
}

export async function refreshMatrixFromServer(
  tradePointId: string,
  dealerId?: string,
): Promise<ShowcaseMatrixEntryDto[]> {
  const before = loadCachedMatrix(tradePointId);
  const beforeSnapshot = cacheSnapshot(before);

  const fromServer = await fetchShowcaseMatrixList({ tradePointId, dealerId });
  if (fromServer == null) {
    return loadCachedMatrix(tradePointId);
  }

  const record = mergeTradePointEntries(loadCacheRecord(), tradePointId, fromServer);
  saveCacheRecord(record);

  const afterSnapshot = cacheSnapshot(fromServer);
  if (beforeSnapshot !== afterSnapshot) {
    const latest = fromServer.reduce<ShowcaseMatrixEntryDto | null>((best, e) => {
      if (!best || e.updatedAt > best.updatedAt) return e;
      return best;
    }, null);
    notifyMatrixUpdated({
      tradePointId,
      dealerId: dealerId ?? latest?.dealerId,
      byName: latest?.updatedByName ?? undefined,
    });
  }

  return fromServer;
}

const NULL_PLACEMENT_FIELDS = {
  placementType: null,
  placementSegment: null,
  placementCapacity: null,
  placementActual: null,
  placementRef: null,
  placementOurModels: [] as ShowcaseMatrixEntryDto["placementOurModels"],
  placementCompetitors: [] as ShowcaseMatrixEntryDto["placementCompetitors"],
} as const;

function enqueueShowcaseMatrixUpsert(
  clientOpId: string,
  payload: Record<string, unknown>,
): void {
  enqueuePendingSync({
    id: makePendingId("showcase-matrix-upsert", clientOpId),
    kind: "showcase-matrix-upsert",
    payload,
  });
  void runOverridesPendingSyncOnce();
}

export function loadCachedPlacements(tradePointId: string): ShowcaseMatrixEntryDto[] {
  return loadCachedMatrix(tradePointId).filter((e) => e.targetKind === "placement");
}

export function loadCachedPlacementModels(
  tradePointId: string,
  blockTargetId: string,
): ShowcaseMatrixEntryDto[] {
  return loadCachedMatrix(tradePointId).filter(
    (e) =>
      (e.targetKind === "model" || e.targetKind === "variant") && e.placementRef === blockTargetId,
  );
}

export function setMatrixPlacement(params: {
  dealerId: string;
  tradePointId: string;
  targetId: string;
  placementType: ShowcasePlacementType;
  placementSegment: ShowcasePlacementSegment;
  placementCapacity: number;
  placementActual: number;
  placementCompetitors?: ShowcaseMatrixEntryDto["placementCompetitors"];
  comment?: string | null;
  updatedBy?: string;
  updatedByName?: string;
}): { entry: ShowcaseMatrixEntryDto; queued: boolean } {
  const clientOpId = newClientOpId();
  const now = new Date().toISOString();
  const comment = params.comment ?? null;

  const cacheKey = showcaseMatrixCacheKey(params.tradePointId, "placement", params.targetId);
  const prev = loadCacheRecord()[cacheKey];
  const placementOurModels = prev?.placementOurModels ?? [];
  const placementCompetitors = params.placementCompetitors ?? prev?.placementCompetitors ?? [];

  const entry: ShowcaseMatrixEntryDto = {
    id: prev?.id ?? `local-${clientOpId}`,
    dealerId: params.dealerId,
    tradePointId: params.tradePointId,
    targetKind: "placement",
    targetId: params.targetId,
    status: "installed",
    comment,
    updatedAt: now,
    updatedBy: params.updatedBy ?? null,
    updatedByName: params.updatedByName ?? null,
    placementType: params.placementType,
    placementSegment: params.placementSegment,
    placementCapacity: params.placementCapacity,
    placementActual: params.placementActual,
    placementRef: null,
    placementOurModels,
    placementCompetitors,
  };

  const record = loadCacheRecord();
  record[cacheKey] = entry;
  saveCacheRecord(record);

  enqueueShowcaseMatrixUpsert(clientOpId, {
    dealerId: params.dealerId,
    tradePointId: params.tradePointId,
    targetKind: "placement",
    targetId: params.targetId,
    status: "installed",
    comment,
    clientOpId,
    placementType: params.placementType,
    placementSegment: params.placementSegment,
    placementCapacity: params.placementCapacity,
    placementActual: params.placementActual,
    placementRef: null,
    placementOurModels,
    placementCompetitors,
  });

  return { entry, queued: true };
}

export function setMatrixPlacementModel(params: {
  dealerId: string;
  tradePointId: string;
  targetKind: "model" | "variant";
  targetId: string;
  placementRef: string;
  status: ShowcaseMatrixStatus;
  comment?: string | null;
  updatedBy?: string;
  updatedByName?: string;
}): { entry: ShowcaseMatrixEntryDto; queued: boolean } {
  const clientOpId = newClientOpId();
  const now = new Date().toISOString();
  const comment = params.comment ?? null;

  const entry: ShowcaseMatrixEntryDto = {
    id: `local-${clientOpId}`,
    dealerId: params.dealerId,
    tradePointId: params.tradePointId,
    targetKind: params.targetKind,
    targetId: params.targetId,
    status: params.status,
    comment,
    updatedAt: now,
    updatedBy: params.updatedBy ?? null,
    updatedByName: params.updatedByName ?? null,
    ...NULL_PLACEMENT_FIELDS,
    placementRef: params.placementRef,
  };

  const record = loadCacheRecord();
  record[showcaseMatrixCacheKey(params.tradePointId, params.targetKind, params.targetId)] = entry;
  saveCacheRecord(record);

  enqueueShowcaseMatrixUpsert(clientOpId, {
    dealerId: params.dealerId,
    tradePointId: params.tradePointId,
    targetKind: params.targetKind,
    targetId: params.targetId,
    status: params.status,
    comment,
    clientOpId,
    placementRef: params.placementRef,
  });

  return { entry, queued: true };
}

export function setMatrixStatus(params: {
  dealerId: string;
  tradePointId: string;
  targetKind: ShowcaseMatrixTargetKind;
  targetId: string;
  status: ShowcaseMatrixStatus;
  comment?: string | null;
  updatedBy?: string;
  updatedByName?: string;
  placementType?: ShowcasePlacementType | null;
  placementSegment?: ShowcasePlacementSegment | null;
}): { entry: ShowcaseMatrixEntryDto; queued: boolean } {
  const clientOpId = newClientOpId();
  const now = new Date().toISOString();
  const comment = params.comment ?? null;

  const cacheKey = showcaseMatrixCacheKey(params.tradePointId, params.targetKind, params.targetId);
  const prev = loadCacheRecord()[cacheKey];
  const placementType =
    params.placementType !== undefined ? params.placementType : (prev?.placementType ?? null);
  const placementSegment =
    params.placementSegment !== undefined ? params.placementSegment : (prev?.placementSegment ?? null);
  const placementCapacity = prev?.placementCapacity ?? null;
  const placementActual = prev?.placementActual ?? null;
  const placementRef = prev?.placementRef ?? null;
  const placementOurModels = prev?.placementOurModels ?? [];
  const placementCompetitors = prev?.placementCompetitors ?? [];

  const entry: ShowcaseMatrixEntryDto = {
    id: prev?.id ?? `local-${clientOpId}`,
    dealerId: params.dealerId,
    tradePointId: params.tradePointId,
    targetKind: params.targetKind,
    targetId: params.targetId,
    status: params.status,
    comment,
    updatedAt: now,
    updatedBy: params.updatedBy ?? null,
    updatedByName: params.updatedByName ?? null,
    placementType,
    placementSegment,
    placementCapacity,
    placementActual,
    placementRef,
    placementOurModels,
    placementCompetitors,
  };

  const record = loadCacheRecord();
  record[cacheKey] = entry;
  saveCacheRecord(record);

  enqueueShowcaseMatrixUpsert(clientOpId, {
    dealerId: params.dealerId,
    tradePointId: params.tradePointId,
    targetKind: params.targetKind,
    targetId: params.targetId,
    status: params.status,
    comment,
    clientOpId,
    placementType,
    placementSegment,
    placementCapacity,
    placementActual,
    placementRef,
  });

  return { entry, queued: true };
}
