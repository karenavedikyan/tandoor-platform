/**
 * Клиентский слой витринной матрицы: кэш + оффлайн-очередь (Промт 151).
 */

import {
  fetchShowcaseMatrixList,
  type ShowcaseMatrixEntryDto,
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

export function setMatrixStatus(params: {
  dealerId: string;
  tradePointId: string;
  targetKind: ShowcaseMatrixTargetKind;
  targetId: string;
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
  };

  const record = loadCacheRecord();
  record[showcaseMatrixCacheKey(params.tradePointId, params.targetKind, params.targetId)] = entry;
  saveCacheRecord(record);

  enqueuePendingSync({
    id: makePendingId("showcase-matrix-upsert", clientOpId),
    kind: "showcase-matrix-upsert",
    payload: {
      dealerId: params.dealerId,
      tradePointId: params.tradePointId,
      targetKind: params.targetKind,
      targetId: params.targetId,
      status: params.status,
      comment,
      clientOpId,
    },
  });

  void runOverridesPendingSyncOnce();

  return { entry, queued: true };
}
