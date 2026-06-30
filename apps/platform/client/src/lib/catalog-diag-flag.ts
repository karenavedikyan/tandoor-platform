/**
 * Диагностика каталога (Промт 4d): sticky hash/localStorage, без сетевых запросов.
 */

const STORAGE_KEY = "tandoor:diag-catalog";

function readHash(): string {
  if (typeof globalThis.window === "undefined") return "";
  return globalThis.window.location.hash ?? "";
}

function readSticky(): boolean {
  if (typeof globalThis.localStorage === "undefined") return false;
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSticky(on: boolean): void {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    if (on) globalThis.localStorage.setItem(STORAGE_KEY, "1");
    else globalThis.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Включён ли диаг-режим каталога (hash diag-catalog или sticky localStorage). */
export function isCatalogDiagEnabled(): boolean {
  const hash = readHash();

  if (hash.includes("diag-catalog-off")) {
    writeSticky(false);
    return false;
  }

  if (hash.includes("diag-catalog")) {
    writeSticky(true);
    return true;
  }

  return readSticky();
}
