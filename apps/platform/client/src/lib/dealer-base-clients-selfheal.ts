import type { DealerBaseAccessRole } from "./dealer-base-role-views.js";
import type { ClientCategorySelection, QuickFilter } from "./dealer-base-picker-filters.js";
import type { OrgSnapshot } from "./use-org-snapshot.js";

export type SelfHealZeroResultArgs = {
  useReal: boolean;
  snap: OrgSnapshot | null | undefined;
  access: DealerBaseAccessRole;
  scopedRowsLength: number;
  pickerFilteredLength: number;
  ropTeam: string;
  manager: string;
  defaultRopManager: { ropTeam: string; manager: string };
  search: string;
  quick: QuickFilter;
  cities: string[];
  categories: ClientCategorySelection[];
  geoRegion: string;
  geoDistrict: string;
  geoLocality: string;
  programFiltersLength: number;
  urlFocusId: string | null;
  urlCharacteristicId: string | null;
  stockListFilter: string;
  segmentListLength: number;
  workPlanFilter: string;
  defaultWorkPlanFilterValue: string;
  selfHealAlreadyApplied: boolean;
};

/** True when stale ROP+Manager picker filters zero out results but scoped portfolio is non-empty. */
export function shouldSelfHealZeroResult(args: SelfHealZeroResultArgs): boolean {
  if (args.selfHealAlreadyApplied) return false;
  if (!args.useReal || !args.snap) return false;
  if (args.access !== "sales_manager") return false;
  if (args.scopedRowsLength === 0) return false;
  if (args.pickerFilteredLength > 0) return false;

  if (args.search.trim()) return false;
  if (args.quick !== "all") return false;
  if (args.cities.length > 0) return false;
  if (args.categories.length > 0) return false;
  if (args.geoRegion.trim()) return false;
  if (args.geoDistrict.trim()) return false;
  if (args.geoLocality.trim()) return false;
  if (args.programFiltersLength > 0) return false;
  if (args.urlFocusId) return false;
  if (args.urlCharacteristicId) return false;
  if (args.stockListFilter !== "all") return false;
  if (args.segmentListLength > 0) return false;
  if (args.workPlanFilter !== args.defaultWorkPlanFilterValue) return false;

  if (args.ropTeam === args.defaultRopManager.ropTeam && args.manager === args.defaultRopManager.manager) {
    return false;
  }

  return true;
}
