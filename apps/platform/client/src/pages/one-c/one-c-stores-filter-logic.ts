import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import {
  ALL_EQUIPMENT_TYPES,
  type DistributionTradePointMetrics,
  type EquipmentTypeKey,
} from "@/lib/distribution-analytics/distribution-analytics-math";

export type MatrixFillFilter = "all" | "empty" | "partial" | "full";
export type SegmentPresenceFilter = "all" | "yes" | "no";

export type OneCStoresFilterState = {
  search: string;
  holdings: string[];
  clientTypes: string[];
  paymentForms: string[];
  regionalManagers: string[];
  managers: string[];
  statuses: string[];
  matrixFill: MatrixFillFilter;
  vhPresence: SegmentPresenceFilter;
  mkPresence: SegmentPresenceFilter;
  hwPresence: SegmentPresenceFilter;
  rotPresence: SegmentPresenceFilter;
};

export function emptyOneCStoresFilters(): OneCStoresFilterState {
  return {
    search: "",
    holdings: [],
    clientTypes: [],
    paymentForms: [],
    regionalManagers: [],
    managers: [],
    statuses: [],
    matrixFill: "all",
    vhPresence: "all",
    mkPresence: "all",
    hwPresence: "all",
    rotPresence: "all",
  };
}

export function tradePointLegacyOurs(metrics: DistributionTradePointMetrics): number {
  return ALL_EQUIPMENT_TYPES.reduce((sum, type) => sum + metrics.byType[type].legacyOurs, 0);
}

function normalizeSearchValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function matchesSearch(item: OneCStoreListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.address,
    item.manager_name,
    item.legal_name,
    item.legal_inn,
    item.legal_parent_name,
    item.legal_city,
    item.legal_client_type,
    item.legal_regional_manager_name,
    item.status,
  ]
    .map(normalizeSearchValue)
    .join(" ");
  return haystack.includes(q);
}

function matchesMulti(value: string | null | undefined, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const normalized = value?.trim() || "н/у";
  return selected.includes(normalized);
}

function segmentHasPresence(metrics: DistributionTradePointMetrics, type: EquipmentTypeKey): boolean {
  const row = metrics.byType[type];
  return (row.percent ?? 0) > 0 || row.tandoorOnShelf > 0;
}

function rotationHasPresence(metrics: DistributionTradePointMetrics): boolean {
  return tradePointLegacyOurs(metrics) > 0 || (metrics.rotationPotentialPercent ?? 0) > 0;
}

function matchesSegmentPresence(
  metrics: DistributionTradePointMetrics | undefined,
  filter: SegmentPresenceFilter,
  kind: "vh" | "mk" | "hw" | "rot",
): boolean {
  if (filter === "all") return true;
  if (!metrics) return filter === "no";

  const has =
    kind === "vh"
      ? segmentHasPresence(metrics, "entrance")
      : kind === "mk"
        ? segmentHasPresence(metrics, "interior")
        : kind === "hw"
          ? segmentHasPresence(metrics, "hardware")
          : rotationHasPresence(metrics);

  return filter === "yes" ? has : !has;
}

function matchesMatrixFill(item: OneCStoreListItem, filter: MatrixFillFilter): boolean {
  if (filter === "all") return true;
  const { distribution_filled: filled, distribution_total: total } = item;
  if (filter === "empty") return total === 0 || filled === 0;
  if (filter === "partial") return total > 0 && filled > 0 && filled < total;
  return total > 0 && filled >= total;
}

export function hasActiveOneCStoresFilters(
  filters: OneCStoresFilterState,
  options?: { skipSearch?: boolean },
): boolean {
  if (!options?.skipSearch && filters.search.trim()) return true;
  return (
    filters.holdings.length > 0 ||
    filters.clientTypes.length > 0 ||
    filters.paymentForms.length > 0 ||
    filters.regionalManagers.length > 0 ||
    filters.managers.length > 0 ||
    filters.statuses.length > 0 ||
    filters.matrixFill !== "all" ||
    filters.vhPresence !== "all" ||
    filters.mkPresence !== "all" ||
    filters.hwPresence !== "all" ||
    filters.rotPresence !== "all"
  );
}

export function uniqueStoreFilterOptions(
  items: OneCStoreListItem[],
  pick: (item: OneCStoreListItem) => string | null | undefined,
): { value: string; label: string }[] {
  const values = new Set<string>();
  for (const item of items) {
    const raw = pick(item)?.trim();
    if (raw) values.add(raw);
  }
  return Array.from(values)
    .sort((a, b) => a.localeCompare(b, "ru"))
    .map((value) => ({ value, label: value }));
}

export function applyOneCStoresFilters(
  items: OneCStoreListItem[],
  filters: OneCStoresFilterState,
  distAggregates: Map<string, DistributionTradePointMetrics>,
  options?: { skipSearch?: boolean },
): OneCStoreListItem[] {
  return items.filter((item) => {
    if (!options?.skipSearch && !matchesSearch(item, filters.search)) return false;
    if (!matchesMulti(item.legal_parent_name, filters.holdings)) return false;
    if (!matchesMulti(item.legal_client_type, filters.clientTypes)) return false;
    if (!matchesMulti(item.legal_payment_form, filters.paymentForms)) return false;
    if (!matchesMulti(item.legal_regional_manager_name, filters.regionalManagers)) return false;
    if (!matchesMulti(item.manager_name, filters.managers)) return false;
    if (!matchesMulti(item.status, filters.statuses)) return false;
    if (!matchesMatrixFill(item, filters.matrixFill)) return false;

    const metrics = distAggregates.get(item.id_1c);
    if (!matchesSegmentPresence(metrics, filters.vhPresence, "vh")) return false;
    if (!matchesSegmentPresence(metrics, filters.mkPresence, "mk")) return false;
    if (!matchesSegmentPresence(metrics, filters.hwPresence, "hw")) return false;
    if (!matchesSegmentPresence(metrics, filters.rotPresence, "rot")) return false;

    return true;
  });
}
