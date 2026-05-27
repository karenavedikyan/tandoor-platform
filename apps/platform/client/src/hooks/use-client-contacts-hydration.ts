import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CLIENT_CONTACTS_MIGRATED_KEY_PREFIX,
  apiBulkImportContacts,
  buildBulkImportPayloadFromLocal,
  fetchClientContactsList,
} from "@/lib/client-contacts-api";
import { loadClientContactsState } from "@/lib/client-contacts";
import {
  notifyClientContactsChanged,
  refreshDbContactsForDealer,
  setDbContactsStateForDealer,
} from "@/lib/client-contacts-db-cache";
import { bundleListPayloadToState } from "@/lib/client-contacts-api";

function hasLocalContactsForDealer(dealerId: string, local: ReturnType<typeof loadClientContactsState>): boolean {
  if ((local.dealerContactsByDealer[dealerId] ?? []).length > 0) return true;
  const prefix = `${dealerId}|`;
  if (Object.keys(local.legalEntityContactsByKey).some((k) => k.startsWith(prefix))) return true;
  if (Object.keys(local.tradePointContactsByKey).some((k) => k.startsWith(prefix))) return true;
  return false;
}

async function runAutoMigration(dealerId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const flagKey = `${CLIENT_CONTACTS_MIGRATED_KEY_PREFIX}${dealerId}`;
  if (localStorage.getItem(flagKey)) return;

  const local = loadClientContactsState();
  if (!hasLocalContactsForDealer(dealerId, local)) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  const existing = await fetchClientContactsList(dealerId);
  if (existing && existing.items.length > 0) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  const payload = buildBulkImportPayloadFromLocal(dealerId, local);
  const { ok, status } = await apiBulkImportContacts(payload);
  if (ok || status === 409) {
    localStorage.setItem(flagKey, "1");
  }
}

/**
 * Подгружает контакты клиента из API, выполняет одноразовую миграцию из localStorage.
 */
export function useClientContactsHydration(dealerId: string | undefined, enabled = true) {
  const qc = useQueryClient();
  const migratedRef = useRef(false);

  const q = useQuery({
    queryKey: ["client-contacts", dealerId],
    enabled: Boolean(enabled && dealerId),
    staleTime: 30_000,
    queryFn: async () => {
      const id = dealerId!;
      if (!migratedRef.current) {
        await runAutoMigration(id);
        migratedRef.current = true;
      }
      const payload = await fetchClientContactsList(id);
      if (!payload) return null;
      const state = bundleListPayloadToState(id, payload);
      setDbContactsStateForDealer(id, state);
      notifyClientContactsChanged();
      return state;
    },
  });

  useEffect(() => {
    if (q.data && dealerId) {
      setDbContactsStateForDealer(dealerId, q.data);
      notifyClientContactsChanged();
    }
  }, [q.data, dealerId]);

  return {
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => {
      if (!dealerId) return Promise.resolve();
      return qc.invalidateQueries({ queryKey: ["client-contacts", dealerId] }).then(() => refreshDbContactsForDealer(dealerId));
    },
  };
}
