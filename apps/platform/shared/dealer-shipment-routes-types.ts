/**
 * Маршруты отгрузки (Postgres) — Промт 114.
 */

export type DealerShipmentRouteDayId =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export const DEALER_SHIPMENT_ROUTE_DAY_IDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const satisfies readonly DealerShipmentRouteDayId[];

export type DealerShipmentRouteRow = {
  id: string;
  userId: string;
  dayId: DealerShipmentRouteDayId;
  name: string;
  cities: string[];
  trashedAt: string | null;
  trashedBy: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export function parseShipmentRouteDayId(raw: unknown): DealerShipmentRouteDayId | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim() as DealerShipmentRouteDayId;
  return (DEALER_SHIPMENT_ROUTE_DAY_IDS as readonly string[]).includes(t) ? t : null;
}

export function mapDealerShipmentRouteRow(r: Record<string, unknown>): DealerShipmentRouteRow {
  const citiesRaw = r.cities;
  let cities: string[] = [];
  if (Array.isArray(citiesRaw)) {
    cities = citiesRaw.filter((c): c is string => typeof c === "string").map((c) => c.trim()).filter(Boolean);
  } else if (typeof citiesRaw === "string") {
    try {
      const parsed = JSON.parse(citiesRaw) as unknown;
      if (Array.isArray(parsed)) {
        cities = parsed.filter((c): c is string => typeof c === "string").map((c) => c.trim()).filter(Boolean);
      }
    } catch {
      cities = [];
    }
  }
  return {
    id: String(r.id),
    userId: String(r.user_id),
    dayId: parseShipmentRouteDayId(r.day_id) ?? "monday",
    name: typeof r.name === "string" ? r.name : "",
    cities,
    trashedAt: r.trashed_at != null ? String(r.trashed_at) : null,
    trashedBy: r.trashed_by != null ? String(r.trashed_by) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    updatedBy: r.updated_by != null ? String(r.updated_by) : null,
  };
}
