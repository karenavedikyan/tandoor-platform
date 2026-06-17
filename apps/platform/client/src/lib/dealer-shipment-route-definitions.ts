/**
 * Описания маршрутов по дню отгрузки: LS-кеш + Postgres (Промт 114).
 */

import type { DealerShipmentDayId } from "./dealer-shipment-days.js";
import {
  apiBulkImportShipmentRoutes,
  apiDeleteShipmentRoute,
  apiUpsertShipmentRoute,
  dtoToLocalRoute,
  fetchShipmentRoutesList,
} from "./dealer-shipment-routes-api.js";
import { enqueuePendingSync, makePendingId } from "./overrides-pending-sync.js";

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

let sessionAuthUserId: string | null = null;

export function setShipmentRoutesSessionKeys(authUserId: string | null): void {
  sessionAuthUserId = authUserId;
}

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

function applyRoutesToLocalUser(
  localUserId: string,
  items: { dayId: DealerShipmentDayId; route: DealerShipmentRouteDefinition }[],
): void {
  const state = loadDealerShipmentRouteDefsState();
  const userDays: Partial<Record<DealerShipmentDayId, DealerShipmentRouteDayDefs>> = {};
  for (const { dayId, route } of items) {
    const prev = userDays[dayId]?.routes ?? [];
    userDays[dayId] = { routes: [...prev, route].slice(0, DEALER_SHIPMENT_ROUTES_PER_DAY_LIMIT) };
  }
  state.byUser[localUserId] = userDays;
  saveDealerShipmentRouteDefsState(state);
}

/** Загрузить маршруты с сервера в LS (ключ byUser — personaUserId). */
export async function hydrateShipmentRoutesFromServer(
  authUserId: string,
  localUserId: string,
): Promise<boolean> {
  setShipmentRoutesSessionKeys(authUserId);
  const payload = await fetchShipmentRoutesList(authUserId);
  if (!payload) return false;
  const items = payload.items.map((d) => ({
    dayId: d.dayId,
    route: dtoToLocalRoute(d),
  }));
  applyRoutesToLocalUser(localUserId, items);
  return true;
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

function persistLocalRoute(
  userId: string,
  dayId: DealerShipmentDayId,
  route: DealerShipmentRouteDefinition,
  isNew: boolean,
): void {
  const state = loadDealerShipmentRouteDefsState();
  const { byUser, userDays } = withUserDays(state, userId);
  const existing = userDays[dayId]?.routes ?? [];
  if (isNew) {
    userDays[dayId] = { routes: [...existing, route].slice(0, DEALER_SHIPMENT_ROUTES_PER_DAY_LIMIT) };
  } else {
    const idx = existing.findIndex((r) => r.id === route.id);
    const next = existing.slice();
    if (idx >= 0) next[idx] = route;
    else next.push(route);
    userDays[dayId] = { routes: next.slice(0, DEALER_SHIPMENT_ROUTES_PER_DAY_LIMIT) };
  }
  saveDealerShipmentRouteDefsState({ byUser });
}

async function syncRouteToServer(
  localUserId: string,
  dayId: DealerShipmentDayId,
  route: DealerShipmentRouteDefinition,
  authUserId: string,
): Promise<void> {
  const r = await apiUpsertShipmentRoute({
    id: route.id,
    userId: authUserId,
    dayId,
    name: route.name,
    cities: route.cities,
  });
  if (r.ok && r.item) {
    persistLocalRoute(localUserId, dayId, dtoToLocalRoute(r.item), false);
    return;
  }
  enqueuePendingSync({
    id: makePendingId("shipment-routes-upsert", `${route.id}:${dayId}`),
    kind: "shipment-routes-upsert",
    payload: {
      id: route.id,
      userId: authUserId,
      localUserId,
      dayId,
      name: route.name,
      cities: route.cities,
    },
  });
}

/** Синхронная запись в LS (legacy); предпочтительно upsertShipmentRouteAsync. */
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
  const authId = sessionAuthUserId;

  if (input.id) {
    const idx = existing.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      const route: DealerShipmentRouteDefinition = {
        ...existing[idx]!,
        name,
        cities: cleanedCities,
        updatedAt: now,
        updatedBy: userId,
      };
      persistLocalRoute(userId, dayId, route, false);
      if (authId) void syncRouteToServer(userId, dayId, route, authId);
      return route;
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
  persistLocalRoute(userId, dayId, created, true);
  if (authId) void syncRouteToServer(userId, dayId, created, authId);
  return created;
}

export async function upsertShipmentRouteAsync(
  localUserId: string,
  authUserId: string,
  dayId: DealerShipmentDayId,
  input: { id?: string; name: string; cities: string[] },
): Promise<DealerShipmentRouteDefinition | null> {
  setShipmentRoutesSessionKeys(authUserId);
  const local = upsertShipmentRoute(localUserId, dayId, input);
  if (!local) return null;
  await syncRouteToServer(localUserId, dayId, local, authUserId);
  return local;
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

  const authId = sessionAuthUserId;
  if (authId) {
    void apiDeleteShipmentRoute({ id: routeId, userId: authId, deletedBy: userId }).then((ok) => {
      if (!ok) {
        enqueuePendingSync({
          id: makePendingId("shipment-routes-delete", routeId),
          kind: "shipment-routes-delete",
          payload: { id: routeId, userId: authId, deletedBy: userId },
        });
      }
    });
  }
}

export async function removeShipmentRouteAsync(
  localUserId: string,
  authUserId: string,
  dayId: DealerShipmentDayId,
  routeId: string,
): Promise<void> {
  setShipmentRoutesSessionKeys(authUserId);
  removeShipmentRoute(localUserId, dayId, routeId);
}

export function formatShipmentRouteCities(cities: string[]): string {
  if (cities.length === 0) return "—";
  return cities.join(", ");
}

export function buildBulkImportItemsFromLocalState(
  localUserId: string,
): { id: string; dayId: DealerShipmentDayId; name: string; cities: string[]; updatedAt: string; updatedBy: string }[] {
  const state = loadDealerShipmentRouteDefsState();
  const days = state.byUser[localUserId];
  if (!days) return [];
  const out: {
    id: string;
    dayId: DealerShipmentDayId;
    name: string;
    cities: string[];
    updatedAt: string;
    updatedBy: string;
  }[] = [];
  for (const [dayKey, entry] of Object.entries(days)) {
    if (!isShipmentDayId(dayKey) || !entry?.routes) continue;
    for (const r of entry.routes) {
      out.push({
        id: r.id,
        dayId: dayKey,
        name: r.name,
        cities: r.cities,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy || localUserId,
      });
    }
  }
  return out;
}
