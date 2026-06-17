/**
 * Клиентский слой справочника матриц: кэш + оффлайн-очередь (Промт 160).
 */

import {
  fetchMatrixDef,
  fetchMatrixDefList,
  type ShowcaseMatrixCatalogStatus,
  type ShowcaseMatrixDefDto,
  type ShowcaseMatrixDefListFilter,
  type ShowcaseMatrixDefModelDto,
  type ShowcaseMatrixDefModelInput,
  type ShowcaseMatrixDefUpsertInput,
  type ShowcaseMatrixDefWithModelsDto,
} from "./showcase-matrix-catalog-api.js";
import { enqueuePendingSync, makePendingId } from "./overrides-pending-sync.js";
import { runOverridesPendingSyncOnce } from "./overrides-pending-sync-worker.js";

export const SHOWCASE_MATRIX_CATALOG_CACHE_KEY = "tandoor:showcase-matrix-catalog:cache-v1";
export const SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT = "tandoor:showcase-matrix-catalog:changed";
export const SHOWCASE_MATRIX_CATALOG_REMOTE_UPDATE_EVENT =
  "tandoor:showcase-matrix-catalog:remote-update";

type CatalogCache = {
  headers: ShowcaseMatrixDefDto[];
  defsById: Record<string, ShowcaseMatrixDefWithModelsDto>;
};

function newClientOpId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function emptyCache(): CatalogCache {
  return { headers: [], defsById: {} };
}

function loadCache(): CatalogCache {
  if (typeof window === "undefined" || !window.localStorage) return emptyCache();
  try {
    const raw = window.localStorage.getItem(SHOWCASE_MATRIX_CATALOG_CACHE_KEY);
    if (!raw) return emptyCache();
    const p = JSON.parse(raw) as Partial<CatalogCache>;
    return {
      headers: Array.isArray(p.headers) ? p.headers : [],
      defsById: p.defsById && typeof p.defsById === "object" ? p.defsById : {},
    };
  } catch {
    return emptyCache();
  }
}

function saveCache(cache: CatalogCache): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SHOWCASE_MATRIX_CATALOG_CACHE_KEY, JSON.stringify(cache));
  window.dispatchEvent(new CustomEvent(SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT));
}

function listSnapshot(headers: ShowcaseMatrixDefDto[]): string {
  if (headers.length === 0) return "0:";
  const maxUpdatedAt = headers.reduce(
    (max, h) => (h.updatedAt > max ? h.updatedAt : max),
    headers[0]!.updatedAt,
  );
  return `${headers.length}:${maxUpdatedAt}`;
}

function defSnapshot(def: ShowcaseMatrixDefWithModelsDto): string {
  const maxModelUpdated = def.models.reduce(
    (max, m) => (m.updatedAt > max ? m.updatedAt : max),
    def.updatedAt,
  );
  return `${def.id}:${def.updatedAt}:${def.models.length}:${maxModelUpdated}`;
}

function matchesFilter(def: ShowcaseMatrixDefDto, filter: ShowcaseMatrixDefListFilter): boolean {
  if (filter.clientCategory && def.clientCategory !== filter.clientCategory) return false;
  if (filter.scopeKind && def.scopeKind !== filter.scopeKind) return false;
  if (filter.status && def.status !== filter.status) return false;
  if (filter.region) {
    const norm = filter.region.trim().toLocaleLowerCase("ru");
    if ((def.scopeRegion ?? "") !== norm) return false;
  }
  if (filter.city) {
    const norm = filter.city.trim().toLocaleLowerCase("ru");
    if ((def.scopeCity ?? "") !== norm) return false;
  }
  return true;
}

function upsertHeader(cache: CatalogCache, header: ShowcaseMatrixDefDto): CatalogCache {
  const headers = [...cache.headers];
  const idx = headers.findIndex((h) => h.id === header.id);
  if (idx >= 0) headers[idx] = header;
  else headers.unshift(header);
  return { ...cache, headers };
}

function upsertFullDef(cache: CatalogCache, def: ShowcaseMatrixDefWithModelsDto): CatalogCache {
  const next = upsertHeader(cache, def);
  return {
    ...next,
    defsById: { ...next.defsById, [def.id]: def },
  };
}

function removeDef(cache: CatalogCache, id: string): CatalogCache {
  const { [id]: _removed, ...defsById } = cache.defsById;
  return {
    headers: cache.headers.filter((h) => h.id !== id),
    defsById,
  };
}

function enqueueCatalogOp(
  kind:
    | "showcase-matrix-catalog-upsert"
    | "showcase-matrix-catalog-set-status"
    | "showcase-matrix-catalog-delete"
    | "showcase-matrix-catalog-replace-models",
  clientOpId: string,
  payload: Record<string, unknown>,
): void {
  enqueuePendingSync({
    id: makePendingId(kind, clientOpId),
    kind,
    payload,
  });
  void runOverridesPendingSyncOnce();
}

export function notifyMatrixCatalogUpdated(detail?: { defId?: string; byName?: string }): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SHOWCASE_MATRIX_CATALOG_REMOTE_UPDATE_EVENT, { detail }),
  );
}

export function loadCachedMatrixDefs(filter?: ShowcaseMatrixDefListFilter): ShowcaseMatrixDefDto[] {
  const headers = loadCache().headers;
  if (!filter) return [...headers];
  return headers.filter((h) => matchesFilter(h, filter));
}

export function loadCachedMatrixDef(defId: string): ShowcaseMatrixDefWithModelsDto | null {
  return loadCache().defsById[defId] ?? null;
}

export async function refreshMatrixCatalogFromServer(
  filter: ShowcaseMatrixDefListFilter = {},
): Promise<ShowcaseMatrixDefDto[]> {
  const before = loadCachedMatrixDefs(filter);
  const beforeSnapshot = listSnapshot(before);

  const fromServer = await fetchMatrixDefList(filter);
  if (fromServer == null) {
    return loadCachedMatrixDefs(filter);
  }

  const cache = loadCache();
  const mergedHeaders = [...cache.headers];
  for (const header of fromServer) {
    const idx = mergedHeaders.findIndex((h) => h.id === header.id);
    if (idx >= 0) mergedHeaders[idx] = header;
    else mergedHeaders.unshift(header);
  }
  saveCache({ ...cache, headers: mergedHeaders });

  const after = loadCachedMatrixDefs(filter);
  if (listSnapshot(after) !== beforeSnapshot) {
    const latest = after.reduce<ShowcaseMatrixDefDto | null>((best, h) => {
      if (!best || h.updatedAt > best.updatedAt) return h;
      return best;
    }, null);
    notifyMatrixCatalogUpdated({
      defId: latest?.id,
      byName: latest?.updatedByName ?? undefined,
    });
  }

  return after;
}

export async function refreshMatrixDefFromServer(
  defId: string,
): Promise<ShowcaseMatrixDefWithModelsDto | null> {
  const before = loadCachedMatrixDef(defId);
  const beforeSnapshot = before ? defSnapshot(before) : "";

  const fromServer = await fetchMatrixDef(defId);
  if (fromServer == null) {
    return loadCachedMatrixDef(defId);
  }

  const cache = upsertFullDef(loadCache(), fromServer);
  saveCache(cache);

  if (defSnapshot(fromServer) !== beforeSnapshot) {
    notifyMatrixCatalogUpdated({
      defId: fromServer.id,
      byName: fromServer.updatedByName ?? undefined,
    });
  }

  return fromServer;
}

export function upsertMatrixDefLocal(
  body: Omit<ShowcaseMatrixDefUpsertInput, "clientOpId"> & { clientOpId?: string },
): { def: ShowcaseMatrixDefDto; queued: boolean } {
  const clientOpId = body.clientOpId ?? newClientOpId();
  const now = new Date().toISOString();
  const existingId = body.id ?? `local-${clientOpId}`;
  const prevFull = loadCachedMatrixDef(existingId);

  const header: ShowcaseMatrixDefDto = {
    id: existingId,
    clientCategory: body.clientCategory,
    scopeKind: body.scopeKind,
    scopeRegion: body.scopeRegion ?? null,
    scopeCity: body.scopeCity ?? null,
    effectiveFrom: body.effectiveFrom ?? null,
    effectiveTo: body.effectiveTo ?? null,
    seasonLabel: body.seasonLabel ?? null,
    status: body.status ?? "draft",
    title: body.title ?? null,
    comment: body.comment ?? null,
    clientOpId,
    createdAt: prevFull?.createdAt ?? now,
    updatedAt: now,
    updatedBy: prevFull?.updatedBy ?? null,
    updatedByName: prevFull?.updatedByName ?? null,
  };

  const cache = loadCache();
  const withHeader = upsertHeader(cache, header);
  const full: ShowcaseMatrixDefWithModelsDto = {
    ...header,
    models: prevFull?.models ?? [],
  };
  saveCache({ ...withHeader, defsById: { ...withHeader.defsById, [full.id]: full } });

  const payload: ShowcaseMatrixDefUpsertInput = { ...body, clientOpId };
  enqueueCatalogOp("showcase-matrix-catalog-upsert", clientOpId, payload as unknown as Record<string, unknown>);

  return { def: header, queued: true };
}

export function setMatrixDefStatusLocal(
  id: string,
  status: ShowcaseMatrixCatalogStatus,
): { def: ShowcaseMatrixDefDto; queued: boolean } {
  const clientOpId = newClientOpId();
  const now = new Date().toISOString();
  const cache = loadCache();
  const prev = cache.defsById[id] ?? cache.headers.find((h) => h.id === id);
  if (!prev) {
    throw new Error(`Matrix def not in cache: ${id}`);
  }

  const header: ShowcaseMatrixDefDto = {
    ...(cache.defsById[id] ?? (prev as ShowcaseMatrixDefDto)),
    status,
    updatedAt: now,
  };

  let next = upsertHeader(cache, header);
  const full = next.defsById[id];
  if (full) {
    next = upsertFullDef(next, { ...full, status, updatedAt: now });
  }
  saveCache(next);

  enqueueCatalogOp("showcase-matrix-catalog-set-status", clientOpId, { id, status, clientOpId });

  return { def: header, queued: true };
}

export function deleteMatrixDefLocal(id: string): { queued: boolean } {
  const clientOpId = newClientOpId();
  saveCache(removeDef(loadCache(), id));
  enqueueCatalogOp("showcase-matrix-catalog-delete", clientOpId, { id, clientOpId });
  return { queued: true };
}

export function replaceMatrixDefModelsLocal(
  defId: string,
  models: ShowcaseMatrixDefModelInput[],
): { models: ShowcaseMatrixDefModelDto[]; queued: boolean } {
  const clientOpId = newClientOpId();
  const now = new Date().toISOString();
  const cache = loadCache();
  const prev =
    cache.defsById[defId] ??
    (() => {
      const h = cache.headers.find((x) => x.id === defId);
      if (!h) throw new Error(`Matrix def not in cache: ${defId}`);
      return { ...h, models: [] };
    })();

  const localModels = models.map((m, index) => ({
    id: m.id ?? `local-model-${clientOpId}-${index}`,
    defId,
    targetKind: m.targetKind,
    targetId: m.targetId,
    priority: m.priority ?? "medium",
    segment: m.segment,
    valueWeight: m.valueWeight ?? null,
    catalog1cId: m.catalog1cId ?? null,
    sortOrder: m.sortOrder ?? index,
    createdAt: now,
    updatedAt: now,
  }));

  const def: ShowcaseMatrixDefWithModelsDto = {
    ...prev,
    models: localModels,
    updatedAt: now,
  };
  saveCache(upsertFullDef(cache, def));

  enqueueCatalogOp("showcase-matrix-catalog-replace-models", clientOpId, {
    defId,
    models,
    clientOpId,
  });

  return { models: localModels, queued: true };
}
