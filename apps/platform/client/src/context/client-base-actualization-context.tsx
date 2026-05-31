/**
 * Контекст актуализации: загрузка / сохранение ActualizationState через API для ЛК.
 */

import type { ReactElement, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useAuthUser } from "@/hooks/use-auth-user";
import {
  loadActualizationState,
  resetActualizationAuthCache,
  saveActualizationState,
  type ActualizationApiMeta,
  type ActualizationPersistResult,
  type ActualizationSyncStatus,
  type ActualizationUnTrashDirective,
} from "@/lib/client-base-actualization-api";
import { canActualizeClientBase } from "@/lib/client-base-actualization-permissions";
import { createEmptyActualizationState, type ActualizationState } from "@/lib/client-base-actualization-state";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import type { DealerRow } from "@/lib/dealer-base-mock-data";

export type ClientBaseActualizationContextValue = {
  enabled: boolean;
  /** Загрузка первичная или после refresh. */
  loading: boolean;
  state: ActualizationState;
  meta: ActualizationApiMeta;
  syncStatus: ActualizationSyncStatus;
  errorMessage?: string;
  refresh: () => Promise<void>;
  /**
   * Обновить state и отправить на сервер.
   * `extra.unTrash` — явное «Восстановить из корзины» или «Удалить навсегда»: серверная
   * защита B1 без этого флага восстанавливает удалённую запись `trashedDealersById` /
   * `trashedTradePointsById` из prev. Когда ключ есть в `unTrash`, действие считается
   * легитимным и запись действительно удаляется.
   */
  persist: (
    updater: (prev: ActualizationState) => ActualizationState,
    extra?: { unTrash?: ActualizationUnTrashDirective },
  ) => Promise<ActualizationPersistResult>;
  /** Строки клиентской базы с учётом актуализации (для списков). */
  mergedDealerRows: DealerRow[];
};

const Ctx = createContext<ClientBaseActualizationContextValue | null>(null);

export function ClientBaseActualizationProvider({ children }: { children: ReactNode }): ReactElement {
  const { user: authUser } = useAuthUser();
  const { profile } = useReleaseDemoProfile();
  const enabled = useMemo(() => canActualizeClientBase(profile, authUser?.role), [profile, authUser?.role]);

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ActualizationState>(() => createEmptyActualizationState());
  const [meta, setMeta] = useState<ActualizationApiMeta>(() => ({
    success: false,
    storageMode: "server_memory",
    state: createEmptyActualizationState(),
    updatedAt: null,
  }));
  const [syncStatus, setSyncStatus] = useState<ActualizationSyncStatus>("api_ok");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    resetActualizationAuthCache();
  }, [authUser?.id, authUser?.role]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setState(createEmptyActualizationState());
      return;
    }
    setLoading(true);
    const r = await loadActualizationState(profile);
    setMeta(r.meta);
    setSyncStatus(r.syncStatus);
    setErrorMessage(r.errorMessage);
    setState(r.meta.state);
    setLoading(false);
  }, [enabled, profile, authUser?.id, authUser?.role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persist = useCallback(
    async (
      updater: (prev: ActualizationState) => ActualizationState,
      extra?: { unTrash?: ActualizationUnTrashDirective },
    ): Promise<ActualizationPersistResult> => {
      if (!enabled) return { success: false, syncStatus: "error", storageMode: "not_configured" };
      const next = updater(stateRef.current);
      setState(next);
      const r = await saveActualizationState(profile, next, extra);
      setMeta(r.meta);
      setSyncStatus(r.syncStatus);
      setErrorMessage(r.errorMessage);
      if (r.syncStatus === "api_ok" && r.meta.success) {
        setState(r.meta.state);
        return { success: true, syncStatus: r.syncStatus, storageMode: r.meta.storageMode };
      }
      setState(r.meta.state);
      return { success: false, syncStatus: r.syncStatus, storageMode: r.meta.storageMode };
    },
    [enabled, profile],
  );

  const mergedDealerRows = useMemo(() => {
    if (!enabled) return [];
    return buildDealerBaseRowsWithActualization(state, profile);
  }, [enabled, state, profile]);

  const value = useMemo<ClientBaseActualizationContextValue>(
    () => ({
      enabled,
      loading,
      state,
      meta,
      syncStatus,
      errorMessage,
      refresh,
      persist,
      mergedDealerRows,
    }),
    [enabled, loading, state, meta, syncStatus, errorMessage, refresh, persist, mergedDealerRows],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientBaseActualization(): ClientBaseActualizationContextValue {
  const v = useContext(Ctx);
  if (!v) {
    return {
      enabled: false,
      loading: false,
      state: createEmptyActualizationState(),
      meta: {
        success: false,
        storageMode: "not_configured",
        state: createEmptyActualizationState(),
        updatedAt: null,
      },
      syncStatus: "api_ok",
      refresh: async () => {},
      persist: async () => ({ success: false, syncStatus: "api_ok", storageMode: "not_configured" }),
      mergedDealerRows: [],
    };
  }
  return v;
}
