/**
 * Клиентский слой для GET/POST /api/actualization/state + локальный fallback.
 */

import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  ACTUALIZATION_STATE_VERSION,
  createEmptyActualizationState,
  mergeActualizationState,
  type ActualizationState,
} from "@/lib/client-base-actualization-state";

export const ACTUALIZATION_STATE_CACHE_KEY = "tandoor-client-base-actualization-state-cache-v1";

export type ActualizationStorageMode = "persistent" | "server_memory" | "local_fallback" | "not_configured";

export type ActualizationApiMeta = {
  success: boolean;
  storageMode: ActualizationStorageMode;
  state: ActualizationState;
  updatedAt: string | null;
  message?: string;
  /** Код ошибки с сервера (например ACTUALIZATION_STORAGE_ERROR). */
  code?: string;
};

export type ActualizationSyncStatus = "api_ok" | "local_fallback" | "error";

export type ActualizationPersistResult = {
  success: boolean;
  syncStatus: ActualizationSyncStatus;
  storageMode: ActualizationStorageMode;
};

export type ActualizationLoadResult = {
  meta: ActualizationApiMeta;
  syncStatus: ActualizationSyncStatus;
  errorMessage?: string;
};

function normalizeState(raw: unknown): ActualizationState {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return createEmptyActualizationState();
  }
  return mergeActualizationState(createEmptyActualizationState(), raw as Partial<ActualizationState>);
}

function parseApiEnvelope(j: Record<string, unknown>): ActualizationApiMeta {
  const storageMode = (["persistent", "server_memory", "local_fallback", "not_configured"].includes(
    String(j.storageMode),
  )
    ? j.storageMode
    : "server_memory") as ActualizationStorageMode;
  return {
    success: Boolean(j.success),
    storageMode,
    state: normalizeState(j.state),
    updatedAt: typeof j.updatedAt === "string" || j.updatedAt === null ? (j.updatedAt as string | null) : null,
    message: typeof j.message === "string" ? j.message : undefined,
    code: typeof j.code === "string" ? j.code : undefined,
  };
}

type CacheRow = { userId: string; state: ActualizationState; updatedAt: string | null };

function readLocalCache(userId: string): CacheRow | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(ACTUALIZATION_STATE_CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<CacheRow>;
    if (p.userId !== userId || !p.state) return null;
    return { userId, state: normalizeState(p.state), updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : null };
  } catch {
    return null;
  }
}

function writeLocalCache(row: CacheRow): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(ACTUALIZATION_STATE_CACHE_KEY, JSON.stringify(row));
  } catch {
    /* ignore quota */
  }
}

function demoHeaders(userId: string): HeadersInit {
  return { "X-Tandoor-Demo-User-Id": userId, Accept: "application/json" };
}

export async function loadActualizationState(profile: ReleaseDemoProfile): Promise<ActualizationLoadResult> {
  const userId = profile.personaUserId.trim();
  const emptyMeta = (storageMode: ActualizationStorageMode, message?: string): ActualizationApiMeta => ({
    success: false,
    storageMode,
    state: createEmptyActualizationState(),
    updatedAt: null,
    message,
  });

  try {
    const res = await fetch(`/api/actualization/state?userId=${encodeURIComponent(userId)}`, {
      method: "GET",
      headers: demoHeaders(userId),
      credentials: "same-origin",
    });
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("not_json");
    }
    if (!res.ok) {
      throw new Error(String(res.status));
    }
    const meta = parseApiEnvelope(json);
    if (!meta.success) {
      return {
        meta,
        syncStatus: "error",
        errorMessage: meta.message ?? "Сервер вернул ошибку при загрузке состояния актуализации.",
      };
    }
    writeLocalCache({ userId, state: meta.state, updatedAt: meta.updatedAt });
    return { meta, syncStatus: "api_ok" };
  } catch {
    const cached = readLocalCache(userId);
    if (cached) {
      return {
        meta: {
          success: true,
          storageMode: "local_fallback",
          state: cached.state,
          updatedAt: cached.updatedAt,
          message:
            "Данные из локального кеша браузера. Это не замена серверной синхронизации между устройствами.",
        },
        syncStatus: "local_fallback",
      };
    }
    return {
      meta: emptyMeta("server_memory", "Не удалось загрузить состояние актуализации с сервера."),
      syncStatus: "error",
      errorMessage: "Сеть или API недоступны, локального кеша нет.",
    };
  }
}

export async function saveActualizationState(
  profile: ReleaseDemoProfile,
  state: ActualizationState,
): Promise<ActualizationLoadResult> {
  const userId = profile.personaUserId.trim();
  const next: ActualizationState = {
    ...state,
    version: ACTUALIZATION_STATE_VERSION,
    updatedBy: userId,
  };
  try {
    const res = await fetch("/api/actualization/state", {
      method: "POST",
      headers: { ...demoHeaders(userId), "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ userId, state: next }),
    });
    const text = await res.text();
    const json = JSON.parse(text) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(res.status));
    }
    const meta = parseApiEnvelope(json);
    if (!meta.success) {
      return {
        meta,
        syncStatus: "error",
        errorMessage: meta.message ?? "Сервер вернул ошибку при сохранении состояния актуализации.",
      };
    }
    writeLocalCache({ userId, state: meta.state, updatedAt: meta.updatedAt });
    return { meta, syncStatus: "api_ok" };
  } catch {
    writeLocalCache({ userId, state: next, updatedAt: new Date().toISOString() });
    return {
      meta: {
        success: false,
        storageMode: "local_fallback",
        state: next,
        updatedAt: next.updatedAt,
        message: "Сохранено только локально (API недоступен). Между устройствами не синхронизируется.",
      },
      syncStatus: "local_fallback",
    };
  }
}

export async function updateActualizationState(
  profile: ReleaseDemoProfile,
  updater: (prev: ActualizationState) => ActualizationState,
): Promise<ActualizationLoadResult> {
  const loaded = await loadActualizationState(profile);
  const next = updater(loaded.meta.state);
  return saveActualizationState(profile, next);
}
