import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { dealerNeedsAttention, isDealerTop } from "@/lib/dealer-base-role-views";
import { buildHashPath } from "@/lib/hash-route-utils";
import { isRopOrManagerAllFilter } from "@/lib/rop-manager-filters";
import { getEffectiveTeamLeadTeamId, type ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { getSalesUserById, type SalesRole } from "@/lib/sales-control-data";

export type CityRiskLevel = "critical" | "ok";

export type CityConcentrationRow = {
  city: string;
  total: number;
  active: number;
  top: number;
  attention: number;
  potential: number;
  pctActive: number;
  pctAttention: number;
  /** Доля от города с максимумом клиентов в переданном наборе (0..1). */
  intensity: number;
};

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

export function buildCityConcentrationRows(rows: DealerRow[]): CityConcentrationRow[] {
  const map = new Map<
    string,
    { total: number; active: number; top: number; attention: number; potential: number }
  >();
  for (const r of rows) {
    const city = r.city?.trim() || "—";
    const cur = map.get(city) ?? { total: 0, active: 0, top: 0, attention: 0, potential: 0 };
    cur.total += 1;
    if (r.status === "активный") cur.active += 1;
    if (isDealerTop(r)) cur.top += 1;
    if (dealerNeedsAttention(r)) cur.attention += 1;
    if (r.status === "потенциальный") cur.potential += 1;
    map.set(city, cur);
  }
  const sorted = Array.from(map.entries())
    .map(([city, m]) => {
      const pctActive = m.total > 0 ? Math.round((100 * m.active) / m.total) : 0;
      const pctAttention = m.total > 0 ? Math.round((100 * m.attention) / m.total) : 0;
      return {
        city,
        total: m.total,
        active: m.active,
        top: m.top,
        attention: m.attention,
        potential: m.potential,
        pctActive,
        pctAttention,
        intensity: 0,
      };
    })
    .sort((a, b) => b.total - a.total || a.city.localeCompare(b.city, "ru"));

  const maxTotal = sorted.reduce((mx, r) => Math.max(mx, r.total), 0) || 1;
  for (const r of sorted) {
    r.intensity = r.total / maxTotal;
  }
  return sorted;
}

export function getTopCityConcentrationRows(rows: DealerRow[], limit: number): CityConcentrationRow[] {
  return buildCityConcentrationRows(rows).slice(0, Math.max(0, limit));
}

/** Ссылка на режим «все города» в клиентской базе. */
export function buildDealerBaseAllCitiesHref(role: SalesRole, profile: ReleaseDemoProfile): string {
  if (role === "team_lead") {
    return buildHashPath("/dealer-base", { view: "team_cities", team: getEffectiveTeamLeadTeamId(profile) });
  }
  if (role === "sales_manager") {
    const id = getSalesUserById(profile.personaUserId)?.id ?? "";
    return buildHashPath("/dealer-base", { view: "my_cities", manager: id });
  }
  return buildHashPath("/dealer-base", { view: "cities_all" });
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
    return buildHashPath("/dealer-base", { view: "table_team", team, city, ...(q ? { quick: q } : {}) });
  }
  if (role === "sales_manager") {
    const manager = getSalesUserById(profile.personaUserId)?.id ?? "";
    return buildHashPath("/dealer-base", { view: "my_clients", manager, city, ...(q ? { quick: q } : {}) });
  }
  if (rop && !isRopOrManagerAllFilter(rop)) {
    return buildHashPath("/dealer-base", { view: "table_team", team: rop, city, ...(q ? { quick: q } : {}) });
  }
  return buildHashPath("/dealer-base", { view: "table_all", city, ...(q ? { quick: q } : {}) });
}
