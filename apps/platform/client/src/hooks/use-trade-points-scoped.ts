/**
 * Промт 393 — React Query hook для списка ТТ из БД.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchTradePointsListScoped,
  tradePointsListScopedQueryKey,
  type TradePointsListScopedResponse,
} from "@/lib/trade-points-scoped-api";

export type UseTradePointsScopedOptions = {
  forUserId?: string;
  enabled?: boolean;
};

export function useTradePointsScoped(opts?: UseTradePointsScopedOptions) {
  const forUserId = opts?.forUserId?.trim() || undefined;
  const enabled = opts?.enabled !== false;

  return useQuery<TradePointsListScopedResponse>({
    queryKey: tradePointsListScopedQueryKey(forUserId),
    queryFn: () => fetchTradePointsListScoped(forUserId),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
