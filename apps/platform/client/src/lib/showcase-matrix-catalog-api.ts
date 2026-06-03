/**
 * HTTP API справочника матриц моделей на витрину — Промт 160.
 */

export type {
  ShowcaseMatrixCatalogClientCategory,
  ShowcaseMatrixCatalogPriority,
  ShowcaseMatrixCatalogScopeKind,
  ShowcaseMatrixCatalogSegment,
  ShowcaseMatrixCatalogStatus,
  ShowcaseMatrixCatalogTargetKind,
  ShowcaseMatrixDefDto,
  ShowcaseMatrixDefListFilter,
  ShowcaseMatrixDefModelDto,
  ShowcaseMatrixDefModelInput,
  ShowcaseMatrixDefUpsertInput,
  ShowcaseMatrixDefWithModelsDto,
} from "@shared/showcase-matrix-catalog-handlers.js";

import type {
  ShowcaseMatrixCatalogBatchOp,
  ShowcaseMatrixCatalogClientCategory,
  ShowcaseMatrixCatalogStatus,
  ShowcaseMatrixDefDto,
  ShowcaseMatrixDefListFilter,
  ShowcaseMatrixDefModelDto,
  ShowcaseMatrixDefModelInput,
  ShowcaseMatrixDefUpsertInput,
  ShowcaseMatrixDefWithModelsDto,
} from "@shared/showcase-matrix-catalog-handlers.js";

type ApiOk<T> = { success: true } & T;
type ApiErr = { success: false; code?: string; message?: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function filterToSearchParams(filter: ShowcaseMatrixDefListFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.clientCategory) params.set("clientCategory", filter.clientCategory);
  if (filter.scopeKind) params.set("scopeKind", filter.scopeKind);
  if (filter.status) params.set("status", filter.status);
  if (filter.region) params.set("region", filter.region);
  if (filter.city) params.set("city", filter.city);
  return params;
}

export async function fetchMatrixDefList(
  filter: ShowcaseMatrixDefListFilter = {},
): Promise<ShowcaseMatrixDefDto[] | null> {
  try {
    const params = filterToSearchParams(filter);
    const qs = params.toString();
    const res = await fetch(`/api/showcase-matrix-catalog/list${qs ? `?${qs}` : ""}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<{ defs: ShowcaseMatrixDefDto[] }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.defs;
  } catch {
    return null;
  }
}

export async function fetchMatrixDef(id: string): Promise<ShowcaseMatrixDefWithModelsDto | null> {
  try {
    const params = new URLSearchParams({ id });
    const res = await fetch(`/api/showcase-matrix-catalog/get?${params}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<{ def: ShowcaseMatrixDefWithModelsDto }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.def;
  } catch {
    return null;
  }
}

export async function fetchActiveMatrixDef(opts: {
  clientCategory: ShowcaseMatrixCatalogClientCategory;
  region?: string | null;
  city?: string | null;
  onDate?: string;
}): Promise<ShowcaseMatrixDefWithModelsDto | null> {
  try {
    const params = new URLSearchParams();
    params.set("clientCategory", opts.clientCategory);
    if (opts.region) params.set("region", opts.region);
    if (opts.city) params.set("city", opts.city);
    if (opts.onDate) params.set("onDate", opts.onDate);
    const res = await fetch(`/api/showcase-matrix-catalog/resolve?${params}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<{ def: ShowcaseMatrixDefWithModelsDto | null }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.def;
  } catch {
    return null;
  }
}

export async function apiUpsertMatrixDef(
  body: ShowcaseMatrixDefUpsertInput,
): Promise<{
  ok: boolean;
  def?: ShowcaseMatrixDefDto;
  idempotent?: boolean;
  code?: string;
  status?: number;
  network?: boolean;
}> {
  try {
    const res = await fetch("/api/showcase-matrix-catalog/upsert", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseJson<
      ApiOk<{ def: ShowcaseMatrixDefDto; idempotent: boolean }> | ApiErr
    >(res);
    if (!res.ok || !data.success) {
      return {
        ok: false,
        code: "code" in data ? data.code : undefined,
        status: res.status,
      };
    }
    return { ok: true, def: data.def, idempotent: data.idempotent };
  } catch {
    return { ok: false, network: true };
  }
}

export async function apiUpsertMatrixDefStrict(
  body: ShowcaseMatrixDefUpsertInput,
): Promise<{
  ok: boolean;
  status?: number;
  code?: string;
  message?: string;
  network?: boolean;
}> {
  try {
    const res = await fetch("/api/showcase-matrix-catalog/upsert", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseJson<
      ApiOk<{ def: ShowcaseMatrixDefDto; idempotent: boolean }> | ApiErr
    >(res);
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

export async function apiSetMatrixDefStatus(
  id: string,
  status: ShowcaseMatrixCatalogStatus,
): Promise<{ ok: boolean; def?: ShowcaseMatrixDefDto; code?: string; status?: number; network?: boolean }> {
  try {
    const res = await fetch("/api/showcase-matrix-catalog/set-status", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await parseJson<ApiOk<{ def: ShowcaseMatrixDefDto }> | ApiErr>(res);
    if (!res.ok || !data.success) {
      return {
        ok: false,
        code: "code" in data ? data.code : undefined,
        status: res.status,
      };
    }
    return { ok: true, def: data.def };
  } catch {
    return { ok: false, network: true };
  }
}

export async function apiSetMatrixDefStatusStrict(
  id: string,
  status: ShowcaseMatrixCatalogStatus,
): Promise<{ ok: boolean; status?: number; code?: string; message?: string; network?: boolean }> {
  try {
    const res = await fetch("/api/showcase-matrix-catalog/set-status", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await parseJson<ApiOk<{ def: ShowcaseMatrixDefDto }> | ApiErr>(res);
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

export async function apiDeleteMatrixDef(
  id: string,
): Promise<{ ok: boolean; code?: string; status?: number; network?: boolean }> {
  try {
    const res = await fetch("/api/showcase-matrix-catalog/delete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await parseJson<ApiOk<Record<string, never>> | ApiErr>(res);
    if (!res.ok || !data.success) {
      return {
        ok: false,
        code: "code" in data ? data.code : undefined,
        status: res.status,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, network: true };
  }
}

export async function apiDeleteMatrixDefStrict(
  id: string,
): Promise<{ ok: boolean; status?: number; code?: string; message?: string; network?: boolean }> {
  try {
    const res = await fetch("/api/showcase-matrix-catalog/delete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await parseJson<ApiOk<Record<string, never>> | ApiErr>(res);
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

export async function apiReplaceMatrixDefModels(
  defId: string,
  models: ShowcaseMatrixDefModelInput[],
): Promise<{
  ok: boolean;
  models?: ShowcaseMatrixDefModelDto[];
  code?: string;
  status?: number;
  network?: boolean;
}> {
  try {
    const res = await fetch("/api/showcase-matrix-catalog/replace-models", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defId, models }),
    });
    const data = await parseJson<ApiOk<{ models: ShowcaseMatrixDefModelDto[] }> | ApiErr>(res);
    if (!res.ok || !data.success) {
      return {
        ok: false,
        code: "code" in data ? data.code : undefined,
        status: res.status,
      };
    }
    return { ok: true, models: data.models };
  } catch {
    return { ok: false, network: true };
  }
}

export async function apiReplaceMatrixDefModelsStrict(
  defId: string,
  models: ShowcaseMatrixDefModelInput[],
): Promise<{ ok: boolean; status?: number; code?: string; message?: string; network?: boolean }> {
  try {
    const res = await fetch("/api/showcase-matrix-catalog/replace-models", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defId, models }),
    });
    const data = await parseJson<ApiOk<{ models: ShowcaseMatrixDefModelDto[] }> | ApiErr>(res);
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

export async function apiBatchSyncMatrixCatalog(
  ops: ShowcaseMatrixCatalogBatchOp[],
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
    const res = await fetch("/api/showcase-matrix-catalog/batch-sync", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops }),
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
