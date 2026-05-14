import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { isClientTopTier } from "@/lib/client-category";
import { dealerNeedsAttention, isDealerTop } from "@/lib/dealer-base-role-views";
import type { getManagersForRopTeam } from "@/lib/rop-manager-filters";
import { isRopOrManagerAllFilter, managerDisplayMatchesCatalogName } from "@/lib/rop-manager-filters";
import { isCoordinateConsistentWithAddress, tryResolveFallbackCoordinate } from "@/lib/client-map-location";
import { RELEASE_CLIENT_ADDRESS_COORDINATES } from "@/lib/release-client-address-coordinates.generated";

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

/** Маркер карты: только точные адресные координаты (релиз 1). */
export type ClientMapMarker = {
  id: string;
  lat: number;
  lng: number;
  dealer: DealerRow;
  style: ClientMapMarkerStyle;
  coordinateSource: "address";
};

export type ClientMapCoordinateBreakdown = {
  /** Клиенты в текущей выборке с валидной точкой по адресу из generated. */
  exactAddressInScope: number;
  /** Есть city-fallback, но нет точного адреса в данных — на карте не показываем. */
  byCityFallback: number;
  /** Нет ни адреса в данных, ни fallback. */
  missing: number;
};

export type ResolveDealerMapCoordinateResult =
  | { lat: number; lng: number; source: "address" }
  | { lat: number; lng: number; source: "city"; lookupKey: string }
  | { source: "missing" };

/** 1) координаты адреса из generated (с проверкой региона); 2) безопасный fallback по контексту (для списка/аналитики, не для карты). */
export function resolveDealerMapCoordinate(dealer: DealerRow): ResolveDealerMapCoordinateResult {
  const addr = RELEASE_CLIENT_ADDRESS_COORDINATES[dealer.id];
  if (addr && Number.isFinite(addr.lat) && Number.isFinite(addr.lng)) {
    if (!isCoordinateConsistentWithAddress(addr.lat, addr.lng, dealer)) {
      return { source: "missing" };
    }
    return { lat: addr.lat, lng: addr.lng, source: "address" };
  }
  const fb = tryResolveFallbackCoordinate(dealer);
  if (fb) return { lat: fb.lat, lng: fb.lng, source: "city", lookupKey: fb.lookupKey };
  return { source: "missing" };
}

export { buildLocationFallbackKey, buildLocationFallbackKeys, normalizeSettlementName } from "@/lib/client-map-location";
export { isCoordinateConsistentWithAddress } from "@/lib/client-map-location";

/** Подпись внутреннего источника (для отладки / не для карты релиза 1). */
export function coordinateSourceLabel(source: ClientMapCoordinateSource): string {
  if (source === "address") return "адрес";
  if (source === "city") return "город";
  return "нет координат";
}

/** Бейдж в списке клиентов: на карте только при точном адресе. */
export function clientMapListCoordinateBadgeText(source: ClientMapCoordinateSource): string {
  if (source === "address") return "на карте";
  return "нет точной координаты";
}

function jitterAddressGroupKey(lat: number, lng: number): string {
  return `a:${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export type ClientMapMarkerBundle = {
  /** Все клиенты текущей фильтрации (как передано). */
  allVisibleClients: DealerRow[];
  /** Только маркеры с точным адресом (с лимитом). */
  exactAddressMarkers: ClientMapMarker[];
  /** Клиенты без точной адресной координаты в данных (city fallback или missing). */
  clientsWithoutExactCoordinates: DealerRow[];
  breakdown: ClientMapCoordinateBreakdown;
  truncated: boolean;
};

/**
 * Разделение для /#/client-map: список — все отфильтрованные; маркеры — только exact address.
 * Лимит CLIENT_MAP_MAX_MARKERS применяется только к exactAddressMarkers.
 */
export function buildClientMapMarkerBundle(rows: DealerRow[], maxMarkers: number): ClientMapMarkerBundle {
  let exactAddressInScope = 0;
  let byCityFallback = 0;
  let missing = 0;
  const addressItems: { dealer: DealerRow; baseLat: number; baseLng: number }[] = [];
  const withoutExact: DealerRow[] = [];

  for (const dealer of rows) {
    const r = resolveDealerMapCoordinate(dealer);
    if (r.source === "address") {
      exactAddressInScope += 1;
      addressItems.push({ dealer, baseLat: r.lat, baseLng: r.lng });
    } else {
      if (r.source === "city") byCityFallback += 1;
      else missing += 1;
      withoutExact.push(dealer);
    }
  }

  const byKey = new Map<string, typeof addressItems>();
  for (const item of addressItems) {
    const k = jitterAddressGroupKey(item.baseLat, item.baseLng);
    const arr = byKey.get(k) ?? [];
    arr.push(item);
    byKey.set(k, arr);
  }

  const markers: ClientMapMarker[] = [];
  for (const [, arr] of Array.from(byKey.entries())) {
    const n = arr.length;
    arr.forEach((item, i) => {
      const radiusDeg = 0.00022 * (1 + Math.floor(i / 10));
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
        coordinateSource: "address",
      });
    });
  }

  const truncated = markers.length > maxMarkers;
  const exactAddressMarkers = truncated ? markers.slice(0, maxMarkers) : markers;
  const truncatedExactCount = truncated ? Math.max(0, markers.length - maxMarkers) : 0;

  const breakdown: ClientMapCoordinateBreakdown = {
    exactAddressInScope,
    byCityFallback,
    missing,
  };

  return {
    allVisibleClients: rows,
    exactAddressMarkers,
    clientsWithoutExactCoordinates: withoutExact,
    breakdown,
    truncated,
  };
}

export type ClientMapKpis = {
  total: number;
  /** Фактически отрисовано маркеров (после лимита). */
  onMap: number;
  withoutExactAddress: number;
  exactAddressInScope: number;
  active: number;
  attention: number;
};

export function computeClientMapKpis(
  filteredRows: DealerRow[],
  breakdown: ClientMapCoordinateBreakdown,
  visibleMarkerCount: number,
): ClientMapKpis {
  return {
    total: filteredRows.length,
    onMap: visibleMarkerCount,
    withoutExactAddress: breakdown.byCityFallback + breakdown.missing,
    exactAddressInScope: breakdown.exactAddressInScope,
    active: filteredRows.filter((r) => r.status === "активный").length,
    attention: filteredRows.filter(dealerNeedsAttention).length,
  };
}

export function listCoordinateSourceForDealer(dealer: DealerRow): ClientMapCoordinateSource {
  const r = resolveDealerMapCoordinate(dealer);
  return r.source === "missing" ? "missing" : r.source;
}
