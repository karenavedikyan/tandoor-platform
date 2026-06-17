/**
 * Маршрутные листы по дням отгрузки и определения маршрутов (localStorage, без backend).
 * Ключ записи клиентов: shipment:{dayId}:{slotId}. Совместимость: старый ключ shipment:{dayId} → slot1.
 */

import type { DealerRow } from "./dealer-base-mock-data.js";
import type { DealerShipmentDayId } from "./dealer-shipment-days.js";
import {
  DEALER_SHIPMENT_DAY_LABELS,
  DEALER_SHIPMENT_DAY_ORDER,
  getDealerShipmentDays,
} from "./dealer-shipment-days.js";
import { getDealerUnloadingOrder } from "./dealer-unloading-order-storage.js";

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
  /**
   * Порядок точек внутри конкретного маршрута (день + слот), не глобальный «Порядок выгрузки» в карточке.
   * Если ни у кого нет валидного номера (≥1), порядок берётся из dealerIds как раньше.
   */
  clientOrderByDealerId?: Record<string, number>;
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

/** Валидный порядок в маршруте: целое ≥ 1. */
export function normalizeRouteClientOrder(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

/** Парсинг полей «№» в редакторе / раскрытом маршруте: только целые ≥ 1. */
export function parseRouteClientOrderInputStrings(raw: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, s] of Object.entries(raw)) {
    const t = s.trim();
    if (!t) continue;
    const n = Number(t);
    if (!Number.isInteger(n) || n < 1) continue;
    out[id] = n;
  }
  return out;
}

/**
 * Сохранить route-specific номера и порядок dealerIds после правок в раскрытом маршруте.
 */
export function persistRouteClientOrderInputs(
  userId: string,
  dayId: DealerShipmentDayId,
  slotId: ShipmentRouteSlotId,
  def: ShipmentRouteDefinition,
  scopedRows: DealerRow[],
  inputByDealerId: Record<string, string>,
): void {
  const parsed = parseRouteClientOrderInputStrings(inputByDealerId);
  const st = loadDealerRoutePlanState();
  const ids = computeDisplayedRouteDealerIds(userId, dayId, def, scopedRows, st);
  const nameById = new Map(scopedRows.map((r) => [r.id, r.name]));
  const sortedIds = sortDealerIdsByRouteClientOrder(
    ids,
    Object.keys(parsed).length ? parsed : undefined,
    nameById,
  );
  setRouteDealerIds(userId, dayId, slotId, sortedIds, Object.keys(parsed).length ? parsed : null);
}

/**
 * Сортировка id клиентов по route-specific номерам; при отсутствии валидных номеров — исходный порядок dealerIds.
 */
export function sortDealerIdsByRouteClientOrder(
  dealerIds: string[],
  clientOrderByDealerId: Record<string, number> | undefined | null,
  nameById: Map<string, string>,
): string[] {
  if (!clientOrderByDealerId || Object.keys(clientOrderByDealerId).length === 0) {
    return [...dealerIds];
  }
  const anyExplicit = dealerIds.some((id) => normalizeRouteClientOrder(clientOrderByDealerId[id]) != null);
  if (!anyExplicit) return [...dealerIds];
  return [...dealerIds].sort((a, b) => {
    const oa = normalizeRouteClientOrder(clientOrderByDealerId[a]);
    const ob = normalizeRouteClientOrder(clientOrderByDealerId[b]);
    if (oa != null && ob != null && oa !== ob) return oa - ob;
    if (oa != null && ob == null) return -1;
    if (oa == null && ob != null) return 1;
    const na = nameById.get(a) ?? "";
    const nb = nameById.get(b) ?? "";
    return na.localeCompare(nb, "ru", { sensitivity: "base" });
  });
}

export function getDealerRouteDayEntry(
  userId: string,
  dayId: DealerShipmentDayId,
  slotId: ShipmentRouteSlotId,
  state = loadDealerRoutePlanState(),
): DealerRouteDayEntry | undefined {
  const s = migrateState(state);
  const key = routePlanEntryKey(dayId, slotId);
  return s.routesByUser[userId]?.[key];
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

function filterClientOrderMapForDealerIds(
  order: Record<string, number> | undefined,
  dealerIds: string[],
): Record<string, number> | undefined {
  if (!order || dealerIds.length === 0) return undefined;
  const idset = new Set(dealerIds);
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(order)) {
    if (!idset.has(k)) continue;
    const n = normalizeRouteClientOrder(v);
    if (n != null) next[k] = n;
  }
  return Object.keys(next).length ? next : undefined;
}

/** Итоговый список id клиентов маршрута (явный порядок в storage или авто+закреплённые). */
export function computeDisplayedRouteDealerIds(
  userId: string,
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
  scopedRows: DealerRow[],
  state = loadDealerRoutePlanState(),
): string[] {
  const s = migrateState(state);
  const scopedSet = new Set(scopedRows.map((r) => r.id));
  const key = routePlanEntryKey(dayId, def.slotId);
  const entry = s.routesByUser[userId]?.[key];
  const savedRaw = (entry?.dealerIds ?? []).filter((id) => scopedSet.has(id));

  const auto = computeAutoRouteDealerIds(dayId, def, scopedRows);
  const pinned = (def.pinnedDealerIds ?? []).filter((id) => scopedSet.has(id));

  const unionSet = new Set<string>();
  for (const id of pinned) unionSet.add(id);
  for (const id of auto) unionSet.add(id);
  for (const id of savedRaw) unionSet.add(id);

  const union = Array.from(unionSet);
  if (union.length === 0) return [];

  const nameById = new Map(scopedRows.map((r) => [r.id, r.name]));
  const orderMap = entry?.clientOrderByDealerId;
  if (orderMap && Object.keys(orderMap).length > 0) {
    const anyExplicit = union.some((id) => normalizeRouteClientOrder(orderMap[id]) != null);
    if (anyExplicit) {
      return sortDealerIdsByRouteClientOrder(union, orderMap, nameById);
    }
  }

  if (savedRaw.length > 0) {
    const savedOrdered = savedRaw.filter((id) => unionSet.has(id));
    const rest = union.filter((id) => !savedOrdered.includes(id));
    rest.sort((a, b) => (nameById.get(a) ?? "").localeCompare(nameById.get(b) ?? "", "ru", { sensitivity: "base" }));
    return [...savedOrdered, ...rest];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of pinned) {
    if (!scopedSet.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of auto) {
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
  clientOrderByDealerId?: Record<string, number> | null,
): void {
  const state = migrateState(loadDealerRoutePlanState());
  const key = routePlanEntryKey(dayId, slotId);
  const prevEntry = state.routesByUser[userId]?.[key];
  const routesByUser = { ...state.routesByUser };
  const userRoutes = { ...(routesByUser[userId] ?? {}) };
  const explicitOrderArg = arguments.length >= 5;

  let nextClientOrder: Record<string, number> | undefined;
  if (!explicitOrderArg) {
    nextClientOrder = filterClientOrderMapForDealerIds(prevEntry?.clientOrderByDealerId, dealerIds);
  } else if (clientOrderByDealerId === null) {
    nextClientOrder = undefined;
  } else {
    nextClientOrder = filterClientOrderMapForDealerIds(clientOrderByDealerId ?? {}, dealerIds);
  }

  if (dealerIds.length === 0) {
    delete userRoutes[key];
  } else {
    const entry: DealerRouteDayEntry = { dealerIds: [...dealerIds], updatedAt: new Date().toISOString() };
    if (nextClientOrder) entry.clientOrderByDealerId = nextClientOrder;
    userRoutes[key] = entry;
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
  clientOrderByDealerId?: Record<string, number> | null,
): void {
  const scopedSet = new Set(scopedRows.map((r) => r.id));
  const ordered = orderedDealerIds.filter((id) => scopedSet.has(id));

  if (ordered.length === 0) {
    const nextDef: ShipmentRouteDefinition = {
      ...def,
      pinnedDealerIds: undefined,
      excludedDealerIds: undefined,
    };
    upsertRouteDefinition(userId, dayId, nextDef);
    if (clientOrderByDealerId !== undefined) {
      setRouteDealerIds(userId, dayId, def.slotId, [], clientOrderByDealerId);
    } else {
      setRouteDealerIds(userId, dayId, def.slotId, [], null);
    }
    return;
  }

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
  if (clientOrderByDealerId !== undefined) {
    setRouteDealerIds(userId, dayId, def.slotId, ordered, clientOrderByDealerId);
  } else {
    setRouteDealerIds(userId, dayId, def.slotId, ordered);
  }
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

/** @returns false если ни у одного клиента маршрута не задан глобальный порядок выгрузки */
export function sortRouteByUnloadingOrder(
  userId: string,
  dayId: DealerShipmentDayId,
  def: ShipmentRouteDefinition,
  scopedRows: DealerRow[],
): boolean {
  const state = loadDealerRoutePlanState();
  const ids = computeDisplayedRouteDealerIds(userId, dayId, def, scopedRows, state);
  const byId = new Map(scopedRows.map((r) => [r.id, r]));
  const rows = ids.map((id) => byId.get(id)).filter((r): r is DealerRow => Boolean(r));
  if (rows.length === 0) return true;
  const anyGlobal = rows.some((r) => getDealerUnloadingOrder(r.id) != null);
  if (!anyGlobal) return false;
  rows.sort((a, b) => {
    const oa = getDealerUnloadingOrder(a.id);
    const ob = getDealerUnloadingOrder(b.id);
    if (oa != null && ob != null && oa !== ob) return oa - ob;
    if (oa != null && ob == null) return -1;
    if (oa == null && ob != null) return 1;
    return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
  });
  const sortedIds = rows.map((r) => r.id);
  const routeOrder: Record<string, number> = {};
  sortedIds.forEach((id, idx) => {
    routeOrder[id] = idx + 1;
  });
  saveRouteEditorState(userId, dayId, def, sortedIds, scopedRows, routeOrder);
  return true;
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
  const prevEntry = state.routesByUser[userId]?.[key];
  const prev = prevEntry?.dealerIds ?? [];
  const prevOrder = { ...(prevEntry?.clientOrderByDealerId ?? {}) };
  const seen = new Set(prev);
  const next = [...prev];
  for (const id of dealerIds) {
    if (!seen.has(id)) {
      seen.add(id);
      next.push(id);
      const go = getDealerUnloadingOrder(id);
      if (prevOrder[id] === undefined && normalizeRouteClientOrder(go) != null) {
        prevOrder[id] = go as number;
      }
    }
  }
  const mergedOrder = filterClientOrderMapForDealerIds(prevOrder, next);
  if (mergedOrder) {
    setRouteDealerIds(userId, dayId, slotId, next, mergedOrder);
  } else {
    setRouteDealerIds(userId, dayId, slotId, next);
  }

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
  setRouteDealerIds(userId, dayId, slotId, next);

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
  let entry = state.routesByUser[userId]?.[key];
  let prev = [...(entry?.dealerIds ?? [])];
  if (prev.length === 0 && seed) {
    prev = computeDisplayedRouteDealerIds(userId, dayId, seed.def, seed.scopedRows, state);
    if (prev.length > 0) {
      setRouteDealerIds(userId, dayId, slotId, prev);
      state = migrateState(loadDealerRoutePlanState());
      entry = state.routesByUser[userId]?.[key];
      prev = [...(entry?.dealerIds ?? [])];
    }
  }
  const nameById = new Map((seed?.scopedRows ?? []).map((r) => [r.id, r.name]));
  const orderMap = entry?.clientOrderByDealerId;
  const hasExplicitOrder =
    orderMap &&
    Object.keys(orderMap).length > 0 &&
    prev.some((id) => normalizeRouteClientOrder(orderMap[id]) != null);

  if (!hasExplicitOrder) {
    const i = prev.indexOf(dealerId);
    if (i < 0) return;
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= prev.length) return;
    const next = [...prev];
    const t = next[i]!;
    next[i] = next[j]!;
    next[j] = t;
    setRouteDealerIds(userId, dayId, slotId, next);
    return;
  }

  const displayed = sortDealerIdsByRouteClientOrder(prev, orderMap, nameById);
  const i = displayed.indexOf(dealerId);
  if (i < 0) return;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= displayed.length) return;
  const swapDisplay = [...displayed];
  const t = swapDisplay[i]!;
  swapDisplay[i] = swapDisplay[j]!;
  swapDisplay[j] = t;
  const idI = displayed[i]!;
  const idJ = displayed[j]!;
  const mo: Record<string, number> = { ...orderMap };
  const nI = normalizeRouteClientOrder(mo[idI]);
  const nJ = normalizeRouteClientOrder(mo[idJ]);
  if (nI != null && nJ != null) {
    mo[idI] = nJ;
    mo[idJ] = nI;
  } else if (nI != null) {
    mo[idJ] = nI;
    delete mo[idI];
  } else if (nJ != null) {
    mo[idI] = nJ;
    delete mo[idJ];
  }
  setRouteDealerIds(userId, dayId, slotId, swapDisplay, mo);
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
