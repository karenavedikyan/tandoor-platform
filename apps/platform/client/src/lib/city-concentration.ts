import type { ActualizationState } from "./client-base-actualization-state.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import { dealerNeedsAttention, isDealerTop } from "./dealer-base-role-views.js";
import { buildBrowserHashAppHref } from "./hash-route-utils.js";
import { isRopOrManagerAllFilter } from "./rop-manager-filters.js";
import { getEffectiveTeamLeadTeamId, type ReleaseDemoProfile } from "./release-demo-profile.js";
import { getSalesUserById, type SalesRole } from "./sales-control-data.js";
import { normalizeTerritoryCityName } from "./territory-city-normalize.js";

export type CityRiskLevel = "critical" | "ok";

export type CityConcentrationRow = {
  city: string;
  total: number;
  /** Сумма ТТ (outlets) по клиентам города в переданном наборе. */
  tradePoints: number;
  active: number;
  top: number;
  attention: number;
  potential: number;
  pctActive: number;
  pctAttention: number;
  /** Доля от города с максимумом клиентов в переданном наборе (0..1). */
  intensity: number;
};

/** Стабильный ключ города для агрегаций и drill-down. */
export function cityKeyForDealerRow(row: DealerRow): string {
  const raw = row.city?.trim();
  const display =
    !raw || raw === "—" || raw === "-"
      ? "Без города"
      : normalizeTerritoryCityName(row.city, row.releaseAddress);
  return display === "Без города" ? "__no_city__" : display;
}

/** Стабильный идентификатор для data-testid (без пробелов и спецсимволов). */
export function safeCityId(city: string): string {
  const t = city.trim() || "unknown";
  let s = "";
  for (const ch of t) {
    const lower = ch.toLowerCase();
    if ((lower >= "a" && lower <= "z") || (lower >= "0" && lower <= "9")) s += lower;
    else if (ch === " " || ch === "-" || ch === "_") s += "-";
    else s += `u${ch.charCodeAt(0).toString(16)}`;
  }
  const collapsed = s.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return collapsed || "city";
}

export function getCityRiskLevel(row: CityConcentrationRow): CityRiskLevel {
  return row.pctAttention > 50 ? "critical" : "ok";
}

export function buildCityConcentrationRows(
  rows: DealerRow[],
  _act?: ActualizationState,
  clientCountByCity?: Map<string, number>,
  tradePointCountByCity?: Map<string, number>,
): CityConcentrationRow[] {
  const map = new Map<
    string,
    { total: number; tradePoints: number; active: number; top: number; attention: number; potential: number }
  >();
  for (const r of rows) {
    const raw = r.city?.trim();
    const city =
      !raw || raw === "—" || raw === "-"
        ? "Без города"
        : normalizeTerritoryCityName(r.city, r.releaseAddress);
    const cur = map.get(city) ?? { total: 0, tradePoints: 0, active: 0, top: 0, attention: 0, potential: 0 };
    cur.total += 1;
    cur.tradePoints += r.outlets;
    if (r.status === "активный") cur.active += 1;
    if (isDealerTop(r)) cur.top += 1;
    if (dealerNeedsAttention(r)) cur.attention += 1;
    if (r.status === "потенциальный") cur.potential += 1;
    map.set(city, cur);
  }

  const entries: Array<[string, CityConcentrationRow]> = clientCountByCity
    ? (() => {
        const cityKeys = new Set<string>();
        clientCountByCity.forEach((_, key) => cityKeys.add(key));
        if (tradePointCountByCity) {
          tradePointCountByCity.forEach((_, key) => cityKeys.add(key));
        }
        return Array.from(cityKeys).map((city) => {
          const local = map.get(city) ?? {
            total: 0,
            tradePoints: 0,
            active: 0,
            top: 0,
            attention: 0,
            potential: 0,
          };
          const total = clientCountByCity.get(city) ?? 0;
          const tradePoints = tradePointCountByCity?.get(city) ?? 0;
          const pctActive = total > 0 ? Math.round((100 * local.active) / total) : 0;
          const pctAttention = total > 0 ? Math.round((100 * local.attention) / total) : 0;
          return [
            city,
            {
              city,
              total,
              tradePoints,
              active: local.active,
              top: local.top,
              attention: local.attention,
              potential: local.potential,
              pctActive,
              pctAttention,
              intensity: 0,
            },
          ] as [string, CityConcentrationRow];
        });
      })()
    : Array.from(map.entries()).map(([city, m]) => {
        const pctActive = m.total > 0 ? Math.round((100 * m.active) / m.total) : 0;
        const pctAttention = m.total > 0 ? Math.round((100 * m.attention) / m.total) : 0;
        return [
          city,
          {
            city,
            total: m.total,
            tradePoints: m.tradePoints,
            active: m.active,
            top: m.top,
            attention: m.attention,
            potential: m.potential,
            pctActive,
            pctAttention,
            intensity: 0,
          },
        ] as [string, CityConcentrationRow];
      });

  const sorted = entries
    .map(([, row]) => row)
    .sort((a, b) => b.total - a.total || a.city.localeCompare(b.city, "ru"));

  const maxTotal = sorted.reduce((mx, r) => Math.max(mx, r.total), 0) || 1;
  for (const r of sorted) {
    r.intensity = r.total / maxTotal;
  }

  return sorted;
}

export function getTopCityConcentrationRows(
  rows: DealerRow[],
  limit: number,
  act?: ActualizationState,
): CityConcentrationRow[] {
  return buildCityConcentrationRows(rows, act).slice(0, Math.max(0, limit));
}

/** Ссылка на режим «все города» в клиентской базе. */
export function buildDealerBaseAllCitiesHref(role: SalesRole, profile: ReleaseDemoProfile): string {
  if (role === "team_lead") {
    return buildBrowserHashAppHref("/dealer-base", { view: "team_cities", team: getEffectiveTeamLeadTeamId(profile) });
  }
  if (role === "sales_manager") {
    const id = getSalesUserById(profile.personaUserId)?.id ?? "";
    return buildBrowserHashAppHref("/dealer-base", { view: "my_cities", manager: id });
  }
  return buildBrowserHashAppHref("/dealer-base", { view: "cities_all" });
}

export function buildDealerBaseCityDrillHref(
  role: SalesRole,
  profile: ReleaseDemoProfile,
  city: string,
  extra?: { quick?: "active" | "attention"; ropTeamId?: string },
): string {
  const q = extra?.quick;
  const rop = extra?.ropTeamId;
  if (role === "team_lead") {
    const team = getEffectiveTeamLeadTeamId(profile);
    return buildBrowserHashAppHref("/dealer-base", { view: "table_team", team, city, ...(q ? { quick: q } : {}) });
  }
  if (role === "sales_manager") {
    const manager = getSalesUserById(profile.personaUserId)?.id ?? "";
    return buildBrowserHashAppHref("/dealer-base", { view: "my_clients", manager, city, ...(q ? { quick: q } : {}) });
  }
  if (rop && !isRopOrManagerAllFilter(rop)) {
    return buildBrowserHashAppHref("/dealer-base", { view: "table_team", team: rop, city, ...(q ? { quick: q } : {}) });
  }
  return buildBrowserHashAppHref("/dealer-base", { view: "table_all", city, ...(q ? { quick: q } : {}) });
}
