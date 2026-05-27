/**
 * Города для блока «География покрытия» на главной (только активные клиенты и ТТ).
 */

import { mergeTradePointsForActualization } from "@/lib/client-base-actualization-data-merge";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { cityKeyForDealerRow } from "@/lib/archive-record-visual";
import type { DealerRow } from "@/lib/dealer-base-mock-data";

export type MainDashboardCityTile = {
  city: string;
  activeClients: number;
  activeTradePoints: number;
  isNoCity: boolean;
};

export function displayCityForDealerRow(row: DealerRow): string {
  const key = cityKeyForDealerRow(row);
  return key === "__no_city__" ? "Без города" : key;
}

export function dealerRowMatchesCityFilter(row: DealerRow, selectedCity: string): boolean {
  return displayCityForDealerRow(row) === selectedCity;
}

export function buildMainDashboardCityTiles(rows: DealerRow[], act: ActualizationState): MainDashboardCityTile[] {
  const map = new Map<string, { activeClients: number; activeTradePoints: number }>();
  for (const r of rows) {
    const city = displayCityForDealerRow(r);
    const cur = map.get(city) ?? { activeClients: 0, activeTradePoints: 0 };
    cur.activeClients += 1;
    cur.activeTradePoints += mergeTradePointsForActualization(r, act).filter((e) => !e.isArchived).length;
    map.set(city, cur);
  }

  const tiles: MainDashboardCityTile[] = Array.from(map.entries()).map(([city, v]) => ({
    city,
    activeClients: v.activeClients,
    activeTradePoints: v.activeTradePoints,
    isNoCity: city === "Без города",
  }));

  return tiles.sort((a, b) => {
    if (a.isNoCity && !b.isNoCity) return 1;
    if (!a.isNoCity && b.isNoCity) return -1;
    return b.activeClients - a.activeClients || a.city.localeCompare(b.city, "ru");
  });
}

export function filterCityTilesBySearch(tiles: MainDashboardCityTile[], search: string): MainDashboardCityTile[] {
  const q = search.trim().toLowerCase();
  if (!q) return tiles;
  return tiles.filter((t) => t.city.toLowerCase().includes(q));
}
