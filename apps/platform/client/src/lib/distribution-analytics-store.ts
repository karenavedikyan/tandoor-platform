/**
 * Reactive read-store аналитики дистрибуции: prefetch scope в существующие кэши + подписки.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  collectScopeTradePointIds,
  type DistributionScope,
} from "@/lib/distribution-tree-data";
import { fetchShowcaseMatrixScope, fetchShowcaseMatrixScopeAll } from "@/lib/showcase-matrix-api";
import {
  loadCachedMatrixDefs,
  refreshMatrixCatalogFromServer,
  SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT,
  SHOWCASE_MATRIX_CATALOG_REMOTE_UPDATE_EVENT,
} from "@/lib/showcase-matrix-catalog-store";
import {
  applyScopeEntriesToMatrixCache,
  loadCachedMatrix,
  SHOWCASE_MATRIX_REMOTE_UPDATE_EVENT,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";

export type DistributionAnalyticsSnapshot = {
  loading: boolean;
  network: boolean;
  lastLoadedAt: number | null;
};

const ANALYTICS_LOAD_THROTTLE_MS = 5_000;

const MATRIX_DATA_EVENTS = [
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
  SHOWCASE_MATRIX_REMOTE_UPDATE_EVENT,
  SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT,
  SHOWCASE_MATRIX_CATALOG_REMOTE_UPDATE_EVENT,
] as const;

let snapshot: DistributionAnalyticsSnapshot = {
  loading: false,
  network: true,
  lastLoadedAt: null,
};

const listeners = new Set<() => void>();
const inflightByScopeKey = new Map<string, Promise<{ ok: boolean; network: boolean }>>();
const lastCompletedAtByScopeKey = new Map<string, number>();
const lastNetworkByScopeKey = new Map<string, boolean>();

function emit(): void {
  for (const listener of Array.from(listeners)) {
    listener();
  }
}

function patchSnapshot(patch: Partial<DistributionAnalyticsSnapshot>): void {
  const next: DistributionAnalyticsSnapshot = { ...snapshot, ...patch };
  if (
    next.loading === snapshot.loading &&
    next.network === snapshot.network &&
    next.lastLoadedAt === snapshot.lastLoadedAt
  ) {
    return;
  }
  snapshot = next;
  emit();
}

/** Новая ссылка снапшота без смены полей — пересчёт агрегаторов 164 после ввода факта. */
function bumpSnapshotReference(): void {
  snapshot = { ...snapshot };
  emit();
}

export function distributionAnalyticsScopeKey(scope: DistributionScope): string {
  const ids = [...collectScopeTradePointIds(scope)].sort();
  if (scope.kind === "trade-point") {
    return `tp:${scope.dealer.id}:${scope.point.id}`;
  }
  if (scope.kind === "dealer") {
    return `dealer:${scope.dealer.id}:${ids.join(",")}`;
  }
  return `global:${ids.length}:${ids.join(",")}`;
}

function isMatrixCatalogWarm(): boolean {
  return loadCachedMatrixDefs().length > 0;
}

async function loadMatrixCatalogIfNeeded(force: boolean): Promise<boolean> {
  if (!force && isMatrixCatalogWarm()) return true;
  const headers = await refreshMatrixCatalogFromServer({});
  return headers.length >= 0;
}

export async function ensureDistributionAnalyticsData(opts: {
  scope: DistributionScope;
  force?: boolean;
}): Promise<{ ok: boolean; network: boolean }> {
  const scopeKey = distributionAnalyticsScopeKey(opts.scope);
  const force = opts.force === true;

  if (!force) {
    const inflight = inflightByScopeKey.get(scopeKey);
    if (inflight) return inflight;

    const lastAt = lastCompletedAtByScopeKey.get(scopeKey);
    if (lastAt != null && Date.now() - lastAt < ANALYTICS_LOAD_THROTTLE_MS) {
      return {
        ok: true,
        network: lastNetworkByScopeKey.get(scopeKey) ?? true,
      };
    }
  }

  const run = (async (): Promise<{ ok: boolean; network: boolean }> => {
    patchSnapshot({ loading: true });

    const localIds = collectScopeTradePointIds(opts.scope);
    let network = true;
    let allIds = localIds;

    const remoteAll = await fetchShowcaseMatrixScopeAll({});
    if (remoteAll != null) {
      applyScopeEntriesToMatrixCache(remoteAll.entries);
      allIds = Array.from(new Set([...localIds, ...remoteAll.tradePointIds]));
    } else if (localIds.length > 0) {
      const remote = await fetchShowcaseMatrixScope({ tradePointIds: localIds });
      if (remote == null) {
        network = false;
      } else {
        applyScopeEntriesToMatrixCache(remote);
      }
    }

    await loadMatrixCatalogIfNeeded(force);

    const ok =
      allIds.length === 0 ||
      network ||
      allIds.some((id) => loadCachedMatrix(id).length > 0);

    lastCompletedAtByScopeKey.set(scopeKey, Date.now());
    lastNetworkByScopeKey.set(scopeKey, network);

    patchSnapshot({
      loading: false,
      network,
      lastLoadedAt: Date.now(),
    });

    return { ok, network };
  })();

  inflightByScopeKey.set(scopeKey, run);
  try {
    return await run;
  } finally {
    inflightByScopeKey.delete(scopeKey);
  }
}

export function subscribeDistributionAnalytics(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  if (typeof window === "undefined") {
    return () => {
      listeners.delete(onStoreChange);
    };
  }

  const onMatrixData = () => bumpSnapshotReference();
  for (const eventName of MATRIX_DATA_EVENTS) {
    window.addEventListener(eventName, onMatrixData);
  }

  return () => {
    listeners.delete(onStoreChange);
    for (const eventName of MATRIX_DATA_EVENTS) {
      window.removeEventListener(eventName, onMatrixData);
    }
  };
}

export function getDistributionAnalyticsSnapshot(): DistributionAnalyticsSnapshot {
  return snapshot;
}

/** Только для unit-тестов. */
export function resetDistributionAnalyticsStoreForTests(): void {
  snapshot = { loading: false, network: true, lastLoadedAt: null };
  listeners.clear();
  inflightByScopeKey.clear();
  lastCompletedAtByScopeKey.clear();
  lastNetworkByScopeKey.clear();
}

export function useDistributionAnalytics(scope: DistributionScope): {
  snapshot: DistributionAnalyticsSnapshot;
  reload: (force?: boolean) => void;
} {
  const scopeKey = distributionAnalyticsScopeKey(scope);
  const scopeKeyRef = useRef(scopeKey);
  scopeKeyRef.current = scopeKey;

  const externalSnapshot = useSyncExternalStore(
    subscribeDistributionAnalytics,
    getDistributionAnalyticsSnapshot,
    getDistributionAnalyticsSnapshot,
  );

  const reload = useCallback((force?: boolean) => {
    void ensureDistributionAnalyticsData({ scope, force });
  }, [scope]);

  useEffect(() => {
    void ensureDistributionAnalyticsData({ scope });
  }, [scopeKey, scope]);

  return { snapshot: externalSnapshot, reload };
}
