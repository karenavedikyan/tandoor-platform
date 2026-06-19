import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type HashRouteParams = Record<string, string | number | boolean | null | undefined>;

function hashRouteQueryString(params?: HashRouteParams): string {
  const sp = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "boolean") sp.set(k, v ? "1" : "0");
      else sp.set(k, String(v));
    }
  }
  return sp.toString();
}

/**
 * Путь для `<Link>` в hash-router (wouter + useHashLocation): сначала путь, затем query.
 * Внутри wouter `navigate` превращает это в адрес вида `?query#/path` (query до `#`, маршрут в hash).
 *
 * Пример: buildHashPath("/dealer-base", { team: "team-x", quick: "attention" })
 * → "/dealer-base?team=team-x&quick=attention"
 */
export function buildHashPath(path: string, params?: HashRouteParams): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const q = hashRouteQueryString(params);
  return q ? `${cleanPath}?${q}` : cleanPath;
}

/**
 * Полный относительный URL для обычного `<a href>` (в т.ч. «Открыть в новой вкладке»): query до `#`, маршрут в hash.
 * Пример: buildBrowserHashAppHref("/dealer-base", { team: "team-x", quick: "attention" })
 * → "/?team=team-x&quick=attention#/dealer-base"
 */
export function buildBrowserHashAppHref(path: string, params?: HashRouteParams): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const q = hashRouteQueryString(params);
  const prefix = q ? `/?${q}` : "/";
  return `${prefix}#${cleanPath}`;
}

/** Читает query из полноценного URL (часть до hash). */
export function readRouteQuery(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

/**
 * Читает query-параметры, объединяя:
 *  1. `window.location.search` (стандартный query до `#`)
 *  2. `window.location.hash` part после `?` (например `#/distribution?view=analytics`)
 * Hash-секция имеет приоритет.
 */
export function readHashRouteQuery(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const sp = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  const qIdx = hash.indexOf("?");
  if (qIdx >= 0) {
    const hashSp = new URLSearchParams(hash.slice(qIdx + 1));
    for (const [k, v] of hashSp.entries()) sp.set(k, v);
  }
  return sp;
}

/**
 * Реагирует на смену hash и на изменение search (например после клика по Link с buildHashPath).
 */
export function useRouteSearchParams(): URLSearchParams {
  const [loc] = useLocation();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener("hashchange", bump);
    window.addEventListener("popstate", bump);
    return () => {
      window.removeEventListener("hashchange", bump);
      window.removeEventListener("popstate", bump);
    };
  }, []);
  return useMemo(() => readRouteQuery(), [loc, tick]);
}

/**
 * React-хук, реактивно отдающий объединённые query-параметры (search + hash).
 */
export function useHashRouteSearchParams(): URLSearchParams {
  const [loc] = useLocation();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener("hashchange", bump);
    window.addEventListener("popstate", bump);
    return () => {
      window.removeEventListener("hashchange", bump);
      window.removeEventListener("popstate", bump);
    };
  }, []);
  return useMemo(() => readHashRouteQuery(), [loc, tick]);
}

/**
 * Обновляет один query-параметр внутри hash-секции (после `?`), сохраняя путь.
 * Если value === null → удаляет ключ.
 * Использует history.replaceState чтобы не плодить записи в истории браузера.
 * Бросает событие hashchange чтобы useHashRouteSearchParams реагировал.
 */
export function updateHashRouteParam(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  const hash = window.location.hash || "#/";
  const qIdx = hash.indexOf("?");
  const hashBase = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
  const sp = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : "");
  if (value === null) sp.delete(key);
  else sp.set(key, value);
  const qs = sp.toString();
  const nextHash = qs ? `${hashBase}?${qs}` : hashBase;
  if (nextHash === window.location.hash) return;
  window.history.replaceState(null, "", `${window.location.search}${nextHash}`);
  const HashChange = window.HashChangeEvent ?? Event;
  window.dispatchEvent(new HashChange("hashchange"));
}
