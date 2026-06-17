/**
 * Фильтры раздела «Дистрибуция» (чистый view-model, без сервера).
 */

import type { ClientCategoryId } from "./client-category.js";
import { CLIENT_CATEGORY_META, getClientCategoryLabel } from "./client-category.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import { getMergedDealerTradePoints } from "./dealer-trade-points-overrides.js";
import type { ShowcaseMatrixEntryDto, ShowcaseMatrixStatus, ShowcasePlacementType } from "./showcase-matrix-api.js";
import { PLACEMENT_TYPE_LABEL_RU } from "./showcase-placement-labels.js";
import type { ShowcaseMatrixModelDefinition } from "./trade-point-showcase-matrix-models.js";
import { statusLabelRu } from "./trade-point-showcase-matrix-storage.js";

export type DistributionPeriodKind = "all" | "last7" | "last30" | "last90" | "custom";

export type DistributionSegmentFilter = "all" | "vh" | "mk" | "furniture";

export type DistributionClientCategoryFilter = "all" | ClientCategoryId;

export type DistributionFilterState = {
  period: {
    kind: DistributionPeriodKind;
    fromIso?: string | null;
    toIso?: string | null;
  };
  segment: DistributionSegmentFilter;
  clientCategory: DistributionClientCategoryFilter;
  region: string | "all";
  city: string | "all";
  placementType: "all" | ShowcasePlacementType;
  status: "all" | ShowcaseMatrixStatus;
};

export type DistributionAnalyticsFilterContext = {
  period: { fromIso: string | null; toIso: string | null };
  segment: DistributionSegmentFilter;
  placementType: "all" | ShowcasePlacementType;
  status: "all" | ShowcaseMatrixStatus;
};

const MS_PER_DAY = 86_400_000;

export function defaultDistributionFilterState(): DistributionFilterState {
  return {
    period: { kind: "all", fromIso: null, toIso: null },
    segment: "all",
    clientCategory: "all",
    region: "all",
    city: "all",
    placementType: "all",
    status: "all",
  };
}

export type DistributionFilterScope = {
  hideRegion: boolean;
};

export function sanitizeDistributionFilterForScope(
  state: DistributionFilterState,
  scope: DistributionFilterScope,
): DistributionFilterState {
  if (scope.hideRegion && state.region !== "all") {
    return { ...state, region: "all" };
  }
  return state;
}

export function periodWindowIso(
  period: DistributionFilterState["period"],
  now: number = Date.now(),
): { fromIso: string | null; toIso: string | null } {
  if (period.kind === "all") {
    return { fromIso: null, toIso: null };
  }
  if (period.kind === "custom") {
    return {
      fromIso: period.fromIso?.trim() || null,
      toIso: period.toIso?.trim() || null,
    };
  }
  const days = period.kind === "last7" ? 7 : period.kind === "last30" ? 30 : 90;
  const from = new Date(now - days * MS_PER_DAY);
  return { fromIso: from.toISOString(), toIso: new Date(now).toISOString() };
}

export function buildAnalyticsFilterContext(
  filter: DistributionFilterState,
  now?: number,
): DistributionAnalyticsFilterContext {
  const window = periodWindowIso(filter.period, now);
  return {
    period: window,
    segment: filter.segment,
    placementType: filter.placementType,
    status: filter.status,
  };
}

function normalizeGeoValue(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v || v === "—" || v === "-") return null;
  return v;
}

export function filterScopeDealers(
  dealers: readonly DealerRow[],
  filter: DistributionFilterState,
): DealerRow[] {
  return dealers.filter((dealer) => {
    if (filter.clientCategory !== "all" && dealer.clientCategory !== filter.clientCategory) {
      return false;
    }
    if (filter.region !== "all") {
      const region = normalizeGeoValue(dealer.region);
      if (region !== filter.region) return false;
    }
    if (filter.city !== "all") {
      const dealerCity = normalizeGeoValue(dealer.city);
      if (dealerCity === filter.city) return true;
      const hasTpCity = getMergedDealerTradePoints(dealer, { includeArchived: false }).some(
        ({ point }) => normalizeGeoValue(point.city) === filter.city,
      );
      if (!hasTpCity) return false;
    }
    return true;
  });
}

export function extractRegionOptions(dealers: readonly DealerRow[]): string[] {
  const set = new Set<string>();
  for (const dealer of dealers) {
    const r = normalizeGeoValue(dealer.region);
    if (r) set.add(r);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
}

export function extractCityOptions(dealers: readonly DealerRow[]): string[] {
  const set = new Set<string>();
  for (const dealer of dealers) {
    const c = normalizeGeoValue(dealer.city);
    if (c) set.add(c);
    for (const { point } of getMergedDealerTradePoints(dealer, { includeArchived: false })) {
      const pc = normalizeGeoValue(point.city);
      if (pc) set.add(pc);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
}

export function modelMatchesSegment(
  model: ShowcaseMatrixModelDefinition,
  segment: DistributionSegmentFilter,
): boolean {
  if (segment === "all") return true;
  if (segment === "vh") return model.type === "entrance";
  if (segment === "mk") return model.type === "interior";
  return false;
}

export function entryMatchesSegment(
  entry: ShowcaseMatrixEntryDto,
  segment: DistributionSegmentFilter,
): boolean {
  if (segment === "all") return true;
  if (segment === "furniture") {
    return entry.placementSegment === "hardware";
  }
  if (entry.targetKind === "placement") {
    return entry.placementSegment === segment;
  }
  return true;
}

function entryInPeriod(
  entry: ShowcaseMatrixEntryDto,
  fromIso: string | null,
  toIso: string | null,
): boolean {
  if (!fromIso && !toIso) return true;
  const t = entry.updatedAt?.trim();
  if (!t) return false;
  if (fromIso && t < fromIso) return false;
  if (toIso && t > toIso) return false;
  return true;
}

export function filterMatrixEntries(
  entries: readonly ShowcaseMatrixEntryDto[],
  filter: DistributionAnalyticsFilterContext,
  planTargetIds: ReadonlySet<string>,
): ShowcaseMatrixEntryDto[] {
  return entries.filter((entry) => {
    if (!entryInPeriod(entry, filter.period.fromIso, filter.period.toIso)) return false;
    if (filter.status !== "all" && entry.status !== filter.status) return false;
    if (filter.placementType !== "all") {
      if (entry.targetKind !== "placement" || entry.placementType !== filter.placementType) {
        return false;
      }
    }
    if (!entryMatchesSegment(entry, filter.segment)) return false;
    if (entry.targetKind === "model" || entry.targetKind === "variant") {
      if (filter.segment === "furniture") return false;
      if (!planTargetIds.has(entry.targetId)) return false;
    }
    return true;
  });
}

export const DISTRIBUTION_PERIOD_OPTIONS: { value: DistributionPeriodKind; label: string }[] = [
  { value: "all", label: "Весь период" },
  { value: "last7", label: "7 дней" },
  { value: "last30", label: "30 дней" },
  { value: "last90", label: "90 дней" },
];

export const DISTRIBUTION_SEGMENT_OPTIONS: { value: DistributionSegmentFilter; label: string }[] = [
  { value: "all", label: "Все сегменты" },
  { value: "vh", label: "ВХ" },
  { value: "mk", label: "МК" },
  { value: "furniture", label: "Фурнитура" },
];

export function getDistributionClientCategoryOptions(): {
  value: DistributionClientCategoryFilter;
  label: string;
}[] {
  return [
    { value: "all", label: "Все категории" },
    ...CLIENT_CATEGORY_META.map((m) => ({ value: m.id as ClientCategoryId, label: m.label })),
  ];
}

export function getDistributionPlacementTypeOptions(): {
  value: DistributionFilterState["placementType"];
  label: string;
}[] {
  return [
    { value: "all", label: "Все типы" },
    ...(Object.keys(PLACEMENT_TYPE_LABEL_RU) as ShowcasePlacementType[]).map((type) => ({
      value: type,
      label: PLACEMENT_TYPE_LABEL_RU[type],
    })),
  ];
}

export const DISTRIBUTION_STATUS_OPTIONS: { value: ShowcaseMatrixStatus | "all"; label: string }[] = [
  { value: "all", label: "Все статусы" },
  { value: "need_install", label: statusLabelRu("need_install") },
  { value: "installed", label: statusLabelRu("installed") },
  { value: "postponed", label: statusLabelRu("postponed") },
  { value: "not_relevant", label: statusLabelRu("not_relevant") },
];

export type ActiveDistributionFilterChip = {
  id: string;
  label: string;
  clear: (state: DistributionFilterState) => DistributionFilterState;
};

export function listActiveDistributionFilterChips(
  filter: DistributionFilterState,
): ActiveDistributionFilterChip[] {
  const chips: ActiveDistributionFilterChip[] = [];
  if (filter.period.kind !== "all") {
    const label =
      DISTRIBUTION_PERIOD_OPTIONS.find((o) => o.value === filter.period.kind)?.label ?? filter.period.kind;
    chips.push({
      id: "period",
      label: `Период: ${label}`,
      clear: (s) => ({ ...s, period: { kind: "all", fromIso: null, toIso: null } }),
    });
  }
  if (filter.segment !== "all") {
    const label = DISTRIBUTION_SEGMENT_OPTIONS.find((o) => o.value === filter.segment)?.label ?? filter.segment;
    chips.push({
      id: "segment",
      label: `Сегмент: ${label}`,
      clear: (s) => ({ ...s, segment: "all" }),
    });
  }
  if (filter.clientCategory !== "all") {
    chips.push({
      id: "clientCategory",
      label: `Категория: ${getClientCategoryLabel(filter.clientCategory)}`,
      clear: (s) => ({ ...s, clientCategory: "all" }),
    });
  }
  if (filter.region !== "all") {
    chips.push({
      id: "region",
      label: `Регион: ${filter.region}`,
      clear: (s) => ({ ...s, region: "all" }),
    });
  }
  if (filter.city !== "all") {
    chips.push({
      id: "city",
      label: `Город: ${filter.city}`,
      clear: (s) => ({ ...s, city: "all" }),
    });
  }
  if (filter.placementType !== "all") {
    chips.push({
      id: "placementType",
      label: `Размещение: ${PLACEMENT_TYPE_LABEL_RU[filter.placementType]}`,
      clear: (s) => ({ ...s, placementType: "all" }),
    });
  }
  if (filter.status !== "all") {
    chips.push({
      id: "status",
      label: `Статус: ${statusLabelRu(filter.status)}`,
      clear: (s) => ({ ...s, status: "all" }),
    });
  }
  return chips;
}
