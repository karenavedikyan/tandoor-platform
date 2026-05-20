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
import { getDealerUnloadingOrder } from "@/lib/dealer-unloading-order-storage";

export const DEALER_ROUTE_PLAN_STORAGE_KEY = "tandoor-dealer-route-plan-v1";
export const DEALER_ROUTE_PLAN_EVENT = "tandoor-dealer-route-plan-changed";

export type ShipmentRouteSlotId = "slot1" | "slot2";

export type ShipmentRouteDefinition = {
  slotId: ShipmentRouteSlotId;
  name: string;
  settlements: string[];
  /** Явно добавленные клиенты (остаются в маршруте вне совпадения НП). */
  pinnedDealerIds?: string[];
  /** Не подмешивать из авто-подбора по НП, пока не снято вручную. */
  excludedDealerIds?: string[];
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

function normCity(s: string): string {
  return s.trim().toLowerCase();
}

export function dealerAutoMatchesRouteSettlements(
  row: DealerRow,
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
): boolean {
  if (!getDealerShipmentDays(row).includes(dayId)) return false;
  const settlements = def.settlements.map(normCity).filter(Boolean);
  if (settlements.length === 0) return false;
  return new Set(settlements).has(normCity(row.city));
}

/** Авто-подбор по НП и дню отгрузки (с учётом excluded). */
export function computeAutoRouteDealerIds(
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
  scopedRows: DealerRow[],
): string[] {
  const excluded = new Set(def.excludedDealerIds ?? []);
  const byName = new Map(scopedRows.map((r) => [r.id, r.name]));
  const out: string[] = [];
  for (const r of scopedRows) {
    if (excluded.has(r.id)) continue;
    if (!dealerAutoMatchesRouteSettlements(r, dayId, def)) continue;
    out.push(r.id);
  }
  out.sort((a, b) => (byName.get(a) ?? "").localeCompare(byName.get(b) ?? "", "ru", { sensitivity: "base" }));
  return out;
}

/** Итоговый список id клиентов маршрута (явный порядок в storage или авто+закреплённые). */
export function computeDisplayedRouteDealerIds(
  userId: string,
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
  scopedRows: DealerRow[],
  state = loadDealerRoutePlanState(),
): string[] {
  const scopedSet = new Set(scopedRows.map((r) => r.id));
  const saved = getRouteDealerIds(userId, dayId, def.slotId, state).filter((id) => scopedSet.has(id));
  if (saved.length > 0) return saved;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of def.pinnedDealerIds ?? []) {
    if (!scopedSet.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of computeAutoRouteDealerIds(dayId, def, scopedRows)) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function patchRouteDefinition(
  userId: string,
  dayId: DealerShipmentDayId,
  slotId: ShipmentRouteSlotId,
  mut: (d: ShipmentRouteDefinition) => ShipmentRouteDefinition,
  state = loadDealerRoutePlanState(),
): void {
  const defs = listRouteDefinitions(userId, dayId, state);
  const cur = defs.find((d) => d.slotId === slotId);
  if (!cur) return;
  const nextDef = mut({ ...cur });
  upsertRouteDefinition(userId, dayId, nextDef);
}

export function setRouteDealerIds(
  userId: string,
  dayId: DealerShipmentDayId,
  slotId: ShipmentRouteSlotId,
  dealerIds: string[],
): void {
  const state = migrateState(loadDealerRoutePlanState());
  const key = routePlanEntryKey(dayId, slotId);
  const routesByUser = { ...state.routesByUser };
  const userRoutes = { ...(routesByUser[userId] ?? {}) };
  if (dealerIds.length === 0) {
    delete userRoutes[key];
  } else {
    userRoutes[key] = { dealerIds: [...dealerIds], updatedAt: new Date().toISOString() };
  }
  routesByUser[userId] = userRoutes;
  saveDealerRoutePlanState({ ...state, routesByUser });
}

/** Сохранить маршрут из редактора: порядок клиентов + метаданные закреплений/исключений. */
export function saveRouteEditorState(
  userId: string,
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
  orderedDealerIds: string[],
  scopedRows: DealerRow[],
): void {
  const scopedSet = new Set(scopedRows.map((r) => r.id));
  const ordered = orderedDealerIds.filter((id) => scopedSet.has(id));
  const rawAuto = new Set(computeRawSettlementDayDealerIds(dayId, def, scopedRows));
  const pinned = ordered.filter((id) => !rawAuto.has(id));
  const excludedFromAuto = Array.from(rawAuto).filter((id) => !ordered.includes(id));
  const prevEx = def.excludedDealerIds ?? [];
  const excluded = Array.from(new Set([...prevEx, ...excludedFromAuto])).filter((id) => !ordered.includes(id));
  const nextDef: ShipmentRouteDefinition = {
    ...def,
    pinnedDealerIds: pinned.length ? pinned : undefined,
    excludedDealerIds: excluded.length ? excluded : undefined,
  };
  upsertRouteDefinition(userId, dayId, nextDef);
  setRouteDealerIds(userId, dayId, def.slotId, ordered);
}

/** Клиенты по НП + дню без учёта ручных исключений (для расчёта pinned/excluded при сохранении). */
export function computeRawSettlementDayDealerIds(
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
  scopedRows: DealerRow[],
): string[] {
  const settlements = def.settlements.map(normCity).filter(Boolean);
  if (settlements.length === 0) return [];
  const set = new Set(settlements);
  const byName = new Map(scopedRows.map((r) => [r.id, r.name]));
  const out: string[] = [];
  for (const r of scopedRows) {
    if (!getDealerShipmentDays(r).includes(dayId)) continue;
    if (!set.has(normCity(r.city))) continue;
    out.push(r.id);
  }
  out.sort((a, b) => (byName.get(a) ?? "").localeCompare(byName.get(b) ?? "", "ru", { sensitivity: "base" }));
  return out;
}

export function sortRouteByUnloadingOrder(
  userId: string,
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
  scopedRows: DealerRow[],
): void {
  const state = loadDealerRoutePlanState();
  const ids = computeDisplayedRouteDealerIds(userId, dayId, def, scopedRows, state);
  const byId = new Map(scopedRows.map((r) => [r.id, r]));
  const rows = ids.map((id) => byId.get(id)).filter((r): r is DealerRow => Boolean(r));
  rows.sort((a, b) => {
    const oa = getDealerUnloadingOrder(a.id);
    const ob = getDealerUnloadingOrder(b.id);
    if (oa != null && ob != null && oa !== ob) return oa - ob;
    if (oa != null && ob == null) return -1;
    if (oa == null && ob != null) return 1;
    return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
  });
  saveRouteEditorState(userId, dayId, def, rows.map((r) => r.id), scopedRows);
}

/** Клиенты в выбранных НП, но с другим днём отгрузки (для подсказки в UI). */
export function listDealersWrongShipmentDayForRoute(
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
  scopedRows: DealerRow[],
): DealerRow[] {
  const settlements = def.settlements.map(normCity).filter(Boolean);
  if (settlements.length === 0) return [];
  const set = new Set(settlements);
  const out: DealerRow[] = [];
  for (const r of scopedRows) {
    if (!set.has(normCity(r.city))) continue;
    if (getDealerShipmentDays(r).includes(dayId)) continue;
    out.push(r);
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" }));
  return out;
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

  patchRouteDefinition(userId, dayId, slotId, (d) => {
    const pin = new Set(d.pinnedDealerIds ?? []);
    const ex = new Set(d.excludedDealerIds ?? []);
    for (const id of dealerIds) {
      pin.add(id);
      ex.delete(id);
    }
    const pinnedDealerIds = Array.from(pin);
    return {
      ...d,
      pinnedDealerIds: pinnedDealerIds.length ? pinnedDealerIds : undefined,
      excludedDealerIds: ex.size ? Array.from(ex) : undefined,
    };
  });
}

export function removeDealerFromRoute(
  userId: string,
  dayId: DealerShipmentDayId,
  dealerId: string,
  slotId: ShipmentRouteSlotId = "slot1",
  row?: DealerRow,
): void {
  const state = migrateState(loadDealerRoutePlanState());
  const key = routePlanEntryKey(dayId, slotId);
  const prevSaved = state.routesByUser[userId]?.[key]?.dealerIds ?? [];
  const next = prevSaved.filter((id) => id !== dealerId);
  const routesByUser = { ...state.routesByUser };
  const userRoutes = { ...(routesByUser[userId] ?? {}) };
  if (next.length === 0) {
    delete userRoutes[key];
  } else {
    userRoutes[key] = { dealerIds: next, updatedAt: new Date().toISOString() };
  }
  routesByUser[userId] = userRoutes;
  saveDealerRoutePlanState({ ...state, routesByUser });

  patchRouteDefinition(userId, dayId, slotId, (d) => {
    const pin = new Set(d.pinnedDealerIds ?? []);
    pin.delete(dealerId);
    const ex = new Set(d.excludedDealerIds ?? []);
    if (prevSaved.length === 0) {
      ex.add(dealerId);
    } else if (row != null && dealerAutoMatchesRouteSettlements(row, dayId, d)) {
      ex.add(dealerId);
    }
    return {
      ...d,
      pinnedDealerIds: pin.size ? Array.from(pin) : undefined,
      excludedDealerIds: ex.size ? Array.from(ex) : undefined,
    };
  });
}

export function reorderRouteDealer(
  userId: string,
  dayId: DealerShipmentDayId,
  dealerId: string,
  direction: "up" | "down",
  slotId: ShipmentRouteSlotId = "slot1",
  seed?: { def: ShipmentRouteDefinition; scopedRows: DealerRow[] },
): void {
  let state = migrateState(loadDealerRoutePlanState());
  const key = routePlanEntryKey(dayId, slotId);
  let prev = [...(state.routesByUser[userId]?.[key]?.dealerIds ?? [])];
  if (prev.length === 0 && seed) {
    prev = computeDisplayedRouteDealerIds(userId, dayId, seed.def, seed.scopedRows, state);
    if (prev.length > 0) {
      setRouteDealerIds(userId, dayId, slotId, prev);
      state = migrateState(loadDealerRoutePlanState());
      prev = [...(state.routesByUser[userId]?.[key]?.dealerIds ?? [])];
    }
  }
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

/** Количество клиентов в маршруте (совпадает с отображаемым списком). */
export function countDealersOnRouteSettlements(
  userId: string,
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
  scopedRows: DealerRow[],
  state = loadDealerRoutePlanState(),
): number {
  return computeDisplayedRouteDealerIds(userId, dayId, def, scopedRows, state).length;
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
