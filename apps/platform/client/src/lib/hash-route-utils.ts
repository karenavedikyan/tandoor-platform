import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

/**
 * Сборка URL для hash-router (wouter useHashLocation): query до `#`, путь в hash.
 * Пример: buildHashPath("/dealer-base", { team: "team-x", quick: "attention" })
 * → "/?team=team-x&quick=attention#/dealer-base"
 */
export function buildHashPath(
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const sp = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "boolean") sp.set(k, v ? "1" : "0");
      else sp.set(k, String(v));
    }
  }
  const q = sp.toString();
  const prefix = q ? `/?${q}` : "/";
  return `${prefix}#${cleanPath}`;
}

/** Читает query из полноценного URL (часть до hash). */
export function readRouteQuery(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
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
