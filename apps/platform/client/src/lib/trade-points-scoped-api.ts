/**
 * Промт 393 — клиентский API списка ТТ из БД.
 */

export type ScopedTradePointDto = {
  id: string;
  externalKey: string;
  name: string;
  city: string | null;
  address: string | null;
  format: string | null;
  isActive: boolean;
  isPrimary: boolean;
  importanceTier: string | null;
  dealerId: string;
  dealerExternalKey: string;
  dealerName: string;
  dealerReleaseCode: string | null;
  dealerCity: string | null;
  dealerClientCategory: string | null;
  managerUserId: string | null;
  managerFullName: string | null;
  regionalManagerUserId: string | null;
  regionalManagerFullName: string | null;
  teamId: string | null;
  teamName: string | null;
  ropUserId: string | null;
  ropFullName: string | null;
};

export type TradePointsListScopedResponse =
  | {
      success: true;
      source: "db";
      tradePoints: ScopedTradePointDto[];
      meta: { total: number; scope: "self" | "team" | "org" };
    }
  | { success: false; code?: string; message?: string };

export const TRADE_POINTS_LIST_SCOPED_QUERY_KEY = ["trade-points", "list-scoped"] as const;

export const TRADE_POINTS_SCOPED_INVALIDATE_EVENT = "tandoor:trade-points-scoped:invalidate";

/** Сигнал для React Query (слушатель в overrides-session-bootstrap). */
export function invalidateTradePointsScopedQueries(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TRADE_POINTS_SCOPED_INVALIDATE_EVENT));
}

export function tradePointsListScopedQueryKey(forUserId?: string): readonly [string, string, string] {
  return [...TRADE_POINTS_LIST_SCOPED_QUERY_KEY, forUserId ?? "self"] as const;
}

export async function fetchTradePointsListScoped(forUserId?: string): Promise<TradePointsListScopedResponse> {
  const qs = forUserId ? `?for_user_id=${encodeURIComponent(forUserId)}` : "";
  const res = await fetch(`/api/dealers-trade-points/list-scoped${qs}`, {
    method: "GET",
    credentials: "same-origin",
  });
  const json = (await res.json()) as TradePointsListScopedResponse;
  if (!res.ok) {
    return {
      success: false,
      code: "code" in json ? String(json.code) : undefined,
      message: "message" in json && typeof json.message === "string" ? json.message : "Ошибка загрузки ТТ.",
    };
  }
  return json;
}
