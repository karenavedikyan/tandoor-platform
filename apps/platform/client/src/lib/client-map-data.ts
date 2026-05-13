import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { isClientTopTier } from "@/lib/client-category";
import { dealerNeedsAttention, isDealerTop } from "@/lib/dealer-base-role-views";
import type { getManagersForRopTeam } from "@/lib/rop-manager-filters";
import { isRopOrManagerAllFilter, managerDisplayMatchesCatalogName } from "@/lib/rop-manager-filters";
import { RELEASE_CLIENT_ADDRESS_COORDINATES } from "@/lib/release-client-address-coordinates.generated";
import { getCityLatLng } from "@/lib/russian-city-coordinates";

export const CLIENT_MAP_MAX_MARKERS = 1000;
export const CLIENT_MAP_LIST_LIMIT = 20;
export const CLIENT_MAP_LIST_MAX = 100;

export type ClientMapQuickFilter = "all" | "active" | "potential" | "attention" | "top" | "no_activity";

export type ClientMapCoordinateSource = "address" | "city" | "missing";

export type ClientMapPickerArgs = {
  search: string;
  quick: ClientMapQuickFilter;
  city: string;
  ropTeam: string;
  manager: string;
  managerCatalogForRop: ReturnType<typeof getManagersForRopTeam>;
};

function applyQuickFilter(row: DealerRow, q: ClientMapQuickFilter): boolean {
  switch (q) {
    case "all":
      return true;
    case "active":
      return row.status === "активный";
    case "potential":
      return row.status === "потенциальный";
    case "attention":
      return row.status === "требует внимания" || row.hasProblem;
    case "top":
      return isClientTopTier(row.clientCategory);
    case "no_activity":
      return !row.hasRecentActivity;
    default:
      return true;
  }
}

export function filterClientMapRows(rows: DealerRow[], args: ClientMapPickerArgs): DealerRow[] {
  const q = args.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (!applyQuickFilter(row, args.quick)) return false;
    if (args.city !== "all" && row.city !== args.city) return false;
    if (!isRopOrManagerAllFilter(args.ropTeam)) {
      if (row.releaseTeamId !== args.ropTeam) return false;
    }
    if (!isRopOrManagerAllFilter(args.manager)) {
      let mgrOk = row.releaseManagerId === args.manager;
      if (!mgrOk) {
        const cat = args.managerCatalogForRop.find((m) => m.id === args.manager);
        mgrOk = Boolean(cat && managerDisplayMatchesCatalogName(row.manager, cat.name));
      }
      if (!mgrOk) return false;
    }
    if (!q) return true;
    const hay = [
      row.name,
      row.city,
      row.manager,
      row.regionalManager,
      row.releaseCode ?? "",
      row.releaseAddress ?? "",
      row.clientTypeLabel ?? "",
      row.id,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export type ClientMapMarkerStyle = {
  fill: string;
  stroke: string;
  radius: number;
};

export function markerStyleForDealer(row: DealerRow): ClientMapMarkerStyle {
  const top = isDealerTop(row);
  const r = top ? 9 : 7;
  if (dealerNeedsAttention(row)) {
    return { fill: "#f97316", stroke: "#c2410c", radius: r };
  }
  if (row.status === "активный") {
    return { fill: "#14b8a6", stroke: "#0f766e", radius: r };
  }
  if (row.status === "потенциальный") {
    return { fill: "#3b82f6", stroke: "#1d4ed8", radius: r };
  }
  return { fill: "#94a3b8", stroke: "#475569", radius: r };
}

export type ClientMapMarker = {
  id: string;
  lat: number;
  lng: number;
  dealer: DealerRow;
  style: ClientMapMarkerStyle;
  coordinateSource: "address" | "city";
};

export type ClientMapCoordinateBreakdown = {
  byAddress: number;
  byCity: number;
  missing: number;
};

/** 1) координаты адреса из generated; 2) проверенный центр города; иначе missing. */
export function resolveDealerMapCoordinate(
  dealer: DealerRow,
): { lat: number; lng: number; source: "address" | "city" } | { source: "missing" } {
  const addr = RELEASE_CLIENT_ADDRESS_COORDINATES[dealer.id];
  if (addr && Number.isFinite(addr.lat) && Number.isFinite(addr.lng)) {
    return { lat: addr.lat, lng: addr.lng, source: "address" };
  }
  const cg = getCityLatLng(dealer.city);
  if (cg) return { lat: cg.lat, lng: cg.lng, source: "city" };
  return { source: "missing" };
}

export function coordinateSourceLabel(source: ClientMapCoordinateSource): string {
  if (source === "address") return "адрес";
  if (source === "city") return "город";
  return "нет координат";
}

function jitterGroupKey(resolved: { lat: number; lng: number; source: "address" | "city" }, dealer: DealerRow): string {
  if (resolved.source === "address") {
    return `a:${resolved.lat.toFixed(5)},${resolved.lng.toFixed(5)}`;
  }
  return `c:${dealer.city.trim() || "—"}`;
}

export function buildClientMapMarkers(rows: DealerRow[], maxMarkers: number): {
  markers: ClientMapMarker[];
  breakdown: ClientMapCoordinateBreakdown;
  truncated: boolean;
} {
  const breakdown: ClientMapCoordinateBreakdown = { byAddress: 0, byCity: 0, missing: 0 };
  const withBase: { dealer: DealerRow; baseLat: number; baseLng: number; coordinateSource: "address" | "city" }[] = [];

  for (const dealer of rows) {
    const r = resolveDealerMapCoordinate(dealer);
    if (r.source === "missing") {
      breakdown.missing += 1;
      continue;
    }
    if (r.source === "address") breakdown.byAddress += 1;
    else breakdown.byCity += 1;
    withBase.push({ dealer, baseLat: r.lat, baseLng: r.lng, coordinateSource: r.source });
  }

  const byKey = new Map<string, typeof withBase>();
  for (const item of withBase) {
    const r = { lat: item.baseLat, lng: item.baseLng, source: item.coordinateSource };
    const k = jitterGroupKey(r, item.dealer);
    const arr = byKey.get(k) ?? [];
    arr.push(item);
    byKey.set(k, arr);
  }

  const markers: ClientMapMarker[] = [];
  for (const [, arr] of Array.from(byKey.entries())) {
    const n = arr.length;
    arr.forEach((item, i) => {
      const isAddr = item.coordinateSource === "address";
      const radiusDeg = isAddr ? 0.00022 * (1 + Math.floor(i / 10)) : 0.0016 * (1 + Math.floor(i / 12));
      const angle = (2 * Math.PI * i) / Math.max(n, 1);
      const lat = item.baseLat + radiusDeg * Math.cos(angle);
      const lng =
        item.baseLng +
        (radiusDeg * Math.sin(angle)) / Math.max(Math.cos((item.baseLat * Math.PI) / 180), 0.35);
      markers.push({
        id: item.dealer.id,
        lat,
        lng,
        dealer: item.dealer,
        style: markerStyleForDealer(item.dealer),
        coordinateSource: item.coordinateSource,
      });
    });
  }

  const truncated = markers.length > maxMarkers;
  const sliced = truncated ? markers.slice(0, maxMarkers) : markers;
  return { markers: sliced, breakdown, truncated };
}

export type ClientMapKpis = {
  total: number;
  onMap: number;
  byAddress: number;
  byCity: number;
  missingCoords: number;
  active: number;
  attention: number;
};

export function computeClientMapKpis(filteredRows: DealerRow[], breakdown: ClientMapCoordinateBreakdown): ClientMapKpis {
  return {
    total: filteredRows.length,
    onMap: breakdown.byAddress + breakdown.byCity,
    byAddress: breakdown.byAddress,
    byCity: breakdown.byCity,
    missingCoords: breakdown.missing,
    active: filteredRows.filter((r) => r.status === "активный").length,
    attention: filteredRows.filter(dealerNeedsAttention).length,
  };
}

export function listCoordinateSourceForDealer(dealer: DealerRow): ClientMapCoordinateSource {
  const r = resolveDealerMapCoordinate(dealer);
  return r.source === "missing" ? "missing" : r.source;
}
