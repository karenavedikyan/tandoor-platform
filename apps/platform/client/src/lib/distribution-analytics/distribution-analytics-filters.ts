import type { ActualizationState } from "../client-base-actualization-state.js";
import { normalizeHasShowcase } from "../client-base-actualization-state.js";
import type { ClientCategoryId } from "../client-category.js";
import { getRopOverrideUserId, loadDealerRopOverridesState } from "../dealer-rop-overrides.js";
import type { TradePointListRow } from "../trade-point-list-for-actualization.js";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";
import type { ShowcaseTypeKey } from "../showcase-type-capacity.js";
import { getShowcaseTypeCapacity } from "../showcase-type-capacity.js";
import type { EquipmentTypeKey } from "./distribution-analytics-math";
import { isModelInstalledInEntries } from "./distribution-analytics-math";

export type DistributionAnalyticsFilters = {
  cities: string[];
  regions: string[];
  dealerIds: string[];
  tradePointIds: string[];
  managerIds: string[];
  regionalManagerIds: string[];
  ropIds: string[];
  clientCategories: ClientCategoryId[];
  equipmentTypes: EquipmentTypeKey[];
  modelIds: string[];
};

export const DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD = 2500;

export function hasAnyDistributionAnalyticsFilters(filters: DistributionAnalyticsFilters): boolean {
  return (
    filters.cities.length > 0 ||
    filters.regions.length > 0 ||
    filters.dealerIds.length > 0 ||
    filters.tradePointIds.length > 0 ||
    filters.managerIds.length > 0 ||
    filters.regionalManagerIds.length > 0 ||
    filters.ropIds.length > 0 ||
    filters.clientCategories.length > 0 ||
    filters.equipmentTypes.length > 0 ||
    filters.modelIds.length > 0
  );
}

export function emptyDistributionAnalyticsFilters(): DistributionAnalyticsFilters {
  return {
    cities: [],
    regions: [],
    dealerIds: [],
    tradePointIds: [],
    managerIds: [],
    regionalManagerIds: [],
    ropIds: [],
    clientCategories: [],
    equipmentTypes: [],
    modelIds: [],
  };
}

function toBase64Url(json: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(encoded: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(encoded, "base64url").toString("utf8");
  }
  const pad = encoded.length % 4 === 0 ? "" : "=".repeat(4 - (encoded.length % 4));
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function serializeFilters(f: DistributionAnalyticsFilters): string {
  return toBase64Url(JSON.stringify(f));
}

export function deserializeFilters(s: string | null | undefined): DistributionAnalyticsFilters {
  if (!s?.trim()) return emptyDistributionAnalyticsFilters();
  try {
    const raw = JSON.parse(fromBase64Url(s.trim())) as Partial<DistributionAnalyticsFilters>;
    const empty = emptyDistributionAnalyticsFilters();
    return {
      cities: Array.isArray(raw.cities) ? raw.cities.filter((x): x is string => typeof x === "string") : empty.cities,
      regions: Array.isArray(raw.regions) ? raw.regions.filter((x): x is string => typeof x === "string") : empty.regions,
      dealerIds: Array.isArray(raw.dealerIds) ? raw.dealerIds.filter((x): x is string => typeof x === "string") : empty.dealerIds,
      tradePointIds: Array.isArray(raw.tradePointIds)
        ? raw.tradePointIds.filter((x): x is string => typeof x === "string")
        : empty.tradePointIds,
      managerIds: Array.isArray(raw.managerIds) ? raw.managerIds.filter((x): x is string => typeof x === "string") : empty.managerIds,
      regionalManagerIds: Array.isArray(raw.regionalManagerIds)
        ? raw.regionalManagerIds.filter((x): x is string => typeof x === "string")
        : empty.regionalManagerIds,
      ropIds: Array.isArray(raw.ropIds) ? raw.ropIds.filter((x): x is string => typeof x === "string") : empty.ropIds,
      clientCategories: Array.isArray(raw.clientCategories)
        ? raw.clientCategories.filter((x): x is ClientCategoryId => typeof x === "string")
        : empty.clientCategories,
      equipmentTypes: Array.isArray(raw.equipmentTypes)
        ? raw.equipmentTypes.filter((x): x is EquipmentTypeKey => x === "entrance" || x === "interior" || x === "hardware")
        : empty.equipmentTypes,
      modelIds: Array.isArray(raw.modelIds) ? raw.modelIds.filter((x): x is string => typeof x === "string") : empty.modelIds,
    };
  } catch {
    return emptyDistributionAnalyticsFilters();
  }
}

export function resolveRegionForRow(row: TradePointListRow): string {
  const region = row.dealer.region?.trim();
  if (region) return region;
  // TODO: region grouping когда появится отдельное поле в данных ТТ
  return "Все города";
}

export function resolveDealerResponsibleIds(
  act: ActualizationState,
  dealerId: string,
): { managerKey: string; regionalManagerId: string | null; ropId: string | null } {
  const fields = (act.dealerOverridesById[dealerId]?.fields ?? {}) as Record<string, unknown>;
  const regionalManagerId = typeof fields.regional_manager_id === "string" ? fields.regional_manager_id : null;
  const ropId = typeof fields.rop_id === "string" ? fields.rop_id : null;
  const managerKey =
    typeof fields.manager_user_id === "string"
      ? fields.manager_user_id
      : typeof fields.responsible_user_id === "string"
        ? fields.responsible_user_id
        : "";
  return { managerKey, regionalManagerId, ropId };
}

function matchesMulti(values: string[], candidate: string): boolean {
  if (values.length === 0) return true;
  return values.includes(candidate);
}

function matchesCategoryFilter(category: ClientCategoryId, filters: ClientCategoryId[]): boolean {
  if (filters.length === 0) return true;
  return filters.includes(category);
}

function rowHasEquipmentCapacity(
  sh: ActualizationState["tradePointShowcaseActualizationById"][string] | undefined,
  types: EquipmentTypeKey[],
): boolean {
  if (types.length === 0) return true;
  if (!sh || !normalizeHasShowcase(sh.hasShowcase)) return false;
  return types.some((type) => {
    const cap = getShowcaseTypeCapacity(sh, type);
    return cap != null && cap > 0;
  });
}

/** Применить фильтры к списку TradePointListRow. */
export function applyDistributionAnalyticsFilters(
  rows: TradePointListRow[],
  filters: DistributionAnalyticsFilters,
  shByTradePointId: Record<string, ActualizationState["tradePointShowcaseActualizationById"][string] | undefined>,
  act: ActualizationState,
  installedEntriesByTradePointId: Record<string, readonly ShowcaseMatrixEntryDto[] | undefined>,
): TradePointListRow[] {
  const ropOverridesState = loadDealerRopOverridesState();
  return rows.filter((row) => {
    if (filters.cities.length > 0 && !filters.cities.includes(row.city)) return false;
    if (filters.regions.length > 0 && !filters.regions.includes(resolveRegionForRow(row))) return false;
    if (filters.dealerIds.length > 0 && !filters.dealerIds.includes(row.dealerId)) return false;
    if (filters.tradePointIds.length > 0 && !filters.tradePointIds.includes(row.tradePointId)) return false;
    if (!matchesCategoryFilter(row.clientCategory, filters.clientCategories)) return false;

    const ids = resolveDealerResponsibleIds(act, row.dealerId);
    if (filters.managerIds.length > 0) {
      const managerMatch =
        (ids.managerKey && filters.managerIds.includes(ids.managerKey)) ||
        filters.managerIds.includes(row.manager) ||
        filters.managerIds.includes(`mgr:${row.manager}`);
      if (!managerMatch) return false;
    }
    if (filters.regionalManagerIds.length > 0) {
      const rmMatch =
        (ids.regionalManagerId && filters.regionalManagerIds.includes(ids.regionalManagerId)) ||
        filters.regionalManagerIds.includes(row.regionalManager) ||
        filters.regionalManagerIds.includes(`rm:${row.regionalManager}`);
      if (!rmMatch) return false;
    }
    if (filters.ropIds.length > 0) {
      const dealerRopId = getRopOverrideUserId(row.dealerId, ropOverridesState);
      const oneCDealerRopId = row.dealer.ropId ?? null;
      const ropMatch =
        (dealerRopId != null && filters.ropIds.includes(dealerRopId)) ||
        (ids.ropId != null && filters.ropIds.includes(ids.ropId)) ||
        (oneCDealerRopId != null && filters.ropIds.includes(oneCDealerRopId)) ||
        filters.ropIds.includes(row.rop);
      if (!ropMatch) return false;
    }

    const sh = shByTradePointId[row.tradePointId];
    if (!rowHasEquipmentCapacity(sh, filters.equipmentTypes)) return false;

    if (filters.modelIds.length > 0) {
      const entries = installedEntriesByTradePointId[row.tradePointId];
      if (!filters.modelIds.some((id) => isModelInstalledInEntries(entries, id))) return false;
    }

    return true;
  });
}
