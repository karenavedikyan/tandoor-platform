/**
 * Описания маршрутов по дню отгрузки (localStorage, без backend).
 * До 2 маршрутов на день. Каждый маршрут — имя + список населённых пунктов.
 */

import type { DealerShipmentDayId } from "@/lib/dealer-shipment-days";

export const DEALER_SHIPMENT_ROUTE_DEFS_STORAGE_KEY = "tandoor-dealer-shipment-route-defs-v1";
export const DEALER_SHIPMENT_ROUTE_DEFS_EVENT = "tandoor-dealer-shipment-route-defs-changed";

export const DEALER_SHIPMENT_ROUTES_PER_DAY_LIMIT = 2;

export type DealerShipmentRouteDefinition = {
  id: string;
  name: string;
  cities: string[];
  updatedAt: string;
  updatedBy: string;
};

export type DealerShipmentRouteDayDefs = {
  routes: DealerShipmentRouteDefinition[];
};

export type DealerShipmentRouteDefsState = {
  byUser: Record<string, Partial<Record<DealerShipmentDayId, DealerShipmentRouteDayDefs>>>;
};

function emptyState(): DealerShipmentRouteDefsState {
  return { byUser: {} };
}

function isShipmentDayId(v: unknown): v is DealerShipmentDayId {
  return (
    v === "monday" ||
    v === "tuesday" ||
    v === "wednesday" ||
    v === "thursday" ||
    v === "friday" ||
    v === "saturday"
  );
}

function sanitizeRoute(raw: unknown): DealerShipmentRouteDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<DealerShipmentRouteDefinition>;
  const id = typeof r.id === "string" && r.id.trim() ? r.id : "";
  const name = typeof r.name === "string" ? r.name : "";
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : "";
  const updatedBy = typeof r.updatedBy === "string" ? r.updatedBy : "";
  if (!id) return null;
  const cities = Array.isArray(r.cities)
    ? Array.from(
        new Set(
          r.cities
            .filter((c): c is string => typeof c === "string")
            .map((c) => c.trim())
            .filter((c) => c.length > 0),
        ),
      )
    : [];
  return { id, name, cities, updatedAt, updatedBy };
}

export function loadDealerShipmentRouteDefsState(): DealerShipmentRouteDefsState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_SHIPMENT_ROUTE_DEFS_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<DealerShipmentRouteDefsState>;
    const byUser: DealerShipmentRouteDefsState["byUser"] = {};
    if (parsed.byUser && typeof parsed.byUser === "object") {
      for (const [userId, days] of Object.entries(parsed.byUser)) {
        if (!days || typeof days !== "object") continue;
        const userDays: Partial<Record<DealerShipmentDayId, DealerShipmentRouteDayDefs>> = {};
        for (const [dayKey, entry] of Object.entries(days as Record<string, unknown>)) {
          if (!isShipmentDayId(dayKey)) continue;
          const routesRaw = (entry as Partial<DealerShipmentRouteDayDefs>)?.routes;
          if (!Array.isArray(routesRaw)) continue;
          const routes = routesRaw
            .map(sanitizeRoute)
            .filter((r): r is DealerShipmentRouteDefinition => r !== null)
            .slice(0, DEALER_SHIPMENT_ROUTES_PER_DAY_LIMIT);
          if (routes.length > 0) userDays[dayKey] = { routes };
        }
        byUser[userId] = userDays;
      }
    }
    return { byUser };
  } catch {
    return emptyState();
  }
}

export function saveDealerShipmentRouteDefsState(state: DealerShipmentRouteDefsState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_SHIPMENT_ROUTE_DEFS_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_SHIPMENT_ROUTE_DEFS_EVENT));
}

export function getShipmentRoutesForUserDay(
  userId: string,
  dayId: DealerShipmentDayId,
  state: DealerShipmentRouteDefsState = loadDealerShipmentRouteDefsState(),
): DealerShipmentRouteDefinition[] {
  const list = state.byUser[userId]?.[dayId]?.routes;
  return list ? list.map((r) => ({ ...r, cities: [...r.cities] })) : [];
}

function generateRouteId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `route-${Date.now().toString(36)}-${rnd}`;
}

export function createShipmentRouteId(): string {
  return generateRouteId();
}

function withUserDays(
  state: DealerShipmentRouteDefsState,
  userId: string,
): { byUser: DealerShipmentRouteDefsState["byUser"]; userDays: Partial<Record<DealerShipmentDayId, DealerShipmentRouteDayDefs>> } {
  const byUser = { ...state.byUser };
  const userDays = { ...(byUser[userId] ?? {}) };
  byUser[userId] = userDays;
  return { byUser, userDays };
}

export function upsertShipmentRoute(
  userId: string,
  dayId: DealerShipmentDayId,
  input: { id?: string; name: string; cities: string[] },
): DealerShipmentRouteDefinition | null {
  const state = loadDealerShipmentRouteDefsState();
  const { byUser, userDays } = withUserDays(state, userId);
  const existing = userDays[dayId]?.routes ?? [];
  const cleanedCities = Array.from(
    new Set(
      input.cities
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
    ),
  );
  const name = input.name.trim();
  const now = new Date().toISOString();

  if (input.id) {
    const idx = existing.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      const next = existing.slice();
      next[idx] = { ...next[idx]!, name, cities: cleanedCities, updatedAt: now, updatedBy: userId };
      userDays[dayId] = { routes: next };
      saveDealerShipmentRouteDefsState({ byUser });
      return next[idx]!;
    }
  }

  if (existing.length >= DEALER_SHIPMENT_ROUTES_PER_DAY_LIMIT) {
    return null;
  }
  const created: DealerShipmentRouteDefinition = {
    id: input.id && input.id.trim() ? input.id : generateRouteId(),
    name,
    cities: cleanedCities,
    updatedAt: now,
    updatedBy: userId,
  };
  userDays[dayId] = { routes: [...existing, created] };
  saveDealerShipmentRouteDefsState({ byUser });
  return created;
}

export function removeShipmentRoute(
  userId: string,
  dayId: DealerShipmentDayId,
  routeId: string,
): void {
  const state = loadDealerShipmentRouteDefsState();
  const existing = state.byUser[userId]?.[dayId]?.routes;
  if (!existing || existing.length === 0) return;
  const next = existing.filter((r) => r.id !== routeId);
  const { byUser, userDays } = withUserDays(state, userId);
  if (next.length === 0) {
    delete userDays[dayId];
  } else {
    userDays[dayId] = { routes: next };
  }
  saveDealerShipmentRouteDefsState({ byUser });
}

export function formatShipmentRouteCities(cities: string[]): string {
  if (cities.length === 0) return "—";
  return cities.join(", ");
}
