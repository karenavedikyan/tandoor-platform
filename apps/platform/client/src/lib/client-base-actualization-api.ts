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
import { me } from "@/lib/auth-api";
import {
  markActualizationSaveFailed,
  markActualizationSaveStarted,
  markActualizationSaveSucceeded,
} from "@/lib/client-base-actualization-save-status";

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
type ActualizationAuthUser = { id: string; role: string };
type QueuedActualizationSave = { userId: string; role: string | undefined; state: ActualizationState };

let authUserCache: { value: ActualizationAuthUser | null; expiresAt: number } | null = null;
let queuedSave: QueuedActualizationSave | null = null;
let onlineFlushRegistered = false;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeRoleForActualizationApi(role: string): string {
  switch (role) {
    case "director":
      return "sales_director";
    case "rop":
    case "regional_manager":
      return "team_lead";
    case "manager":
    case "marketer":
    case "analyst":
    case "admin":
    case "sales_director":
    case "team_lead":
      return role;
    case "sales_manager":
      return "manager";
    default:
      return role;
  }
}

async function resolveAuthUser(): Promise<ActualizationAuthUser | null> {
  try {
    const u = await me();
    if (!u || typeof u.id !== "string" || typeof u.role !== "string") return null;
    return { id: u.id, role: normalizeRoleForActualizationApi(u.role) };
  } catch {
    return null;
  }
}

async function getCachedAuthUser(): Promise<ActualizationAuthUser | null> {
  const now = Date.now();
  if (authUserCache && authUserCache.expiresAt > now) return authUserCache.value;
  const value = await resolveAuthUser();
  if (value) {
    authUserCache = { value, expiresAt: now + 60_000 };
  } else {
    authUserCache = null;
  }
  return value;
}

export function resetActualizationAuthCache(): void {
  authUserCache = null;
}

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

function demoHeaders(userId: string, role?: string): HeadersInit {
  const h: Record<string, string> = { "X-Tandoor-Demo-User-Id": userId, Accept: "application/json" };
  if (role) h["X-Tandoor-Demo-User-Role"] = role;
  return h;
}

async function postActualizationStateOnce(
  userId: string,
  role: string | undefined,
  state: ActualizationState,
): Promise<ActualizationLoadResult> {
  const res = await fetch("/api/actualization/state", {
    method: "POST",
    headers: { ...demoHeaders(userId, role), "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ userId, state }),
  });
  const text = await res.text();
  const json = JSON.parse(text) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(res.status));
  const meta = parseApiEnvelope(json);
  if (!meta.success) {
    return {
      meta,
      syncStatus: "error",
      errorMessage: meta.message ?? "Сервер вернул ошибку при сохранении состояния актуализации.",
    };
  }
  return { meta, syncStatus: "api_ok" };
}

async function postActualizationStateWithRetry(
  userId: string,
  role: string | undefined,
  state: ActualizationState,
): Promise<ActualizationLoadResult> {
  let lastError = "Сетевая ошибка";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await postActualizationStateOnce(userId, role, state);
      if (result.syncStatus === "api_ok" && result.meta.success) return result;
      lastError = result.errorMessage ?? result.meta.message ?? "Сервер вернул ошибку при сохранении состояния актуализации.";
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Сетевая ошибка";
    }
    if (attempt < 3) await delay(5_000);
  }
  throw new Error(lastError);
}

function ensureOnlineFlushListener(): void {
  if (onlineFlushRegistered || typeof window === "undefined") return;
  onlineFlushRegistered = true;
  window.addEventListener("online", () => {
    const q = queuedSave;
    if (!q) return;
    queuedSave = null;
    markActualizationSaveStarted({ incrementPending: false });
    void postActualizationStateWithRetry(q.userId, q.role, q.state)
      .then((result) => {
        if (result.syncStatus === "api_ok" && result.meta.success) {
          writeLocalCache({ userId: q.userId, state: result.meta.state, updatedAt: result.meta.updatedAt });
          markActualizationSaveSucceeded(result.meta.updatedAt);
        }
      })
      .catch((e: unknown) => {
        queuedSave = q;
        markActualizationSaveFailed(e instanceof Error ? e.message : "Сетевая ошибка", { offline: !navigator.onLine });
      });
  });
}

/**
 * Загрузка состояния актуализации для указанного userId (демо: тот же заголовок и query).
 * Нужен дашборду РОП/директора для объединения state менеджеров команды.
 */
export async function fetchActualizationStateByUserIdWithRole(
  userIdRaw: string,
  role?: string,
): Promise<ActualizationLoadResult> {
  const userId = userIdRaw.trim();
  const emptyMeta = (storageMode: ActualizationStorageMode, message?: string): ActualizationApiMeta => ({
    success: false,
    storageMode,
    state: createEmptyActualizationState(),
    updatedAt: null,
    message,
  });

  if (!userId) {
    return {
      meta: emptyMeta("server_memory", "Пустой userId."),
      syncStatus: "error",
      errorMessage: "Пустой userId.",
    };
  }

  try {
    const url = role
      ? `/api/actualization/state?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}`
      : `/api/actualization/state?userId=${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: demoHeaders(userId, role),
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
        errorMessage: meta.message ?? "Ошибка загрузки state.",
      };
    }
    return { meta, syncStatus: "api_ok" };
  } catch {
    return {
      meta: emptyMeta("server_memory", "Сеть или API недоступны."),
      syncStatus: "error",
      errorMessage: "Сеть или API недоступны.",
    };
  }
}

export async function fetchActualizationStateByUserId(userIdRaw: string): Promise<ActualizationLoadResult> {
  return fetchActualizationStateByUserIdWithRole(userIdRaw);
}

export async function loadActualizationState(profile: ReleaseDemoProfile): Promise<ActualizationLoadResult> {
  const auth = await getCachedAuthUser();
  const userId = auth?.id ?? profile.personaUserId.trim();
  const role = auth?.role;
  const r = await fetchActualizationStateByUserIdWithRole(userId, role);
  if (r.syncStatus === "api_ok" && r.meta.success) {
    writeLocalCache({ userId, state: r.meta.state, updatedAt: r.meta.updatedAt });
    return r;
  }
  if (r.syncStatus === "error") {
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
      ...r,
      errorMessage: r.errorMessage ?? "Сеть или API недоступны, локального кеша нет.",
    };
  }
  return r;
}

export async function saveActualizationState(
  profile: ReleaseDemoProfile,
  state: ActualizationState,
): Promise<ActualizationLoadResult> {
  const auth = await getCachedAuthUser();
  const userId = auth?.id ?? profile.personaUserId.trim();
  const role = auth?.role;
  const next: ActualizationState = {
    ...state,
    version: ACTUALIZATION_STATE_VERSION,
    updatedBy: userId,
  };
  ensureOnlineFlushListener();
  markActualizationSaveStarted();
  try {
    const result = await postActualizationStateWithRetry(userId, role, next);
    writeLocalCache({ userId, state: result.meta.state, updatedAt: result.meta.updatedAt });
    markActualizationSaveSucceeded(result.meta.updatedAt);
    return result;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Сетевая ошибка";
    queuedSave = { userId, role, state: next };
    markActualizationSaveFailed(errorMessage, { offline: typeof navigator !== "undefined" && !navigator.onLine });
    writeLocalCache({ userId, state: next, updatedAt: new Date().toISOString() });
    return {
      meta: {
        success: false,
        storageMode: "local_fallback",
        state: next,
        updatedAt: next.updatedAt,
        message: `Сохранено только локально (API недоступен). ${errorMessage}`,
      },
      syncStatus: "local_fallback",
      errorMessage,
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
