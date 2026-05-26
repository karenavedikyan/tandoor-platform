import { useSyncExternalStore } from "react";

export type SaveStatus = {
  state: "saved" | "saving" | "error" | "offline";
  lastSavedAt: string | null;
  lastSavedAtServer: string | null;
  pendingChanges: number;
  lastError: string | null;
};

const INITIAL: SaveStatus = {
  state: "saved",
  lastSavedAt: null,
  lastSavedAtServer: null,
  pendingChanges: 0,
  lastError: null,
};

let status: SaveStatus = INITIAL;
let timeoutId: number | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setStatus(next: SaveStatus): void {
  status = next;
  emit();
}

function clearStaleTimer(): void {
  if (timeoutId != null && typeof window !== "undefined") {
    window.clearTimeout(timeoutId);
    timeoutId = null;
  }
}

function armStaleTimer(): void {
  if (typeof window === "undefined") return;
  clearStaleTimer();
  timeoutId = window.setTimeout(() => {
    if (status.state === "saving") {
      setStatus({
        ...status,
        state: "error",
        lastError: "Нет подтверждения сохранения более 30 секунд.",
      });
    }
  }, 30_000);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SaveStatus {
  return status;
}

export function useActualizationSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function markActualizationSaveStarted(options?: { incrementPending?: boolean }): void {
  const incrementPending = options?.incrementPending ?? true;
  setStatus({
    ...status,
    state: "saving",
    pendingChanges: status.pendingChanges + (incrementPending ? 1 : 0),
    lastError: null,
  });
  armStaleTimer();
}

export function markActualizationSaveSucceeded(serverUpdatedAt: string | null): void {
  clearStaleTimer();
  const now = new Date().toISOString();
  setStatus({
    state: "saved",
    lastSavedAt: serverUpdatedAt ?? now,
    lastSavedAtServer: serverUpdatedAt,
    pendingChanges: Math.max(0, status.pendingChanges - 1),
    lastError: null,
  });
}

export function markActualizationSaveFailed(error: string, options?: { offline?: boolean }): void {
  clearStaleTimer();
  setStatus({
    ...status,
    state: options?.offline ? "offline" : "error",
    lastError: error,
  });
}

export function hasUnsavedActualizationChanges(): boolean {
  return status.pendingChanges > 0 || status.state === "error" || status.state === "offline";
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => {
    markActualizationSaveFailed("Браузер offline. Данные не отправлены в облако.", { offline: true });
  });
}
