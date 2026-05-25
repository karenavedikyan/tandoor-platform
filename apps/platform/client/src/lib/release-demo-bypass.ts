/**
 * Флаги «релиз-демо» без mock-auth: обход реальной сессии только для страниц `/release-one*`.
 * Не использовать для production-входа.
 */

export const RELEASE_DEMO_BYPASS_STORAGE_KEY = "tandoor-release-demo-bypass";

export function isDemoAuthBypassEnabled(): boolean {
  if (import.meta.env.VITE_RELEASE_DEMO === "true") return true;
  if (import.meta.env.VITE_TANDOOR_DEMO_AUTH === "1") return true;
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("demo") === "1") return true;
  try {
    return window.localStorage.getItem(RELEASE_DEMO_BYPASS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
