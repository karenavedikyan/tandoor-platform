/**
 * HTTP API витринной матрицы (Postgres) — Промт 151.
 */

export type ShowcaseMatrixTargetKind = "model" | "variant" | "placement";
export type ShowcaseMatrixStatus = "need_install" | "installed" | "postponed" | "not_relevant";

export type ShowcasePlacementType =
  | "portal"
  | "cube"
  | "book"
  | "hoof"
  | "unmounted"
  | "branded_stand"
  | "stream_sku";

export type ShowcasePlacementSegment = "vh" | "mk" | "hardware";

export type ShowcasePlacementOurModel = { modelId: string; count: number };
export type ShowcasePlacementCompetitor = { brand: string; count: number };

export type ShowcaseMatrixEntryDto = {
  id: string;
  dealerId: string;
  tradePointId: string;
  targetKind: ShowcaseMatrixTargetKind;
  targetId: string;
  status: ShowcaseMatrixStatus;
  comment: string | null;
  updatedAt: string;
  updatedBy: string | null;
  updatedByName: string | null;
  placementType: ShowcasePlacementType | null;
  placementSegment: ShowcasePlacementSegment | null;
  placementCapacity: number | null;
  placementActual: number | null;
  placementRef: string | null;
  placementOurModels: ShowcasePlacementOurModel[];
  placementCompetitors: ShowcasePlacementCompetitor[];
};

export type ShowcaseMatrixEventDto = {
  id: string;
  entryId: string | null;
  dealerId: string;
  tradePointId: string;
  targetKind: ShowcaseMatrixTargetKind;
  targetId: string;
  oldStatus: string | null;
  newStatus: string | null;
  comment: string | null;
  changedBy: string | null;
  changedByName: string | null;
  changedAt: string;
  placementType: ShowcasePlacementType | null;
  placementSegment: ShowcasePlacementSegment | null;
  placementCapacity: number | null;
  placementActual: number | null;
  placementRef: string | null;
  placementOurModels: ShowcasePlacementOurModel[];
  placementCompetitors: ShowcasePlacementCompetitor[];
};

export type ShowcaseMatrixUpsertBody = {
  dealerId: string;
  tradePointId: string;
  targetKind: ShowcaseMatrixTargetKind;
  targetId: string;
  status: ShowcaseMatrixStatus;
  comment?: string | null;
  clientOpId?: string | null;
  placementType?: ShowcasePlacementType | null;
  placementSegment?: ShowcasePlacementSegment | null;
  placementCapacity?: number | null;
  placementActual?: number | null;
  placementRef?: string | null;
  placementOurModels?: ShowcasePlacementOurModel[] | null;
  placementCompetitors?: ShowcasePlacementCompetitor[] | null;
};

function mapShowcaseMatrixEntryDto(raw: Record<string, unknown>): ShowcaseMatrixEntryDto {
  return {
    id: String(raw.id),
    dealerId: String(raw.dealerId),
    tradePointId: String(raw.tradePointId),
    targetKind: raw.targetKind as ShowcaseMatrixEntryDto["targetKind"],
    targetId: String(raw.targetId),
    status: raw.status as ShowcaseMatrixEntryDto["status"],
    comment: raw.comment != null ? String(raw.comment) : null,
    updatedAt: String(raw.updatedAt),
    updatedBy: raw.updatedBy != null ? String(raw.updatedBy) : null,
    updatedByName: raw.updatedByName != null ? String(raw.updatedByName) : null,
    placementType: (raw.placementType as ShowcaseMatrixEntryDto["placementType"]) ?? null,
    placementSegment: (raw.placementSegment as ShowcaseMatrixEntryDto["placementSegment"]) ?? null,
    placementCapacity: typeof raw.placementCapacity === "number" ? raw.placementCapacity : null,
    placementActual: typeof raw.placementActual === "number" ? raw.placementActual : null,
    placementRef: raw.placementRef != null ? String(raw.placementRef) : null,
    placementOurModels: Array.isArray(raw.placementOurModels) ? raw.placementOurModels : [],
    placementCompetitors: Array.isArray(raw.placementCompetitors) ? raw.placementCompetitors : [],
  };
}

function mapShowcaseMatrixEventDto(raw: Record<string, unknown>): ShowcaseMatrixEventDto {
  return {
    id: String(raw.id),
    entryId: raw.entryId != null ? String(raw.entryId) : null,
    dealerId: String(raw.dealerId),
    tradePointId: String(raw.tradePointId),
    targetKind: raw.targetKind as ShowcaseMatrixEventDto["targetKind"],
    targetId: String(raw.targetId),
    oldStatus: raw.oldStatus != null ? String(raw.oldStatus) : null,
    newStatus: raw.newStatus != null ? String(raw.newStatus) : null,
    comment: raw.comment != null ? String(raw.comment) : null,
    changedBy: raw.changedBy != null ? String(raw.changedBy) : null,
    changedByName: raw.changedByName != null ? String(raw.changedByName) : null,
    changedAt: String(raw.changedAt),
    placementType: (raw.placementType as ShowcaseMatrixEventDto["placementType"]) ?? null,
    placementSegment: (raw.placementSegment as ShowcaseMatrixEventDto["placementSegment"]) ?? null,
    placementCapacity: typeof raw.placementCapacity === "number" ? raw.placementCapacity : null,
    placementActual: typeof raw.placementActual === "number" ? raw.placementActual : null,
    placementRef: raw.placementRef != null ? String(raw.placementRef) : null,
    placementOurModels: Array.isArray(raw.placementOurModels) ? raw.placementOurModels : [],
    placementCompetitors: Array.isArray(raw.placementCompetitors) ? raw.placementCompetitors : [],
  };
}

type ApiOk<T> = { success: true } & T;
type ApiErr = { success: false; code?: string; message?: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchShowcaseMatrixList(opts: {
  tradePointId: string;
  dealerId?: string;
}): Promise<ShowcaseMatrixEntryDto[] | null> {
  try {
    const params = new URLSearchParams();
    params.set("tradePointId", opts.tradePointId);
    if (opts.dealerId) params.set("dealerId", opts.dealerId);
    const res = await fetch(`/api/showcase-matrix/list?${params}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<{ entries: ShowcaseMatrixEntryDto[] }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.entries.map((e) => mapShowcaseMatrixEntryDto(e as unknown as Record<string, unknown>));
  } catch {
    return null;
  }
}

const SCOPE_CHUNK_SIZE = 500;

export async function fetchShowcaseMatrixScopeAll(
  params?: { statuses?: ShowcaseMatrixStatus[] },
): Promise<{ entries: ShowcaseMatrixEntryDto[]; tradePointIds: string[] } | null> {
  try {
    const res = await fetch("/api/showcase-matrix/scope-all", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statuses: params?.statuses }),
      cache: "no-store",
    });
    const data = await parseJson<
      ApiOk<{ entries: ShowcaseMatrixEntryDto[]; tradePointIds: string[] }> | ApiErr
    >(res);
    if (!res.ok || !data.success) return null;
    return {
      entries: data.entries.map((e) =>
        mapShowcaseMatrixEntryDto(e as unknown as Record<string, unknown>),
      ),
      tradePointIds: data.tradePointIds ?? [],
    };
  } catch {
    return null;
  }
}

export async function fetchShowcaseMatrixScope(opts: {
  tradePointIds: string[];
  statuses?: ShowcaseMatrixStatus[];
}): Promise<ShowcaseMatrixEntryDto[] | null> {
  const ids = [...new Set(opts.tradePointIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  const all: ShowcaseMatrixEntryDto[] = [];
  try {
    for (let i = 0; i < ids.length; i += SCOPE_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + SCOPE_CHUNK_SIZE);
      const res = await fetch("/api/showcase-matrix/scope", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradePointIds: chunk, statuses: opts.statuses }),
        cache: "no-store",
      });
      const data = await parseJson<ApiOk<{ entries: ShowcaseMatrixEntryDto[] }> | ApiErr>(res);
      if (!res.ok || !data.success) return null;
      all.push(
        ...data.entries.map((e) =>
          mapShowcaseMatrixEntryDto(e as unknown as Record<string, unknown>),
        ),
      );
    }
    return all;
  } catch {
    return null;
  }
}

export async function fetchShowcaseMatrixHistory(opts: {
  /** История по конкретной ТТ. Либо tradePointId, либо dealerId должен быть задан. */
  tradePointId?: string;
  /** Batch по дилеру (для тренда дистрибуции по скоупу). */
  dealerId?: string;
  limit?: number;
}): Promise<ShowcaseMatrixEventDto[] | null> {
  if (!opts.tradePointId && !opts.dealerId) return null;
  try {
    const params = new URLSearchParams();
    if (opts.tradePointId) params.set("tradePointId", opts.tradePointId);
    if (opts.dealerId) params.set("dealerId", opts.dealerId);
    if (opts.limit != null) params.set("limit", String(opts.limit));
    const res = await fetch(`/api/showcase-matrix/history?${params}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<{ events: ShowcaseMatrixEventDto[] }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.events.map((e) => mapShowcaseMatrixEventDto(e as unknown as Record<string, unknown>));
  } catch {
    return null;
  }
}

export async function apiUpsertShowcaseMatrixEntry(
  body: ShowcaseMatrixUpsertBody,
): Promise<{
  ok: boolean;
  entry?: ShowcaseMatrixEntryDto;
  code?: string;
  status?: number;
  network?: boolean;
}> {
  try {
    const res = await fetch("/api/showcase-matrix/upsert", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseJson<ApiOk<{ entry: ShowcaseMatrixEntryDto }> | ApiErr>(res);
    if (!res.ok || !data.success) {
      return {
        ok: false,
        code: "code" in data ? data.code : undefined,
        status: res.status,
      };
    }
    return {
      ok: true,
      entry: mapShowcaseMatrixEntryDto(data.entry as unknown as Record<string, unknown>),
    };
  } catch {
    return { ok: false, network: true };
  }
}

export async function apiBatchSyncShowcaseMatrix(
  operations: ShowcaseMatrixUpsertBody[],
): Promise<{
  ok: boolean;
  applied?: number;
  skipped?: number;
  results?: unknown[];
  network?: boolean;
  code?: string;
  status?: number;
}> {
  try {
    const res = await fetch("/api/showcase-matrix/batch-sync", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations }),
    });
    const data = await parseJson<
      ApiOk<{ applied: number; skipped: number; results: unknown[] }> | ApiErr
    >(res);
    if (!res.ok || !data.success) {
      return {
        ok: false,
        code: "code" in data ? data.code : undefined,
        status: res.status,
      };
    }
    return {
      ok: true,
      applied: data.applied,
      skipped: data.skipped,
      results: data.results,
    };
  } catch {
    return { ok: false, network: true };
  }
}

export async function apiUpsertShowcaseMatrixEntryStrict(
  body: ShowcaseMatrixUpsertBody,
): Promise<{
  ok: boolean;
  status?: number;
  code?: string;
  message?: string;
  network?: boolean;
}> {
  try {
    const res = await fetch("/api/showcase-matrix/upsert", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseJson<ApiOk<{ entry: ShowcaseMatrixEntryDto }> | ApiErr>(res);
    if (!res.ok || !data.success) {
      return {
        ok: false,
        status: res.status,
        code: "code" in data ? data.code : undefined,
        message: "message" in data ? data.message : `HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, network: true, message };
  }
}
