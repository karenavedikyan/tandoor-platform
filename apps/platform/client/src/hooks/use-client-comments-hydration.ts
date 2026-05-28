import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CLIENT_COMMENTS_MIGRATED_KEY_PREFIX,
  apiBulkImport,
  buildBulkImportPayloadFromLocal,
  bundleItemsToCache,
  fetchClientComments,
} from "@/lib/client-comments-api";
import { loadDealerCardCommentsState } from "@/lib/dealer-card-comments";
import { loadTradePointCommentsState } from "@/lib/trade-point-comments";
import {
  applyBundleToLocalStorage,
  notifyClientCommentsChanged,
  refreshDbCommentsForClient,
  setDbCommentsBundleForClient,
} from "@/lib/client-comments-db-cache";

async function runAutoMigration(clientId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const flagKey = `${CLIENT_COMMENTS_MIGRATED_KEY_PREFIX}${clientId}`;
  if (localStorage.getItem(flagKey)) return;

  const dealerState = loadDealerCardCommentsState();
  const tpState = loadTradePointCommentsState();
  const dealerComments = dealerState.commentsByDealer[clientId] ?? [];
  const tpComments: Record<string, import("@/lib/trade-point-comments").TradePointComment[]> = {};
  const prefix = `${clientId}|`;
  for (const [key, list] of Object.entries(tpState.commentsByTradePoint)) {
    if (!key.startsWith(prefix)) continue;
    tpComments[key.slice(prefix.length)] = list;
  }

  if (dealerComments.length === 0 && Object.keys(tpComments).length === 0) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  const existing = await fetchClientComments(clientId);
  const active = (existing?.items ?? []).filter((c) => !c.isDeleted);
  if (active.length > 0) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  const payload = buildBulkImportPayloadFromLocal(clientId, dealerState, tpState);
  const { ok, status } = await apiBulkImport(payload);
  if (ok || status === 409) {
    localStorage.setItem(flagKey, "1");
  }
}

/**
 * Подгружает комментарии клиента и ТТ из API, выполняет одноразовую миграцию из localStorage.
 */
export function useClientCommentsHydration(clientId: string | undefined, enabled = true) {
  const qc = useQueryClient();
  const migratedRef = useRef(false);

  const q = useQuery({
    queryKey: ["client-comments", clientId],
    enabled: Boolean(enabled && clientId),
    staleTime: 30_000,
    queryFn: async () => {
      const id = clientId!;
      if (!migratedRef.current) {
        await runAutoMigration(id);
        migratedRef.current = true;
      }
      const payload = await fetchClientComments(id);
      if (!payload) return null;
      const bundle = bundleItemsToCache(id, payload.items);
      setDbCommentsBundleForClient(id, bundle);
      applyBundleToLocalStorage(id, bundle);
      notifyClientCommentsChanged();
      return bundle;
    },
  });

  useEffect(() => {
    if (q.data && clientId) {
      setDbCommentsBundleForClient(clientId, q.data);
      applyBundleToLocalStorage(clientId, q.data);
      notifyClientCommentsChanged();
    }
  }, [q.data, clientId]);

  return {
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => {
      if (!clientId) return Promise.resolve();
      return qc
        .invalidateQueries({ queryKey: ["client-comments", clientId] })
        .then(() => refreshDbCommentsForClient(clientId));
    },
  };
}
