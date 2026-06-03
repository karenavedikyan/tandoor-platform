/**
 * HTTP API витринной матрицы (Postgres) — Промт 151.
 */

export type ShowcaseMatrixTargetKind = "model" | "variant";
export type ShowcaseMatrixStatus = "need_install" | "installed" | "postponed" | "not_relevant";

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
};

export type ShowcaseMatrixUpsertBody = {
  dealerId: string;
  tradePointId: string;
  targetKind: ShowcaseMatrixTargetKind;
  targetId: string;
  status: ShowcaseMatrixStatus;
  comment?: string | null;
  clientOpId?: string | null;
};

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
    return data.entries;
  } catch {
    return null;
  }
}

export async function fetchShowcaseMatrixHistory(opts: {
  tradePointId: string;
  dealerId?: string;
  limit?: number;
}): Promise<ShowcaseMatrixEventDto[] | null> {
  try {
    const params = new URLSearchParams();
    params.set("tradePointId", opts.tradePointId);
    if (opts.dealerId) params.set("dealerId", opts.dealerId);
    if (opts.limit != null) params.set("limit", String(opts.limit));
    const res = await fetch(`/api/showcase-matrix/history?${params}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<{ events: ShowcaseMatrixEventDto[] }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.events;
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
    return { ok: true, entry: data.entry };
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
