/**
 * ID активных ТТ из scoped-ответа БД (единый набор для дистрибуции и счётчиков).
 */

import { displayCityLabelFromRawCity } from "./main-dashboard-city-stats.js";
import type { ScopedTradePointDto, TradePointsListScopedResponse } from "./trade-points-scoped-api.js";

function cityKeyForScopedTradePoint(tp: ScopedTradePointDto): string {
  return displayCityLabelFromRawCity(tp.dealerCity ?? tp.city, tp.address);
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
