/**
 * Комментарии по торговой точке.
 * Чтение: Postgres (кеш) → fallback localStorage. Запись: LS + API.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { canEditClientNextStep } from "@/lib/client-next-step-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { apiCreateComment } from "@/lib/client-comments-api";
import { refreshDbCommentsForClient, resolveTradePointComments } from "@/lib/client-comments-db-cache";

export const TRADE_POINT_COMMENTS_STORAGE_KEY = "tandoor-trade-point-comments-v1";
export const TRADE_POINT_COMMENTS_EVENT = "tandoor-trade-point-comments-changed";

export type TradePointComment = {
  id: string;
  body: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
};

export type TradePointCommentsState = {
  commentsByTradePoint: Record<string, TradePointComment[]>;
};

function emptyState(): TradePointCommentsState {
  return { commentsByTradePoint: {} };
}

export function tradePointCommentsKey(dealerId: string, tradePointId: string): string {
  return `${dealerId}|${tradePointId}`;
}

export function loadTradePointCommentsState(): TradePointCommentsState {
  if (typeof window === "undefined" || !window.localStorage) return emptyState();
  try {
    const raw = window.localStorage.getItem(TRADE_POINT_COMMENTS_STORAGE_KEY);
    if (!raw) return emptyState();
    const p = JSON.parse(raw) as Partial<TradePointCommentsState>;
    return {
      commentsByTradePoint:
        p.commentsByTradePoint && typeof p.commentsByTradePoint === "object" ? p.commentsByTradePoint : {},
    };
  } catch {
    return emptyState();
  }
}

export function saveTradePointCommentsState(state: TradePointCommentsState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(TRADE_POINT_COMMENTS_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(TRADE_POINT_COMMENTS_EVENT));
}

export function getTradePointComments(
  dealerId: string,
  tradePointId: string,
  state?: TradePointCommentsState,
): TradePointComment[] {
  const list = state
    ? [...(state.commentsByTradePoint[tradePointCommentsKey(dealerId, tradePointId)] ?? [])]
    : resolveTradePointComments(dealerId, tradePointId);
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export function canEditTradePointComments(profile: ReleaseDemoProfile, dealer: DealerRow): boolean {
  return canEditClientNextStep(profile, dealer);
}

export function addTradePointComment(
  dealerId: string,
  tradePointId: string,
  payload: { body: string; createdBy: string; createdByName: string },
): void {
  const body = payload.body.trim();
  if (!body) return;
  const state = loadTradePointCommentsState();
  const key = tradePointCommentsKey(dealerId, tradePointId);
  const prev = state.commentsByTradePoint[key] ?? [];
  const optimisticId = `tpc-${key}-${Date.now()}`;
  const entry: TradePointComment = {
    id: optimisticId,
    body,
    createdAt: new Date().toISOString(),
    createdBy: payload.createdBy,
    createdByName: payload.createdByName,
  };
  state.commentsByTradePoint[key] = [entry, ...prev].slice(0, 80);
  saveTradePointCommentsState(state);

  void apiCreateComment({
    clientId: dealerId,
    scope: "trade_point",
    scopeRef: tradePointId,
    body,
    createdByUserId: payload.createdBy,
    createdByName: payload.createdByName,
  }).then((r) => {
    if (r.ok) void refreshDbCommentsForClient(dealerId);
  });
}
