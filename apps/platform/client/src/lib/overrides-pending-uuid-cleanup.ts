/**
 * One-shot очистка застрявших pending-sync с legacy persona-кодами (Промт 114.4).
 */

import {
  purgeStaleDeadPendingSync,
  removePendingSyncWithUuidErrors,
} from "./overrides-pending-sync.js";

const CLEANUP_FLAG_PREFIX = "tandoor-pending-sync-cleanup-uuid-v1-";

function cleanupFlagKey(userId: string): string {
  return `${CLEANUP_FLAG_PREFIX}${userId}`;
}

export function runPendingSyncUuidCleanupOnLogin(userId: string | undefined): number {
  if (!userId || typeof window === "undefined" || !window.localStorage) return 0;
  const key = cleanupFlagKey(userId);
  if (window.localStorage.getItem(key) === "1") {
    purgeStaleDeadPendingSync();
    return 0;
  }
  const removed = removePendingSyncWithUuidErrors();
  purgeStaleDeadPendingSync();
  window.localStorage.setItem(key, "1");
  if (removed > 0) {
    console.warn("[overrides-pending-sync] removed stuck UUID pending items", { userId, removed });
  }
  return removed;
}
