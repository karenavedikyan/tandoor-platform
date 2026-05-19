/**
 * Маршрутные листы по дням отгрузки и определения маршрутов (localStorage, без backend).
 * Ключ записи клиентов: shipment:{dayId}:{slotId}. Совместимость: старый ключ shipment:{dayId} → slot1.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { DealerShipmentDayId } from "@/lib/dealer-shipment-days";
import {
  DEALER_SHIPMENT_DAY_LABELS,
  DEALER_SHIPMENT_DAY_ORDER,
  getDealerShipmentDays,
} from "@/lib/dealer-shipment-days";

export const DEALER_ROUTE_PLAN_STORAGE_KEY = "tandoor-dealer-route-plan-v1";
export const DEALER_ROUTE_PLAN_EVENT = "tandoor-dealer-route-plan-changed";

export type ShipmentRouteSlotId = "slot1" | "slot2";

export type ShipmentRouteDefinition = {
  slotId: ShipmentRouteSlotId;
  name: string;
  settlements: string[];
};

export type DealerRouteDayEntry = {
  dealerIds: string[];
  updatedAt: string;
};

export type DealerRoutePlanState = {
  routesByUser: Record<string, Record<string, DealerRouteDayEntry>>;
  /** Определения маршрутов: до 2 на день. */
  routeDefinitionsByUser: Record<string, Record<DealerShipmentDayId, ShipmentRouteDefinition[]>>;
};

function emptyState(): DealerRoutePlanState {
  return { routesByUser: {}, routeDefinitionsByUser: {} };
}

/** @deprecated Используйте routePlanEntryKey */
export function routePlanDayKey(dayId: DealerShipmentDayId): string {
  return `shipment:${dayId}`;
}

export function routePlanEntryKey(dayId: DealerShipmentDayId, slotId: ShipmentRouteSlotId): string {
  return `shipment:${dayId}:${slotId}`;
}

function isShipmentDayId(s: string): s is DealerShipmentDayId {
  return (DEALER_SHIPMENT_DAY_ORDER as readonly string[]).includes(s);
}

function migrateState(raw: DealerRoutePlanState): DealerRoutePlanState {
  const routesByUser = { ...raw.routesByUser };
  const routeDefinitionsByUser: Record<string, Record<DealerShipmentDayId, ShipmentRouteDefinition[]>> = {
    ...raw.routeDefinitionsByUser,
  };

  for (const [userId, userRoutes] of Object.entries(routesByUser)) {
    const nextUser: Record<string, DealerRouteDayEntry> = { ...userRoutes };
    let changed = false;
    for (const [key, entry] of Object.entries(userRoutes)) {
      if (!key.startsWith("shipment:")) continue;
      const parts = key.split(":");
      if (parts.length !== 2) continue;
      const dayPart = parts[1];
      if (!dayPart || !isShipmentDayId(dayPart)) continue;
      const dayId = dayPart;
      const newKey = routePlanEntryKey(dayId, "slot1");
      if (userRoutes[newKey]) {
        const merged = [...(userRoutes[newKey]?.dealerIds ?? [])];
        const seen = new Set(merged);
        for (const id of entry.dealerIds) {
          if (!seen.has(id)) {
            seen.add(id);
            merged.push(id);
          }
        }
        nextUser[newKey] = { dealerIds: merged, updatedAt: new Date().toISOString() };
      } else {
        nextUser[newKey] = entry;
      }
      delete nextUser[key];
      changed = true;
      const defs = { ...(routeDefinitionsByUser[userId] ?? {}) };
      const dayDefs = [...(defs[dayId] ?? [])];
      if (!dayDefs.some((d) => d.slotId === "slot1")) {
        dayDefs.unshift({ slotId: "slot1", name: "Маршрут", settlements: [] });
      }
      defs[dayId] = dayDefs.slice(0, 2);
      routeDefinitionsByUser[userId] = defs;
    }
    if (changed) {
      routesByUser[userId] = nextUser;
    }
  }

  return { routesByUser, routeDefinitionsByUser };
}

export function loadDealerRoutePlanState(): DealerRoutePlanState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_ROUTE_PLAN_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<DealerRoutePlanState>;
    const base: DealerRoutePlanState = {
      routesByUser: p.routesByUser && typeof p.routesByUser === "object" ? p.routesByUser : {},
      routeDefinitionsByUser:
        p.routeDefinitionsByUser && typeof p.routeDefinitionsByUser === "object" ? p.routeDefinitionsByUser : {},
    };
    return migrateState(base);
  } catch {
    return emptyState();
  }
}

export function saveDealerRoutePlanState(state: DealerRoutePlanState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_ROUTE_PLAN_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_ROUTE_PLAN_EVENT));
}

function ensureUserDefs(state: DealerRoutePlanState, userId: string): DealerRoutePlanState {
  const migrated = migrateState(state);
  if (migrated.routeDefinitionsByUser[userId]) return migrated;
  const emptyUserDefs = {} as Record<DealerShipmentDayId, ShipmentRouteDefinition[]>;
  return { ...migrated, routeDefinitionsByUser: { ...migrated.routeDefinitionsByUser, [userId]: emptyUserDefs } };
}

export function listRouteDefinitions(
  userId: string,
  dayId: DealerShipmentDayId,
  state = loadDealerRoutePlanState(),
): ShipmentRouteDefinition[] {
  const s = migrateState(state);
  return [...(s.routeDefinitionsByUser[userId]?.[dayId] ?? [])].sort((a, b) => a.slotId.localeCompare(b.slotId));
}

export function setRouteDefinitionsForDay(
  userId: string,
  dayId: DealerShipmentDayId,
  definitions: ShipmentRouteDefinition[],
): void {
  const state = ensureUserDefs(loadDealerRoutePlanState(), userId);
  const next = definitions.slice(0, 2);
  const defsRoot = { ...state.routeDefinitionsByUser };
  const userDefs = { ...(defsRoot[userId] ?? {}) };
  userDefs[dayId] = next;
  defsRoot[userId] = userDefs;
  saveDealerRoutePlanState({ ...state, routeDefinitionsByUser: defsRoot });
}

export function upsertRouteDefinition(userId: string, dayId: DealerShipmentDayId, def: ShipmentRouteDefinition): void {
  const prev = listRouteDefinitions(userId, dayId);
  const others = prev.filter((d) => d.slotId !== def.slotId);
  const next = [...others, def].sort((a, b) => a.slotId.localeCompare(b.slotId)).slice(0, 2);
  setRouteDefinitionsForDay(userId, dayId, next);
}

export function deleteRouteSlot(userId: string, dayId: DealerShipmentDayId, slotId: ShipmentRouteSlotId): void {
  const state = migrateState(loadDealerRoutePlanState());
  const prev = listRouteDefinitions(userId, dayId, state);
  const next = prev.filter((d) => d.slotId !== slotId);
  const key = routePlanEntryKey(dayId, slotId);
  const routesByUser = { ...state.routesByUser };
  const userRoutes = { ...(routesByUser[userId] ?? {}) };
  delete userRoutes[key];
  routesByUser[userId] = userRoutes;
  const defsRoot = { ...state.routeDefinitionsByUser };
  const userDefs = { ...(defsRoot[userId] ?? {}) };
  userDefs[dayId] = next;
  defsRoot[userId] = userDefs;
  saveDealerRoutePlanState({ ...state, routesByUser, routeDefinitionsByUser: defsRoot });
}

export function addRouteSlot(userId: string, dayId: DealerShipmentDayId): ShipmentRouteSlotId | null {
  const prev = listRouteDefinitions(userId, dayId);
  if (prev.length >= 2) return null;
  const slotId: ShipmentRouteSlotId = prev.length === 0 ? "slot1" : "slot2";
  const n = prev.length + 1;
  upsertRouteDefinition(userId, dayId, { slotId, name: `Маршрут ${n}`, settlements: [] });
  return slotId;
}

export function getRouteDealerIds(
  userId: string,
  dayId: DealerShipmentDayId,
  slotId: ShipmentRouteSlotId,
  state = loadDealerRoutePlanState(),
): string[] {
  const s = migrateState(state);
  const key = routePlanEntryKey(dayId, slotId);
  return [...(s.routesByUser[userId]?.[key]?.dealerIds ?? [])];
}

/** @deprecated Используйте getRouteDealerIds с slotId */
export function getRouteForUserDay(userId: string, dayId: DealerShipmentDayId, state = loadDealerRoutePlanState()): string[] {
  return getRouteDealerIds(userId, dayId, "slot1", state);
}

export function addDealersToRoute(
  userId: string,
  dayId: DealerShipmentDayId,
  dealerIds: string[],
  slotId: ShipmentRouteSlotId = "slot1",
): void {
  if (!dealerIds.length) return;
  const state = migrateState(loadDealerRoutePlanState());
  const defs = listRouteDefinitions(userId, dayId, state);
  if (!defs.some((d) => d.slotId === slotId)) {
    upsertRouteDefinition(userId, dayId, { slotId, name: slotId === "slot1" ? "Маршрут 1" : "Маршрут 2", settlements: [] });
  }
  const key = routePlanEntryKey(dayId, slotId);
  const prev = state.routesByUser[userId]?.[key]?.dealerIds ?? [];
  const seen = new Set(prev);
  const next = [...prev];
  for (const id of dealerIds) {
    if (!seen.has(id)) {
      seen.add(id);
      next.push(id);
    }
  }
  const routesByUser = { ...state.routesByUser };
  const userRoutes = { ...(routesByUser[userId] ?? {}) };
  userRoutes[key] = { dealerIds: next, updatedAt: new Date().toISOString() };
  routesByUser[userId] = userRoutes;
  saveDealerRoutePlanState({ ...state, routesByUser });
}

export function removeDealerFromRoute(
  userId: string,
  dayId: DealerShipmentDayId,
  dealerId: string,
  slotId: ShipmentRouteSlotId = "slot1",
): void {
  const state = migrateState(loadDealerRoutePlanState());
  const key = routePlanEntryKey(dayId, slotId);
  const prev = state.routesByUser[userId]?.[key]?.dealerIds ?? [];
  const next = prev.filter((id) => id !== dealerId);
  const routesByUser = { ...state.routesByUser };
  const userRoutes = { ...(routesByUser[userId] ?? {}) };
  if (next.length === 0) {
    delete userRoutes[key];
  } else {
    userRoutes[key] = { dealerIds: next, updatedAt: new Date().toISOString() };
  }
  routesByUser[userId] = userRoutes;
  saveDealerRoutePlanState({ ...state, routesByUser });
}

export function reorderRouteDealer(
  userId: string,
  dayId: DealerShipmentDayId,
  dealerId: string,
  direction: "up" | "down",
  slotId: ShipmentRouteSlotId = "slot1",
): void {
  const state = migrateState(loadDealerRoutePlanState());
  const key = routePlanEntryKey(dayId, slotId);
  const prev = [...(state.routesByUser[userId]?.[key]?.dealerIds ?? [])];
  const i = prev.indexOf(dealerId);
  if (i < 0) return;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= prev.length) return;
  const next = [...prev];
  const t = next[i]!;
  next[i] = next[j]!;
  next[j] = t;
  const routesByUser = { ...state.routesByUser };
  const userRoutes = { ...(routesByUser[userId] ?? {}) };
  userRoutes[key] = { dealerIds: next, updatedAt: new Date().toISOString() };
  routesByUser[userId] = userRoutes;
  saveDealerRoutePlanState({ ...state, routesByUser });
}

export function countDealersOnRouteSettlements(
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
  scopedRows: DealerRow[],
): number {
  const settlements = def.settlements.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (settlements.length === 0) return 0;
  const set = new Set(settlements);
  let n = 0;
  for (const row of scopedRows) {
    if (!getDealerShipmentDays(row).includes(dayId)) continue;
    const city = row.city.trim().toLowerCase();
    if (set.has(city)) n += 1;
  }
  return n;
}

export function buildRouteCopyText(
  rows: DealerRow[],
  dayId: DealerShipmentDayId,
  routeName: string,
  buildDealerHref: (id: string) => string,
  statusLabel: (row: DealerRow) => string,
): string {
  const day = DEALER_SHIPMENT_DAY_LABELS[dayId];
  const lines: string[] = [`Маршрутный лист: ${day} · ${routeName}`];
  rows.forEach((row, idx) => {
    const href = buildDealerHref(row.id);
    const st = statusLabel(row);
    lines.push(`${idx + 1}. ${row.name} — ${row.city} — ${st} — ${href}`);
  });
  return lines.join("\n");
}
