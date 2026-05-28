/**
 * HTTP API комментариев клиента и ТТ (Postgres).
 */

import type { DealerCardComment, DealerCardCommentsState } from "@/lib/dealer-card-comments";
import type { TradePointComment, TradePointCommentsState } from "@/lib/trade-point-comments";
import { tradePointCommentsKey } from "@/lib/trade-point-comments";

export const CLIENT_COMMENTS_MIGRATED_KEY_PREFIX = "tandoor-client-comments-migrated-v1-";

export type ClientCommentDto = {
  id: string;
  clientId: string;
  scope: "dealer" | "trade_point";
  scopeRef: string | null;
  type: string;
  body: string;
  isDeleted: boolean;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiOk<T> = { success: true } & T;
type ApiErr = { success: false; code?: string; message?: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export type ClientCommentsBundle = {
  dealerComments: DealerCardComment[];
  tradePointByKey: Record<string, TradePointComment[]>;
};

function mapDtoToDealerComment(d: ClientCommentDto): DealerCardComment {
  return {
    id: d.id,
    type: (d.type === "problem" || d.type === "competitor" ? d.type : "general") as DealerCardComment["type"],
    body: d.body,
    createdAt: d.createdAt,
    createdBy: d.createdByUserId ?? "",
    createdByName: d.createdByName ?? "",
  };
}

function mapDtoToTradePointComment(d: ClientCommentDto): TradePointComment {
  return {
    id: d.id,
    body: d.body,
    createdAt: d.createdAt,
    createdBy: d.createdByUserId ?? "",
    createdByName: d.createdByName ?? "",
  };
}

export function bundleItemsToCache(clientId: string, items: ClientCommentDto[]): ClientCommentsBundle {
  const dealerComments: DealerCardComment[] = [];
  const tradePointByKey: Record<string, TradePointComment[]> = {};
  for (const item of items) {
    if (item.isDeleted) continue;
    if (item.scope === "dealer") {
      dealerComments.push(mapDtoToDealerComment(item));
    } else if (item.scope === "trade_point" && item.scopeRef) {
      const key = tradePointCommentsKey(clientId, item.scopeRef);
      const list = tradePointByKey[key] ?? [];
      tradePointByKey[key] = [...list, mapDtoToTradePointComment(item)];
    }
  }
  dealerComments.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  for (const key of Object.keys(tradePointByKey)) {
    tradePointByKey[key]!.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }
  return { dealerComments, tradePointByKey };
}

export async function fetchClientComments(clientId: string): Promise<{ items: ClientCommentDto[] } | null> {
  try {
    const res = await fetch(`/api/client-comments/list?clientId=${encodeURIComponent(clientId)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<{ clientId: string; items: ClientCommentDto[] }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return { items: data.items };
  } catch {
    return null;
  }
}

export async function apiCreateComment(body: Record<string, unknown>): Promise<{ ok: boolean; id?: string }> {
  const res = await fetch("/api/client-comments/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false };
  const data = await parseJson<ApiOk<{ item: ClientCommentDto }> | ApiErr>(res);
  if (!data.success) return { ok: false };
  return { ok: true, id: data.item.id };
}

export async function apiRequestDeleteComment(id: string, reason?: string): Promise<boolean> {
  const res = await fetch("/api/client-comments/request-delete", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, reason }),
  });
  return res.ok;
}

export async function apiBulkImport(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number }> {
  const res = await fetch("/api/client-comments/bulk-import", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok || res.status === 409, status: res.status };
}

export function buildBulkImportPayloadFromLocal(
  clientId: string,
  dealerState: DealerCardCommentsState,
  tpState: TradePointCommentsState,
): Record<string, unknown> {
  const tradePointContacts: Record<string, TradePointComment[]> = {};
  const prefix = `${clientId}|`;
  for (const [key, list] of Object.entries(tpState.commentsByTradePoint)) {
    if (!key.startsWith(prefix)) continue;
    tradePointContacts[key.slice(prefix.length)] = list;
  }
  return {
    clientId,
    dealerComments: dealerState.commentsByDealer[clientId] ?? [],
    tradePointContacts,
  };
}
