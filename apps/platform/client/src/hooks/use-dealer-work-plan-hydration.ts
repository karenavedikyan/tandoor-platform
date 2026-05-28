import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEALER_WORK_PLAN_MIGRATED_KEY_PREFIX,
  apiBulkImport,
  buildBulkImportPayloadFromLocal,
  fetchWorkPlan,
} from "@/lib/dealer-work-plan-api";
import { loadDealerWorkPlanState } from "@/lib/dealer-work-plan";
import {
  applyWorkPlanItemsToLocal,
  notifyWorkPlanChanged,
  refreshWorkPlanFromApi,
  setWorkPlanSessionKeys,
} from "@/lib/dealer-work-plan-db-cache";

async function runAutoMigration(authUserId: string, localUserKey: string): Promise<void> {
  if (typeof window === "undefined") return;
  const flagKey = `${DEALER_WORK_PLAN_MIGRATED_KEY_PREFIX}${authUserId}`;
  if (localStorage.getItem(flagKey)) return;

  const local = loadDealerWorkPlanState();
  const userHidden = local.hiddenByUser[localUserKey] ?? {};
  const userSched = local.scheduledByUser[localUserKey] ?? {};
  if (Object.keys(userHidden).length === 0 && Object.keys(userSched).length === 0) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  const existing = await fetchWorkPlan(authUserId);
  if (existing && existing.items.length > 0) {
    localStorage.setItem(flagKey, "1");
    return;
  }

  const payload = buildBulkImportPayloadFromLocal(authUserId, localUserKey, local);
  const { ok, status } = await apiBulkImport(payload);
  if (ok || status === 409) {
    localStorage.setItem(flagKey, "1");
  }
}

/**
 * Подгружает рабочий план из API, выполняет одноразовую миграцию из localStorage.
 * @param authUserId — UUID из `useCurrentUser().user.id`
 * @param localUserKey — ключ в LS (`profile.personaUserId`)
 */
export function useDealerWorkPlanHydration(
  authUserId: string | undefined,
  localUserKey: string | undefined,
  enabled = true,
) {
  const qc = useQueryClient();
  const migratedRef = useRef(false);

  useEffect(() => {
    setWorkPlanSessionKeys(authUserId ?? null, localUserKey ?? null);
  }, [authUserId, localUserKey]);

  const q = useQuery({
    queryKey: ["dealer-work-plan", authUserId, localUserKey],
    enabled: Boolean(enabled && authUserId && localUserKey),
    staleTime: 30_000,
    queryFn: async () => {
      const authId = authUserId!;
      const localKey = localUserKey!;
      if (!migratedRef.current) {
        await runAutoMigration(authId, localKey);
        migratedRef.current = true;
      }
      const payload = await fetchWorkPlan(authId);
      if (!payload) return null;
      applyWorkPlanItemsToLocal(localKey, payload.items);
      notifyWorkPlanChanged();
      return payload.items;
    },
  });

  return {
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: () => {
      if (!authUserId || !localUserKey) return Promise.resolve();
      return qc
        .invalidateQueries({ queryKey: ["dealer-work-plan", authUserId, localUserKey] })
        .then(() => refreshWorkPlanFromApi(localUserKey, authUserId));
    },
  };
}
