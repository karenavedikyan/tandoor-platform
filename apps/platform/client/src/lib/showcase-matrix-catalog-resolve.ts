/**
 * Офлайн-резолюция активной матрицы из кэша справочника (логика как на сервере).
 */

import {
  isMatrixDefEffectiveOnDate,
  pickResolvedMatrixDef,
  type ShowcaseMatrixCatalogClientCategory,
  type ShowcaseMatrixDefDto,
  type ShowcaseMatrixDefWithModelsDto,
} from "@shared/showcase-matrix-catalog-handlers.js";
import { loadCachedMatrixDef, loadCachedMatrixDefs } from "./showcase-matrix-catalog-store.js";

export function todayIsoDateLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function resolveActiveMatrixDefFromCache(params: {
  clientCategory: ShowcaseMatrixCatalogClientCategory;
  region: string | null;
  city: string | null;
  onDate?: string;
}): ShowcaseMatrixDefWithModelsDto | null {
  const onDate = params.onDate ?? todayIsoDateLocal();
  const headers = loadCachedMatrixDefs({
    clientCategory: params.clientCategory,
    status: "published",
  });
  const candidates = headers.filter((h) => isMatrixDefEffectiveOnDate(h, onDate));
  const picked: ShowcaseMatrixDefDto | null = pickResolvedMatrixDef(candidates, {
    region: params.region,
    city: params.city,
  });
  if (!picked) return null;

  const full = loadCachedMatrixDef(picked.id);
  if (full) return full;
  return { ...picked, models: [] };
}
