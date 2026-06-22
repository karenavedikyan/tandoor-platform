import { useCallback, useEffect, useMemo, useState } from "react";
import type { TrashedDealerInfo, TrashedTradePointInfo } from "@/lib/client-base-actualization-state";
import { fetchDealerOverridesList } from "@/lib/dealer-overrides-api";
import { fetchTradePointOverridesList } from "@/lib/trade-point-overrides-api";
import { getSalesUserById } from "@/lib/sales-control-data";
import {
  mapDbDealerOverrideToTrashedDealerInfo,
  mapDbTradePointOverrideToTrashedTradePointInfo,
} from "@/lib/trash-db-adapter";

type TrashFromDbState = {
  dealers: TrashedDealerInfo[];
  tradePoints: TrashedTradePointInfo[];
  dealersById: Record<string, TrashedDealerInfo>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const adapterDeps = {
  resolveUserName: (userId: string | null | undefined) => {
    if (!userId?.trim()) return "";
    return getSalesUserById(userId)?.name ?? userId;
  },
};

export function useTrashFromDb(enabled = true): TrashFromDbState {
  const [dealers, setDealers] = useState<TrashedDealerInfo[]>([]);
  const [tradePoints, setTradePoints] = useState<TrashedTradePointInfo[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setDealers([]);
      setTradePoints([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const [dealerData, tpData] = await Promise.all([
        fetchDealerOverridesList(undefined, "in_trash"),
        fetchTradePointOverridesList({ status: "in_trash" }),
      ]);
      if (cancelled) return;

      if (!dealerData || !tpData) {
        setDealers([]);
        setTradePoints([]);
        setError("Не удалось загрузить корзину");
        setLoading(false);
        return;
      }

      const nextDealers = dealerData.overrides
        .map((row) => mapDbDealerOverrideToTrashedDealerInfo(row, adapterDeps))
        .filter((row): row is TrashedDealerInfo => row != null);
      const nextTradePoints = tpData.overrides
        .map((row) => mapDbTradePointOverrideToTrashedTradePointInfo(row, adapterDeps))
        .filter((row): row is TrashedTradePointInfo => row != null);

      setDealers(nextDealers);
      setTradePoints(nextTradePoints);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken]);

  const dealersById = useMemo(() => {
    const map: Record<string, TrashedDealerInfo> = {};
    for (const d of dealers) map[d.dealerId] = d;
    return map;
  }, [dealers]);

  return { dealers, tradePoints, dealersById, loading, error, refetch };
}
