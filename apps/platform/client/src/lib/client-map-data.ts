import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { dealerNeedsAttention, isDealerTop } from "@/lib/dealer-base-role-views";
import type { getManagersForRopTeam } from "@/lib/rop-manager-filters";
import { isRopOrManagerAllFilter, managerDisplayMatchesCatalogName } from "@/lib/rop-manager-filters";
import { getCityLatLng } from "@/lib/russian-city-coordinates";

export const CLIENT_MAP_MAX_MARKERS = 1000;
export const CLIENT_MAP_LIST_LIMIT = 20;
export const CLIENT_MAP_LIST_MAX = 100;

export type ClientMapQuickFilter = "all" | "active" | "potential" | "attention" | "top" | "no_activity";

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
      return row.category === "TOP";
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
};

/** Группировка по городу + лёгкий jitter вокруг центра. */
export function buildClientMapMarkers(rows: DealerRow[], maxMarkers: number): {
  markers: ClientMapMarker[];
  withCoords: number;
  missingCoords: number;
  truncated: boolean;
} {
  const withBase: { dealer: DealerRow; baseLat: number; baseLng: number }[] = [];
  let missing = 0;
  for (const dealer of rows) {
    const c = getCityLatLng(dealer.city);
    if (!c) {
      missing += 1;
      continue;
    }
    withBase.push({ dealer, baseLat: c.lat, baseLng: c.lng });
  }
  const byCity = new Map<string, typeof withBase>();
  for (const item of withBase) {
    const k = item.dealer.city.trim() || "—";
    const arr = byCity.get(k) ?? [];
    arr.push(item);
    byCity.set(k, arr);
  }
  const markers: ClientMapMarker[] = [];
  for (const [, arr] of Array.from(byCity.entries())) {
    const n = arr.length;
    arr.forEach((item: { dealer: DealerRow; baseLat: number; baseLng: number }, i: number) => {
      const angle = (2 * Math.PI * i) / Math.max(n, 1);
      const radiusDeg = 0.0016 * (1 + Math.floor(i / 12));
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
      });
    });
  }
  const truncated = markers.length > maxMarkers;
  const sliced = truncated ? markers.slice(0, maxMarkers) : markers;
  return {
    markers: sliced,
    withCoords: withBase.length,
    missingCoords: missing,
    truncated,
  };
}

export type ClientMapKpis = {
  total: number;
  onMap: number;
  missingCoords: number;
  active: number;
  attention: number;
};

export function computeClientMapKpis(filteredRows: DealerRow[], withCoords: number, missingCoords: number): ClientMapKpis {
  return {
    total: filteredRows.length,
    onMap: withCoords,
    missingCoords,
    active: filteredRows.filter((r) => r.status === "активный").length,
    attention: filteredRows.filter(dealerNeedsAttention).length,
  };
}
