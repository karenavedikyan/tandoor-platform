/**
 * Кеш комментариев клиента/ТТ из Postgres + синхронизация с UI.
 */

import {
  DEALER_CARD_COMMENTS_EVENT,
  type DealerCardComment,
  type DealerCardCommentsState,
  loadDealerCardCommentsState,
  saveDealerCardCommentsState,
} from "./dealer-card-comments.js";
import {
  TRADE_POINT_COMMENTS_EVENT,
  type TradePointComment,
  type TradePointCommentsState,
  loadTradePointCommentsState,
  saveTradePointCommentsState,
} from "./trade-point-comments.js";
import { bundleItemsToCache, fetchClientComments, type ClientCommentsBundle } from "./client-comments-api.js";

const cacheByClientId: Record<string, ClientCommentsBundle> = {};

export function getDbCommentsBundleForClient(clientId: string): ClientCommentsBundle | null {
  return cacheByClientId[clientId] ?? null;
}

export function setDbCommentsBundleForClient(clientId: string, bundle: ClientCommentsBundle | null): void {
  if (bundle) cacheByClientId[clientId] = bundle;
  else delete cacheByClientId[clientId];
}

export function applyBundleToLocalStorage(clientId: string, bundle: ClientCommentsBundle): void {
  const dealerState = loadDealerCardCommentsState();
  dealerState.commentsByDealer[clientId] = bundle.dealerComments;
  saveDealerCardCommentsState(dealerState);

  const tpState = loadTradePointCommentsState();
  const prefix = `${clientId}|`;
  for (const key of Object.keys(tpState.commentsByTradePoint)) {
    if (key.startsWith(prefix)) delete tpState.commentsByTradePoint[key];
  }
  for (const [key, list] of Object.entries(bundle.tradePointByKey)) {
    tpState.commentsByTradePoint[key] = list;
  }
  saveTradePointCommentsState(tpState);
}

export function notifyClientCommentsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DEALER_CARD_COMMENTS_EVENT));
    window.dispatchEvent(new CustomEvent(TRADE_POINT_COMMENTS_EVENT));
  }
}

export async function refreshDbCommentsForClient(clientId: string): Promise<boolean> {
  const payload = await fetchClientComments(clientId);
  if (!payload) return false;
  const bundle = bundleItemsToCache(clientId, payload.items);
  setDbCommentsBundleForClient(clientId, bundle);
  applyBundleToLocalStorage(clientId, bundle);
  notifyClientCommentsChanged();
  return true;
}

export function resolveDealerCommentsForClient(
  clientId: string,
  state?: DealerCardCommentsState,
): DealerCardComment[] {
  if (state) return [...(state.commentsByDealer[clientId] ?? [])];
  const db = getDbCommentsBundleForClient(clientId);
  if (db) return [...db.dealerComments];
  return [...(loadDealerCardCommentsState().commentsByDealer[clientId] ?? [])];
}

export function resolveTradePointComments(
  dealerId: string,
  tradePointId: string,
  state?: TradePointCommentsState,
): TradePointComment[] {
  const key = `${dealerId}|${tradePointId}`;
  if (state) return [...(state.commentsByTradePoint[key] ?? [])];
  const db = getDbCommentsBundleForClient(dealerId);
  if (db?.tradePointByKey[key]) return [...db.tradePointByKey[key]!];
  return [...(loadTradePointCommentsState().commentsByTradePoint[key] ?? [])];
}
