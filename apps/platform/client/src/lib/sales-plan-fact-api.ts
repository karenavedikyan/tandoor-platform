/**
 * Клиентский слой GET/POST /api/sales-plan-fact/state (организационный persisted документ).
 */

import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import {
  createEmptySalesPlanFactState,
  normalizeSalesPlanFactState,
  type SalesPlanFactPersistedState,
  type SalesPlanFactStorageMode,
} from "./sales-plan-fact-types.js";

export type SalesPlanFactApiMeta = {
  success: boolean;
  storageMode: SalesPlanFactStorageMode;
  state: SalesPlanFactPersistedState;
  updatedAt: string | null;
  message?: string;
  code?: string;
};

export type SalesPlanFactLoadResult = {
  meta: SalesPlanFactApiMeta;
  syncStatus: "api_ok" | "error";
  errorMessage?: string;
};

const CACHE_KEY = "tandoor-sales-plan-fact-state-cache-v1";

function demoHeaders(userId: string): HeadersInit {
  return { "X-Tandoor-Demo-User-Id": userId, Accept: "application/json" };
}

function parseEnvelope(j: Record<string, unknown>): SalesPlanFactApiMeta {
  const storageMode = (["persistent", "server_memory", "not_configured"].includes(String(j.storageMode))
    ? j.storageMode
    : "server_memory") as SalesPlanFactStorageMode;
  return {
    success: Boolean(j.success),
    storageMode,
    state: normalizeSalesPlanFactState(j.state),
    updatedAt: typeof j.updatedAt === "string" || j.updatedAt === null ? (j.updatedAt as string | null) : null,
    message: typeof j.message === "string" ? j.message : undefined,
    code: typeof j.code === "string" ? j.code : undefined,
  };
}

function readCache(): SalesPlanFactPersistedState | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { state?: unknown };
    return normalizeSalesPlanFactState(p.state);
  } catch {
    return null;
  }
}

function writeCache(state: SalesPlanFactPersistedState, updatedAt: string | null): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ state, updatedAt }));
  } catch {
    /* ignore */
  }
}

export async function fetchSalesPlanFactState(profile: ReleaseDemoProfile): Promise<SalesPlanFactLoadResult> {
  const userId = profile.personaUserId.trim();
  const emptyMeta = (storageMode: SalesPlanFactStorageMode, message?: string): SalesPlanFactApiMeta => ({
    success: false,
    storageMode,
    state: createEmptySalesPlanFactState(),
    updatedAt: null,
    message,
  });

  try {
    const res = await fetch(`/api/sales-plan-fact/state?userId=${encodeURIComponent(userId)}`, {
      method: "GET",
      headers: demoHeaders(userId),
      credentials: "same-origin",
    });
    const text = await res.text();
    const json = JSON.parse(text) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(res.status));
    const meta = parseEnvelope(json);
    if (!meta.success) {
      return { meta, syncStatus: "error", errorMessage: meta.message ?? "Ошибка загрузки." };
    }
    writeCache(meta.state, meta.updatedAt);
    return { meta, syncStatus: "api_ok" };
  } catch {
    const cached = readCache();
    if (cached) {
      return {
        meta: {
          success: true,
          storageMode: "server_memory",
          state: cached,
          updatedAt: null,
          message: "Показан локальный кеш последней успешной загрузки (API недоступен).",
        },
        syncStatus: "api_ok",
      };
    }
    return {
      meta: emptyMeta("server_memory", "Сеть или API недоступны."),
      syncStatus: "error",
      errorMessage: "Сеть или API недоступны.",
    };
  }
}

export async function saveSalesPlanFactState(
  profile: ReleaseDemoProfile,
  state: SalesPlanFactPersistedState,
): Promise<SalesPlanFactLoadResult> {
  const userId = profile.personaUserId.trim();
  const next = normalizeSalesPlanFactState({
    ...state,
    version: 1,
    updatedBy: userId,
  });
  try {
    const res = await fetch("/api/sales-plan-fact/state", {
      method: "POST",
      headers: { ...demoHeaders(userId), "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ userId, state: next }),
    });
    const text = await res.text();
    const json = JSON.parse(text) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(res.status));
    const meta = parseEnvelope(json);
    if (!meta.success) {
      return { meta, syncStatus: "error", errorMessage: meta.message ?? "Ошибка сохранения." };
    }
    writeCache(meta.state, meta.updatedAt);
    return { meta, syncStatus: "api_ok" };
  } catch {
    writeCache(next, new Date().toISOString());
    return {
      meta: {
        success: false,
        storageMode: "server_memory",
        state: next,
        updatedAt: next.updatedAt,
        message: "Сохранено только в локальном кеше браузера (API недоступен).",
      },
      syncStatus: "error",
      errorMessage: "API недоступен, данные в локальном кеше.",
    };
  }
}
