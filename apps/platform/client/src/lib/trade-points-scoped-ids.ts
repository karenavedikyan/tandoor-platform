/**
 * ID активных ТТ из scoped-ответа БД (единый набор для дистрибуции и счётчиков).
 */

import { displayCityLabelFromRawCity } from "./main-dashboard-city-stats.js";
import type { ScopedTradePointDto, TradePointsListScopedResponse } from "./trade-points-scoped-api.js";

function cityKeyForScopedTradePoint(tp: ScopedTradePointDto): string {
  return displayCityLabelFromRawCity(tp.dealerCity ?? tp.city, tp.address);
}

/** Ключ ТТ для showcase_matrix_entries / tradePointShowcaseActualizationById (external_key). */
export function matrixKeyForScopedTradePoint(tp: ScopedTradePointDto): string {
  const key = tp.externalKey?.trim();
  return key || tp.id;
}

export function activeTradePointIdsFromScopedTradePoints(
  tradePoints: readonly ScopedTradePointDto[],
): string[] {
  const ids: string[] = [];
  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    ids.push(tp.id);
  }
  return ids;
}

/** undefined — scoped-ответ ещё не готов; [] — готов, но пустой. */
export function activeTradePointIdsFromScopedResponse(
  data: TradePointsListScopedResponse | undefined,
): string[] | undefined {
  if (!data || data.success !== true) return undefined;
  return activeTradePointIdsFromScopedTradePoints(data.tradePoints);
}

export function activeTradePointExternalKeysFromScopedTradePoints(
  tradePoints: readonly ScopedTradePointDto[],
): string[] {
  const keys: string[] = [];
  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    keys.push(matrixKeyForScopedTradePoint(tp));
  }
  return keys;
}

/** undefined — scoped-ответ ещё не готов; [] — готов, но пустой. */
export function activeTradePointExternalKeysFromScopedResponse(
  data: TradePointsListScopedResponse | undefined,
): string[] | undefined {
  if (!data || data.success !== true) return undefined;
  return activeTradePointExternalKeysFromScopedTradePoints(data.tradePoints);
}

/** UUID по matrix-key для fallback lookup в tradePointShowcaseActualizationById. */
export function buildShowcaseUuidByMatrixKeyFromScopedTradePoints(
  tradePoints: readonly ScopedTradePointDto[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    map.set(matrixKeyForScopedTradePoint(tp), tp.id);
  }
  return map;
}

/** ID активных ТТ по имени менеджера (scoped БД). */
export function buildTradePointIdsByManagerNameFromScopedDb(
  tradePoints: readonly ScopedTradePointDto[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    const key = (tp.managerFullName ?? "").trim();
    if (!key) continue;
    const arr = map.get(key);
    if (arr) arr.push(tp.id);
    else map.set(key, [tp.id]);
  }
  return map;
}

/** ID активных ТТ по городу (scoped БД), отсортировано по числу ТТ. */
export function buildTradePointIdsByCityFromScopedDb(
  tradePoints: readonly ScopedTradePointDto[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    const key = cityKeyForScopedTradePoint(tp);
    const arr = map.get(key);
    if (arr) arr.push(tp.id);
    else map.set(key, [tp.id]);
  }
  return new Map(
    Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "ru")),
  );
}

/** Map cityKey → externalKeys активных ТТ (дедуп по external_key). */
export function buildTradePointExternalKeysByCityFromScopedDb(
  tradePoints: readonly ScopedTradePointDto[],
): Map<string, string[]> {
  const sets = new Map<string, Set<string>>();
  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    const key = cityKeyForScopedTradePoint(tp);
    const externalKey = matrixKeyForScopedTradePoint(tp);
    const bucket = sets.get(key);
    if (bucket) bucket.add(externalKey);
    else sets.set(key, new Set([externalKey]));
  }
  const map = new Map<string, string[]>();
  sets.forEach((keys, city) => {
    map.set(city, Array.from(keys));
  });
  return map;
}

export const NO_ROP_BUCKET_KEY = "__no_rop__";

export type TradePointExternalKeysByRopBucket = {
  ropKey: string;
  ropName: string;
  externalKeys: string[];
};

function ropBucketKeyForScopedTradePoint(tp: ScopedTradePointDto): string {
  return tp.teamId ?? tp.ropUserId ?? NO_ROP_BUCKET_KEY;
}

function ropBucketNameForScopedTradePoint(tp: ScopedTradePointDto, ropKey: string): string {
  if (ropKey === NO_ROP_BUCKET_KEY) return "Без РОПа";
  return (tp.ropFullName ?? tp.teamName ?? ropKey).trim() || ropKey;
}

/** External keys активных ТТ по РОПам (scoped БД), детерминированный порядок. */
export function buildTradePointExternalKeysByRopFromScopedDb(
  tradePoints: readonly ScopedTradePointDto[],
): TradePointExternalKeysByRopBucket[] {
  const buckets = new Map<string, { ropName: string; externalKeys: string[] }>();

  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    const ropKey = ropBucketKeyForScopedTradePoint(tp);
    const externalKey = matrixKeyForScopedTradePoint(tp);
    const existing = buckets.get(ropKey);
    if (existing) {
      existing.externalKeys.push(externalKey);
    } else {
      buckets.set(ropKey, {
        ropName: ropBucketNameForScopedTradePoint(tp, ropKey),
        externalKeys: [externalKey],
      });
    }
  }

  const result: TradePointExternalKeysByRopBucket[] = [];
  const noRop = buckets.get(NO_ROP_BUCKET_KEY);
  const others = Array.from(buckets.entries())
    .filter(([key]) => key !== NO_ROP_BUCKET_KEY)
    .sort((a, b) => a[1].ropName.localeCompare(b[1].ropName, "ru"));

  for (const [ropKey, { ropName, externalKeys }] of others) {
    result.push({ ropKey, ropName, externalKeys });
  }
  if (noRop) {
    result.push({
      ropKey: NO_ROP_BUCKET_KEY,
      ropName: noRop.ropName,
      externalKeys: noRop.externalKeys,
    });
  }
  return result;
}

/** Map ropKey (teamId ?? ropUserId ?? __no_rop__) → externalKeys. */
export function buildTradePointExternalKeysByRopKeyMapFromScopedDb(
  tradePoints: readonly ScopedTradePointDto[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const bucket of buildTradePointExternalKeysByRopFromScopedDb(tradePoints)) {
    map.set(bucket.ropKey, bucket.externalKeys);
  }
  return map;
}

/** Map managerUserId → externalKeys (дедуп по ТТ). */
export function buildTradePointExternalKeysByManagerFromScopedDb(
  tradePoints: readonly ScopedTradePointDto[],
): Map<string, string[]> {
  const sets = new Map<string, Set<string>>();
  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    const managerUserId = tp.managerUserId?.trim();
    if (!managerUserId) continue;
    const externalKey = matrixKeyForScopedTradePoint(tp);
    const bucket = sets.get(managerUserId);
    if (bucket) bucket.add(externalKey);
    else sets.set(managerUserId, new Set([externalKey]));
  }
  const map = new Map<string, string[]>();
  sets.forEach((keys, managerUserId) => {
    map.set(managerUserId, Array.from(keys));
  });
  return map;
}

/** Map regionalManagerUserId → externalKeys (дедуп по ТТ). */
export function buildTradePointExternalKeysByRegionalManagerFromScopedDb(
  tradePoints: readonly ScopedTradePointDto[],
): Map<string, string[]> {
  const sets = new Map<string, Set<string>>();
  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    const regionalUserId = tp.regionalManagerUserId?.trim();
    if (!regionalUserId) continue;
    const externalKey = matrixKeyForScopedTradePoint(tp);
    const bucket = sets.get(regionalUserId);
    if (bucket) bucket.add(externalKey);
    else sets.set(regionalUserId, new Set([externalKey]));
  }
  const map = new Map<string, string[]>();
  sets.forEach((keys, id) => {
    map.set(id, Array.from(keys));
  });
  return map;
}

/** Первое непустое совпадение по списку ключей lookup. */
export function lookupExternalKeysInScopedMap(
  map: ReadonlyMap<string, string[]>,
  lookupKeys: readonly string[],
): string[] {
  for (const key of lookupKeys) {
    const keys = map.get(key);
    if (keys && keys.length > 0) return keys;
  }
  return [];
}
