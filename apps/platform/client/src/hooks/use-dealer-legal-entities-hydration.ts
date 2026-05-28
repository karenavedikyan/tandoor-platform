import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEALER_LEGAL_ENTITIES_MIGRATED_KEY_PREFIX,
  apiBulkImport,
  buildBulkImportPayloadFromLocal,
  bundleListFullToState,
  fetchListFull,
} from "@/lib/dealer-legal-entities-api";
import { loadDealerLegalEntitiesState } from "@/lib/dealer-legal-entities";
import {
  notifyDealerLegalEntitiesChanged,
  refreshDbLegalEntitiesForDealer,
  setDbLegalEntitiesStateForDealer,
} from "@/lib/dealer-legal-entities-db-cache";

async function runAutoMigration(dealerId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const flagKey = `${DEALER_LEGAL_ENTITIES_MIGRATED_KEY_PREFIX}${dealerId}`;
  if (localStorage.getItem(flagKey)) return;

  const local = loadDealerLegalEntitiesState();
  const localEntities = local.entitiesByDealer[dealerId] ?? [];
  const localHistory = local.historyByDealer[dealerId] ?? [];
  if (localEntities.length === 0 && localHistory.length === 0) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  const existing = await fetchListFull(dealerId);
  const activeExisting = (existing?.entities ?? []).filter((e) => !e.isArchived);
  if (activeExisting.length > 0) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  const payload = buildBulkImportPayloadFromLocal(dealerId, local);
  const { ok, status } = await apiBulkImport(payload);
  if (ok || status === 409) {
    localStorage.setItem(flagKey, "1");
  }
}

/**
 * Подгружает юрлица дилера из API, выполняет одноразовую миграцию из localStorage.
 */
export function useDealerLegalEntitiesHydration(dealerId: string | undefined, enabled = true) {
  const qc = useQueryClient();
  const migratedRef = useRef(false);

  const q = useQuery({
    queryKey: ["dealer-legal-entities", dealerId],
    enabled: Boolean(enabled && dealerId),
    staleTime: 30_000,
    queryFn: async () => {
      const id = dealerId!;
      if (!migratedRef.current) {
        await runAutoMigration(id);
        migratedRef.current = true;
      }
      const payload = await fetchListFull(id);
      if (!payload) return null;
      const state = bundleListFullToState(id, payload);
      setDbLegalEntitiesStateForDealer(id, state);
      notifyDealerLegalEntitiesChanged();
      return state;
    },
  });

  useEffect(() => {
    if (q.data && dealerId) {
      setDbLegalEntitiesStateForDealer(dealerId, q.data);
      notifyDealerLegalEntitiesChanged();
    }
  }, [q.data, dealerId]);

  return {
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => {
      if (!dealerId) return Promise.resolve();
      return qc
        .invalidateQueries({ queryKey: ["dealer-legal-entities", dealerId] })
        .then(() => refreshDbLegalEntitiesForDealer(dealerId));
    },
  };
}
