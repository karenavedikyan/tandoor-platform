import { useCallback, useSyncExternalStore } from "react";
import { useHashLocation as useWouterHashLocation } from "wouter/use-hash-location";

/**
 * Query-aware hash location hook для wouter.
 *
 * Стандартный useHashLocation возвращает весь hash после "#", включая query-string.
 * Это ломает Route matching: <Route path="/distribution"> не матчится при hash =
 * "#/distribution?de_axis=tradePoint", потому что wouter сравнивает с "/distribution?de_axis=tradePoint".
 *
 * Этот хук:
 * - возвращает loc БЕЗ query (только pathname часть, для Route matching);
 * - setLoc принимает либо чистый path, либо path с ?query — оба прокидывает в нижний useHashLocation;
 * - реактивно реагирует на изменения hash (через нижний хук).
 */
export function useHashLocation(): [string, (to: string) => void] {
  const [rawLoc, setRawLoc] = useWouterHashLocation();
  const pathOnly = stripQuery(rawLoc);
  const setLoc = useCallback(
    (to: string) => {
      setRawLoc(to);
    },
    [setRawLoc],
  );
  return [pathOnly, setLoc];
}

/**
 * Возвращает query-string часть текущего hash как URLSearchParams.
 * Реактивно реагирует на изменения hash (subscribe к hashchange).
 */
export function useHashQuery(): URLSearchParams {
  const queryString = useSyncExternalStore(subscribeHashChange, getHashQueryString, getHashQueryString);
  return new URLSearchParams(queryString);
}

export function subscribeHashChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

export function getHashQueryString(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash;
  const noPrefix = hash.startsWith("#") ? hash.slice(1) : hash;
  const qIdx = noPrefix.indexOf("?");
  return qIdx === -1 ? "" : noPrefix.slice(qIdx + 1);
}

export function stripQuery(loc: string): string {
  const qIdx = loc.indexOf("?");
  if (qIdx === -1) return loc;
  return loc.slice(0, qIdx);
}

/**
 * Утилита для записи hash с path + query.
 * Пример: buildHashWithQuery("/distribution", { de_axis: "tradePoint" }) → "/distribution?de_axis=tradePoint"
 */
export function buildHashWithQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Programmatic navigation with query kept inside hash (not in location.search).
 * Wouter's useHashLocation navigate splits `path?query` and moves query to search;
 * pages that read via useHashQuery must use this helper instead.
 */
export function navigateHashPathInHash(to: string, options?: { replace?: boolean }): void {
  if (typeof window === "undefined") return;
  const oldURL = window.location.href;
  const stripped = to.replace(/^#/, "");
  const hashPath = stripped.startsWith("/") ? stripped : `/${stripped}`;

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = hashPath;

  if (options?.replace) {
    window.history.replaceState(window.history.state, "", url.href);
  } else {
    window.history.pushState(window.history.state, "", url.href);
  }

  const newURL = url.href;
  const event =
    typeof HashChangeEvent !== "undefined"
      ? new HashChangeEvent("hashchange", { oldURL, newURL })
      : new Event("hashchange");
  window.dispatchEvent(event);
}
