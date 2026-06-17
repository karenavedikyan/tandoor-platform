/**
 * HTTP API маршрутов отгрузки (Postgres) — Промт 114.
 */

import type { DealerShipmentDayId } from "./dealer-shipment-days.js";
import type { DealerShipmentRouteDefinition } from "./dealer-shipment-route-definitions.js";

export const SHIPMENT_ROUTES_BACKFILL_DONE_PREFIX = "tandoor-shipment-routes-backfill-done-v1-";

export type ShipmentRouteDto = {
  id: string;
  userId: string;
  dayId: DealerShipmentDayId;
  name: string;
  cities: string[];
  updatedAt: string;
  updatedBy: string | null;
};

type ApiOk<T> = { success: true } & T;
type ApiErr = { success: false; code?: string; message?: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export function dtoToLocalRoute(d: ShipmentRouteDto): DealerShipmentRouteDefinition {
  return {
    id: d.id,
    name: d.name,
    cities: d.cities,
    updatedAt: d.updatedAt,
    updatedBy: d.updatedBy ?? d.userId,
  };
}

export async function fetchShipmentRoutesList(
  authUserId: string,
): Promise<{ userId: string; items: ShipmentRouteDto[] } | null> {
  try {
    const res = await fetch(`/api/dealer-shipment-routes/list?userId=${encodeURIComponent(authUserId)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<{ userId: string; items: ShipmentRouteDto[] }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return { userId: data.userId, items: data.items };
  } catch {
    return null;
  }
}

export async function apiUpsertShipmentRoute(body: {
  id?: string;
  userId: string;
  dayId: DealerShipmentDayId;
  name: string;
  cities: string[];
}): Promise<{ ok: boolean; item?: ShipmentRouteDto; code?: string }> {
  try {
    const res = await fetch("/api/dealer-shipment-routes/upsert", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseJson<ApiOk<{ item: ShipmentRouteDto }> | ApiErr>(res);
    if (!res.ok || !data.success) {
      return { ok: false, code: "code" in data ? data.code : undefined };
    }
    return { ok: true, item: data.item };
  } catch {
    return { ok: false };
  }
}

export async function apiDeleteShipmentRoute(body: {
  id: string;
  userId: string;
  deletedBy: string;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/dealer-shipment-routes/delete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseJson<ApiOk<unknown> | ApiErr>(res);
    return res.ok && data.success;
  } catch {
    return false;
  }
}

export async function apiBulkImportShipmentRoutes(
  userId: string,
  items: {
    id: string;
    dayId: DealerShipmentDayId;
    name: string;
    cities: string[];
    updatedAt?: string;
    updatedBy?: string;
  }[],
): Promise<{ ok: boolean; items?: ShipmentRouteDto[] }> {
  try {
    const res = await fetch("/api/dealer-shipment-routes/bulk-import", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, items }),
    });
    const data = await parseJson<ApiOk<{ items: ShipmentRouteDto[] }> | ApiErr>(res);
    if (!res.ok || !data.success) return { ok: false };
    return { ok: true, items: data.items };
  } catch {
    return { ok: false };
  }
}
