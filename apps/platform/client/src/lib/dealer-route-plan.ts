/**
 * Маршрутный лист по дню отгрузки (localStorage, без backend).
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { DealerShipmentDayId } from "@/lib/dealer-shipment-days";
import { DEALER_SHIPMENT_DAY_LABELS } from "@/lib/dealer-shipment-days";

export const DEALER_ROUTE_PLAN_STORAGE_KEY = "tandoor-dealer-route-plan-v1";
export const DEALER_ROUTE_PLAN_EVENT = "tandoor-dealer-route-plan-changed";

export type DealerRouteDayEntry = {
  dealerIds: string[];
  updatedAt: string;
};

export type DealerRoutePlanState = {
  routesByUser: Record<string, Record<string, DealerRouteDayEntry>>;
};

function emptyState(): DealerRoutePlanState {
  return { routesByUser: {} };
}

export function routePlanDayKey(dayId: DealerShipmentDayId): string {
  return `shipment:${dayId}`;
}

export function loadDealerRoutePlanState(): DealerRoutePlanState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(DEALER_ROUTE_PLAN_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<DealerRoutePlanState>;
    return {
      routesByUser: p.routesByUser && typeof p.routesByUser === "object" ? p.routesByUser : {},
    };
  } catch {
    return emptyState();
  }
}

export function saveDealerRoutePlanState(state: DealerRoutePlanState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(DEALER_ROUTE_PLAN_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(DEALER_ROUTE_PLAN_EVENT));
}

export function getRouteForUserDay(userId: string, dayId: DealerShipmentDayId, state = loadDealerRoutePlanState()): string[] {
  const key = routePlanDayKey(dayId);
  return [...(state.routesByUser[userId]?.[key]?.dealerIds ?? [])];
}

export function addDealersToRoute(userId: string, dayId: DealerShipmentDayId, dealerIds: string[]): void {
  if (!dealerIds.length) return;
  const state = loadDealerRoutePlanState();
  const key = routePlanDayKey(dayId);
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
  saveDealerRoutePlanState({ routesByUser });
}

export function removeDealerFromRoute(userId: string, dayId: DealerShipmentDayId, dealerId: string): void {
  const state = loadDealerRoutePlanState();
  const key = routePlanDayKey(dayId);
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
  saveDealerRoutePlanState({ routesByUser });
}

export function reorderRouteDealer(
  userId: string,
  dayId: DealerShipmentDayId,
  dealerId: string,
  direction: "up" | "down",
): void {
  const state = loadDealerRoutePlanState();
  const key = routePlanDayKey(dayId);
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
  saveDealerRoutePlanState({ routesByUser });
}

export function buildRouteCopyText(
  rows: DealerRow[],
  dayId: DealerShipmentDayId,
  buildDealerHref: (id: string) => string,
  statusLabel: (row: DealerRow) => string,
): string {
  const day = DEALER_SHIPMENT_DAY_LABELS[dayId];
  const lines: string[] = [`Маршрутный лист: ${day}`];
  rows.forEach((row, idx) => {
    const href = buildDealerHref(row.id);
    const st = statusLabel(row);
    lines.push(`${idx + 1}. ${row.name} — ${row.city} — ${st} — ${href}`);
  });
  return lines.join("\n");
}
