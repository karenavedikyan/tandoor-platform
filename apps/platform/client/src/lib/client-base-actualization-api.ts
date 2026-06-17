/**
 * Клиентский слой для GET/POST /api/actualization/state + локальный fallback.
 */

import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import {
  ACTUALIZATION_STATE_VERSION,
  createEmptyActualizationState,
  mergeActualizationState,
  normalizeActualizationStateShowcases,
  type ActualizationState,
} from "./client-base-actualization-state.js";
import { me } from "./auth-api.js";
import {
  markActualizationSaveFailed,
  markActualizationSaveStarted,
  markActualizationSaveSucceeded,
} from "./client-base-actualization-save-status.js";
import { invalidateTeamActualizationCache } from "./client-base-team-actualization-cache.js";

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

export type ActualizationBatchPart = {
  userId: string;
  meta: ActualizationApiMeta;
  syncStatus: ActualizationSyncStatus;
  errorMessage?: string;
};

const BATCH_USER_IDS_CHUNK = 100;
const BATCH_URL_SAFE_LEN = 1800;

function normalizeState(raw: unknown): ActualizationState {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return createEmptyActualizationState();
  }
  return normalizeActualizationStateShowcases(
    mergeActualizationState(createEmptyActualizationState(), raw as Partial<ActualizationState>),
  );
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

/** Опциональная директива «явное восстановление/окончательное удаление» для корзины (Промт 45 B1). */
export type ActualizationUnTrashDirective = {
  dealers?: string[];
  tradePoints?: string[];
};

type QueuedActualizationSave = {
  userId: string;
  role: string | undefined;
  state: ActualizationState;
  unTrash?: ActualizationUnTrashDirective;
};

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
      return "team_lead";
    case "regional_manager":
      return "regional_manager";
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
  unTrash?: ActualizationUnTrashDirective,
): Promise<ActualizationLoadResult> {
  const payload: Record<string, unknown> = { userId, state };
  if (unTrash && (unTrash.dealers?.length || unTrash.tradePoints?.length)) {
    payload.unTrash = {
      dealers: unTrash.dealers ?? [],
      tradePoints: unTrash.tradePoints ?? [],
    };
  }
  const res = await fetch("/api/actualization/state", {
    method: "POST",
    headers: { ...demoHeaders(userId, role), "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
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
  unTrash?: ActualizationUnTrashDirective,
): Promise<ActualizationLoadResult> {
  let lastError = "Сетевая ошибка";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await postActualizationStateOnce(userId, role, state, unTrash);
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
    void postActualizationStateWithRetry(q.userId, q.role, q.state, q.unTrash)
      .then((result) => {
        if (result.syncStatus === "api_ok" && result.meta.success) {
          writeLocalCache({ userId: q.userId, state: result.meta.state, updatedAt: result.meta.updatedAt });
          markActualizationSaveSucceeded(result.meta.updatedAt);
          invalidateTeamActualizationCache();
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

function dedupeSanitizedUserIds(userIds: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of userIds) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function chunkUserIdsForBatchUrl(userIds: string[]): string[][] {
  if (userIds.length === 0) return [];
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentLen = 0;
  for (const id of userIds) {
    const addLen = (current.length > 0 ? 1 : 0) + encodeURIComponent(id).length;
    if (current.length >= BATCH_USER_IDS_CHUNK || (currentLen + addLen > BATCH_URL_SAFE_LEN && current.length > 0)) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(id);
    currentLen += addLen;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function parseBatchEnvelopePart(
  userId: string,
  part: Record<string, unknown>,
  envelope: Record<string, unknown>,
): ActualizationBatchPart {
  const storageMode = (["persistent", "server_memory", "local_fallback", "not_configured"].includes(
    String(envelope.storageMode),
  )
    ? envelope.storageMode
    : "server_memory") as ActualizationStorageMode;
  const envelopeSuccess = Boolean(envelope.success);
  const state = normalizeState(part.state);
  const updatedAt =
    typeof part.updatedAt === "string" || part.updatedAt === null ? (part.updatedAt as string | null) : null;
  const success = envelopeSuccess && part.state != null;
  return {
    userId,
    meta: {
      success,
      storageMode,
      state,
      updatedAt,
      message: typeof envelope.message === "string" ? envelope.message : undefined,
      code: typeof envelope.code === "string" ? envelope.code : undefined,
    },
    syncStatus: success ? "api_ok" : "error",
    errorMessage: success ? undefined : (typeof envelope.message === "string" ? envelope.message : "Ошибка загрузки state."),
  };
}

function errorBatchParts(userIds: string[], message: string): ActualizationBatchPart[] {
  const meta: ActualizationApiMeta = {
    success: false,
    storageMode: "server_memory",
    state: createEmptyActualizationState(),
    updatedAt: null,
    message,
  };
  return userIds.map((userId) => ({
    userId,
    meta,
    syncStatus: "error" as const,
    errorMessage: message,
  }));
}

async function fetchActualizationStateByUserIdsBatchChunk(
  userIds: string[],
  role?: string,
): Promise<ActualizationBatchPart[]> {
  if (userIds.length === 0) return [];
  const csv = userIds.map((id) => encodeURIComponent(id)).join(",");
  const url = role
    ? `/api/actualization/state?userIds=${csv}&role=${encodeURIComponent(role)}`
    : `/api/actualization/state?userIds=${csv}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: demoHeaders(userIds[0]!, role),
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
    const rawParts = json.parts;
    if (!Array.isArray(rawParts)) {
      throw new Error("no_parts");
    }
    const byUserId = new Map<string, Record<string, unknown>>();
    for (const p of rawParts) {
      if (p && typeof p === "object" && !Array.isArray(p)) {
        const row = p as Record<string, unknown>;
        const uid = typeof row.userId === "string" ? row.userId.trim() : "";
        if (uid) byUserId.set(uid, row);
      }
    }
    return userIds.map((id) => parseBatchEnvelopePart(id, byUserId.get(id) ?? { state: null }, json));
  } catch {
    return errorBatchParts(userIds, "Сеть или API недоступны.");
  }
}

/** Batch-загрузка state для списка userId (один HTTP на чанк). */
export async function fetchActualizationStateByUserIdsBatch(
  userIds: readonly string[],
  role?: string,
): Promise<ActualizationBatchPart[]> {
  const ids = dedupeSanitizedUserIds(userIds);
  if (ids.length === 0) return [];
  const chunks = chunkUserIdsForBatchUrl(ids);
  const merged: ActualizationBatchPart[] = [];
  const chunkResults = await Promise.all(chunks.map((chunk) => fetchActualizationStateByUserIdsBatchChunk(chunk, role)));
  for (const part of chunkResults) {
    merged.push(...part);
  }
  return merged;
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
  extra?: { unTrash?: ActualizationUnTrashDirective },
): Promise<ActualizationLoadResult> {
  const auth = await getCachedAuthUser();
  const userId = auth?.id ?? profile.personaUserId.trim();
  const role = auth?.role;
  const next: ActualizationState = {
    ...state,
    version: ACTUALIZATION_STATE_VERSION,
    updatedBy: userId,
  };
  const unTrash = extra?.unTrash;
  ensureOnlineFlushListener();
  markActualizationSaveStarted();
  try {
    const result = await postActualizationStateWithRetry(userId, role, next, unTrash);
    writeLocalCache({ userId, state: result.meta.state, updatedAt: result.meta.updatedAt });
    markActualizationSaveSucceeded(result.meta.updatedAt);
    if (result.syncStatus === "api_ok" && result.meta.success) {
      invalidateTeamActualizationCache();
    }
    return result;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Сетевая ошибка";
    queuedSave = { userId, role, state: next, unTrash };
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
