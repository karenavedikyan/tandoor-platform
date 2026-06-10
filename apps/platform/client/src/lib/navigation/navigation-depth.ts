/**
 * Счётчик внутренней навигации SPA (hash + query) для useSmartBack.
 * Инкремент при push-переходах, декремент при popstate, без инкремента при replace.
 */

const SCROLL_STORAGE_PREFIX = "tandoor-nav-scroll:";

let inAppNavCount = 0;
let lastLocationKey = "";
let pendingPop = false;
let skipNextIncrement = false;
let initialized = false;

/** Полный in-app ключ: hash-путь + search (query до `#`). */
export function getInAppLocationKey(): string {
  if (typeof window === "undefined") return "/";
  const hashRaw = window.location.hash.replace(/^#?\/?/, "").trim();
  const path = hashRaw ? (hashRaw.startsWith("/") ? hashRaw : `/${hashRaw}`) : "/";
  const search = window.location.search ?? "";
  return `${path}${search}`;
}

export function getInternalNavDepth(): number {
  return inAppNavCount;
}

export function onPopState(): void {
  pendingPop = true;
  inAppNavCount = Math.max(0, inAppNavCount - 1);
}

export function markNextNavigationAsReplace(): void {
  skipNextIncrement = true;
}

function persistScrollForKey(key: string): void {
  if (typeof window === "undefined" || !key) return;
  try {
    sessionStorage.setItem(SCROLL_STORAGE_PREFIX + key, String(window.scrollY || 0));
  } catch {
    /* ignore quota / private mode */
  }
}

function restoreScrollForKey(key: string): void {
  if (typeof window === "undefined" || !key) return;
  try {
    const raw = sessionStorage.getItem(SCROLL_STORAGE_PREFIX + key);
    if (raw == null) return;
    const y = Number(raw);
    if (!Number.isFinite(y)) return;
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
    });
  } catch {
    /* ignore */
  }
}

export function saveScrollForCurrentLocation(): void {
  persistScrollForKey(getInAppLocationKey());
}

/** Синхронизировать счётчик с фактическим URL браузера (hash + search). */
export function syncInAppLocation(isSessionInit = false): void {
  const key = getInAppLocationKey();

  if (!initialized) {
    initialized = true;
    lastLocationKey = key;
    inAppNavCount = 0;
    return;
  }

  if (isSessionInit) {
    lastLocationKey = key;
    inAppNavCount = 0;
    return;
  }

  if (key === lastLocationKey) return;

  if (pendingPop) {
    pendingPop = false;
    lastLocationKey = key;
    restoreScrollForKey(key);
    return;
  }

  if (skipNextIncrement) {
    skipNextIncrement = false;
    lastLocationKey = key;
    return;
  }

  if (lastLocationKey) {
    persistScrollForKey(lastLocationKey);
  }

  inAppNavCount += 1;
  lastLocationKey = key;
}

/** @deprecated Используйте syncInAppLocation */
export function onLocationChange(newPath: string, isInitial = false): void {
  void newPath;
  syncInAppLocation(isInitial);
}
