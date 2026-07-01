/**
 * Города для блока «География покрытия» на главной (только активные клиенты и ТТ).
 */

import type { ActualizationState } from "./client-base-actualization-state.js";
import { cityKeyForDealerRow } from "./city-concentration.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import type { ScopedTradePointDto } from "./trade-points-scoped-api.js";
import { normalizeTerritoryCityName } from "./territory-city-normalize.js";

export type MainDashboardCityTile = {
  city: string;
  activeClients: number;
  activeTradePoints: number;
  isNoCity: boolean;
};

/** Единая нормализация подписи города для плиток (клиенты и ТТ из БД). */
export function displayCityLabelFromRawCity(
  rawCity: string | null | undefined,
  addressHint?: string | null,
): string {
  const raw = rawCity?.trim();
  if (!raw || raw === "—" || raw === "-") return "Без города";
  return normalizeTerritoryCityName(rawCity!, addressHint ?? undefined);
}

export function displayCityForDealerRow(row: DealerRow): string {
  const key = cityKeyForDealerRow(row);
  return key === "__no_city__" ? "Без города" : key;
}

export function dealerRowMatchesCityFilter(row: DealerRow, selectedCity: string): boolean {
  return displayCityForDealerRow(row) === selectedCity;
}

function cityKeyForScopedTp(tp: ScopedTradePointDto): string {
  return displayCityLabelFromRawCity(tp.dealerCity ?? tp.city, tp.address);
}

/** Кол-во активных ТТ по городам из БД-источника (scoped). */
export function buildTradePointCountByCityFromScopedDb(
  tradePoints: ScopedTradePointDto[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    const city = cityKeyForScopedTp(tp);
    map.set(city, (map.get(city) ?? 0) + 1);
  }
  return map;
}

/** Кол-во активных клиентов (уникальных дилеров) по городам из scoped БД. */
export function buildClientCountByCityFromScopedDb(
  tradePoints: ScopedTradePointDto[],
): Map<string, number> {
  const byCity = new Map<string, Set<string>>();
  for (const tp of tradePoints) {
    if (tp.isActive === false) continue;
    const city = cityKeyForScopedTp(tp);
    let set = byCity.get(city);
    if (!set) {
      set = new Set();
      byCity.set(city, set);
    }
    set.add(tp.dealerId);
  }
  const map = new Map<string, number>();
  byCity.forEach((set, city) => map.set(city, set.size));
  return map;
}

function sortCityTiles(tiles: MainDashboardCityTile[]): MainDashboardCityTile[] {
  return tiles.sort((a, b) => {
    if (a.isNoCity && !b.isNoCity) return 1;
    if (!a.isNoCity && b.isNoCity) return -1;
    return b.activeClients - a.activeClients || a.city.localeCompare(b.city, "ru");
  });
}

export function buildMainDashboardCityTiles(
  rows: DealerRow[],
  act: ActualizationState,
  tradePointCountByCity?: Map<string, number>,
  clientCountByCity?: Map<string, number>,
): MainDashboardCityTile[] {
  void act;

  // При заданном clientCountByCity плитки строятся ТОЛЬКО из БД:
  // набор городов = объединение ключей обеих карт, rows игнорируются.
  if (clientCountByCity) {
    const cityKeys = new Set<string>();
    clientCountByCity.forEach((_, key) => cityKeys.add(key));
    if (tradePointCountByCity) {
      tradePointCountByCity.forEach((_, key) => cityKeys.add(key));
    }

    const tiles: MainDashboardCityTile[] = Array.from(cityKeys).map((city) => ({
      city,
      activeClients: clientCountByCity.get(city) ?? 0,
      activeTradePoints: tradePointCountByCity?.get(city) ?? 0,
      isNoCity: city === "Без города",
    }));
    return sortCityTiles(tiles);
  }

  const map = new Map<string, { activeClients: number; activeTradePoints: number }>();
  for (const r of rows) {
    const city = displayCityForDealerRow(r);
    const cur = map.get(city) ?? { activeClients: 0, activeTradePoints: 0 };
    cur.activeClients += 1;
    if (!tradePointCountByCity) {
      cur.activeTradePoints += (r.tradePoints ?? []).length;
    }
    map.set(city, cur);
  }

  if (tradePointCountByCity) {
    map.forEach((entry, city) => {
      entry.activeTradePoints = tradePointCountByCity.get(city) ?? 0;
    });
  }

  const tiles: MainDashboardCityTile[] = Array.from(map.entries()).map(([city, v]) => ({
    city,
    activeClients: v.activeClients,
    activeTradePoints: v.activeTradePoints,
    isNoCity: city === "Без города",
  }));

  return sortCityTiles(tiles);
}

export function filterCityTilesBySearch(tiles: MainDashboardCityTile[], search: string): MainDashboardCityTile[] {
  const q = search.trim().toLowerCase();
  if (!q) return tiles;
  return tiles.filter((t) => t.city.toLowerCase().includes(q));
}
