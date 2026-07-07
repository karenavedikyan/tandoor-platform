import { useMemo, useState } from "react";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import {
  applyOneCStoresFilters,
  emptyOneCStoresFilters,
  type OneCStoresFilterState,
} from "./one-c-stores-filter-logic";
import { useOneCStoresDistributionMap } from "./use-one-c-stores-distribution-map";

export function useOneCStoresListView(
  items: OneCStoreListItem[],
  options?: { serverSideSearch?: boolean; cardsView?: boolean },
) {
  const actx = useClientBaseActualization();
  const act = actx.state;
  const [filters, setFilters] = useState<OneCStoresFilterState>(emptyOneCStoresFilters);
  const { map: distAggregates, loading: distLoading } = useOneCStoresDistributionMap(items, act, {
    enabled: !options?.cardsView,
  });
  const filtered = useMemo(
    () =>
      applyOneCStoresFilters(items, filters, distAggregates, {
        skipSearch: options?.serverSideSearch,
      }),
    [items, filters, distAggregates, options?.serverSideSearch],
  );

  return {
    act,
    filters,
    setFilters,
    filtered,
    distAggregates,
    distLoading,
  };
}
