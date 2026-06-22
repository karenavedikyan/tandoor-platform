import type { DealerRow } from "../dealer-base-mock-data.js";

export const DISTRIBUTION_ANALYTICS_FILTER_OPTIONS_MAX_DEALERS = 5000;

export type DistributionAnalyticsFilterSelectOption = {
  value: string;
  label: string;
};

export type DistributionAnalyticsFilterOptions = {
  cityOptions: DistributionAnalyticsFilterSelectOption[];
  regionOptions: DistributionAnalyticsFilterSelectOption[];
  dealerOptions: DistributionAnalyticsFilterSelectOption[];
  tradePointOptions: DistributionAnalyticsFilterSelectOption[];
  managerOptions: DistributionAnalyticsFilterSelectOption[];
  regionalManagerOptions: DistributionAnalyticsFilterSelectOption[];
  ropOptions: DistributionAnalyticsFilterSelectOption[];
};

const EMPTY_FILTER_OPTIONS: DistributionAnalyticsFilterOptions = {
  cityOptions: [],
  regionOptions: [],
  dealerOptions: [],
  tradePointOptions: [],
  managerOptions: [],
  regionalManagerOptions: [],
  ropOptions: [],
};

function dealerClientCodeLabel(dealer: DealerRow): string {
  return dealer.releaseCode?.trim() || dealer.external1cCode?.trim() || "—";
}

function tradePointDisplayLabel(tp: DealerRow["tradePoints"][number]): string {
  const code = tp.releaseCode?.trim() || tp.id;
  return `${code} · ${tp.name}`;
}

function uniqueSelectOptions(labels: string[], values?: string[]): DistributionAnalyticsFilterSelectOption[] {
  const seen = new Set<string>();
  const out: DistributionAnalyticsFilterSelectOption[] = [];
  labels.forEach((label, i) => {
    const value = values?.[i] ?? label;
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push({ value, label });
  });
  out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  return out;
}

function isFilledPersonName(value: string | undefined): boolean {
  const t = value?.trim() ?? "";
  return t !== "" && t !== "—" && t !== "-";
}

/** Lightweight filter dropdown options from dealer scope (bypasses analytics scopedRows). */
export function buildDistributionAnalyticsFilterOptionsFromDealers(
  scopedDealers: readonly DealerRow[],
): DistributionAnalyticsFilterOptions {
  if (scopedDealers.length > DISTRIBUTION_ANALYTICS_FILTER_OPTIONS_MAX_DEALERS) {
    return EMPTY_FILTER_OPTIONS;
  }

  const cityLabels: string[] = [];
  const regionLabels: string[] = [];
  const dealerLabels: string[] = [];
  const dealerValues: string[] = [];
  const tpLabels: string[] = [];
  const tpValues: string[] = [];
  const managerLabels: string[] = [];
  const managerValues: string[] = [];
  const rmLabels: string[] = [];
  const rmValues: string[] = [];
  const ropLabels: string[] = [];
  const ropValues: string[] = [];

  for (const dealer of scopedDealers) {
    if (dealer.city?.trim()) cityLabels.push(dealer.city.trim());
    if (dealer.region?.trim()) regionLabels.push(dealer.region.trim());

    dealerLabels.push(`${dealer.name} (${dealerClientCodeLabel(dealer)})`);
    dealerValues.push(dealer.id);

    for (const tp of dealer.tradePoints ?? []) {
      if (tp.city?.trim()) cityLabels.push(tp.city.trim());
      tpLabels.push(tradePointDisplayLabel(tp));
      tpValues.push(tp.id);
    }

    if (isFilledPersonName(dealer.manager)) {
      managerLabels.push(dealer.manager);
      managerValues.push(`mgr:${dealer.manager}`);
    }
    if (isFilledPersonName(dealer.regionalManager)) {
      rmLabels.push(dealer.regionalManager);
      rmValues.push(`rm:${dealer.regionalManager}`);
    }
    if (isFilledPersonName(dealer.ropName)) {
      ropLabels.push(dealer.ropName);
      ropValues.push(`rop:${dealer.ropName}`);
    }
  }

  return {
    cityOptions: uniqueSelectOptions(cityLabels),
    regionOptions: uniqueSelectOptions(regionLabels),
    dealerOptions: uniqueSelectOptions(dealerLabels, dealerValues),
    tradePointOptions: uniqueSelectOptions(tpLabels, tpValues),
    managerOptions: uniqueSelectOptions(managerLabels, managerValues),
    regionalManagerOptions: uniqueSelectOptions(rmLabels, rmValues),
    ropOptions: uniqueSelectOptions(ropLabels, ropValues),
  };
}
