/**
 * Одноразовый импорт legacy sessionStorage → БД (Промт 426).
 * TODO: удалить через 2 недели после деплоя.
 */

import type { ShowcaseStorageV1Dto } from "./showcase-distribution-api.js";

export const LEGACY_SHOWCASE_STORAGE_KEY = "tandoor-showcase-distribution-v1";

export function readLegacyShowcaseStorage(): ShowcaseStorageV1Dto | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(LEGACY_SHOWCASE_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ShowcaseStorageV1Dto>;
    const hasData =
      Object.keys(p.overrides ?? {}).length > 0 ||
      Object.keys(p.taskUpdates ?? {}).length > 0 ||
      Object.keys(p.historyByDealer ?? {}).length > 0 ||
      Object.keys(p.recommendationTaskEntries ?? {}).length > 0;
    if (!hasData) return null;
    return {
      overrides: p.overrides ?? {},
      taskUpdates: p.taskUpdates ?? {},
      historyByDealer: p.historyByDealer ?? {},
      recommendationTaskEntries: p.recommendationTaskEntries ?? {},
    };
  } catch {
    return null;
  }
}

export function clearLegacyShowcaseStorage(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.removeItem(LEGACY_SHOWCASE_STORAGE_KEY);
}
