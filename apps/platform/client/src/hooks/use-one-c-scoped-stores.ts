import { useEffect, useMemo, useState } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { TradePointListRow } from "@/lib/dealer-base-management-view-model";
import { flattenTradePointsForRows } from "@/lib/dealer-base-management-view-model";
import {
  buildOneCRowRefsMap,
  oneCStoreListItemToDealerWithPoint,
  oneCStoreListItemToTradePointListRow,
} from "@/lib/one-c-distribution-adapter";
import { fetchOneCStores, type OneCStoreListItem } from "@/lib/one-c-showroom-api";

const PAGE_SIZE = 500;

async function fetchAllOneCStores(): Promise<OneCStoreListItem[]> {
  const all: OneCStoreListItem[] = [];
  let offset = 0;
  while (true) {
    const res = await fetchOneCStores({ limit: PAGE_SIZE, offset, onlyActive: false });
    if (!res.success) {
      throw new Error(res.message ?? "Не удалось загрузить магазины 1С.");
    }
    all.push(...res.items);
    if (all.length >= res.total || res.items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export type UseOneCScopedStoresResult = {
  items: OneCStoreListItem[];
  dealers: DealerRow[];
  tradePoints: TradePointListRow[];
  rowRefs: Map<string, { dealer: DealerRow; point: import("@/lib/dealer-base-mock-data").DealerTradePoint }>;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export function useOneCScopedStores(): UseOneCScopedStoresResult {
  const [items, setItems] = useState<OneCStoreListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAllOneCStores()
      .then((list) => {
        if (cancelled) return;
        setItems(list);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const dealers = useMemo(
    () => items.map((item) => oneCStoreListItemToDealerWithPoint(item).dealer),
    [items],
  );

  const tradePoints = useMemo(
    () => items.map((item) => oneCStoreListItemToTradePointListRow(item)),
    [items],
  );

  const rowRefs = useMemo(() => buildOneCRowRefsMap(items), [items]);

  return {
    items,
    dealers,
    tradePoints,
    rowRefs,
    loading,
    error,
    reload: () => setReloadKey((k) => k + 1),
  };
}

/** @deprecated use tradePoints from hook return */
export function oneCScopedStoresToTradePointListRows(dealers: DealerRow[]): TradePointListRow[] {
  return flattenTradePointsForRows(dealers);
}
