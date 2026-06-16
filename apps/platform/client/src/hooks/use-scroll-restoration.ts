/**
 * Восстановление позиции скролла при возврате «Назад» (Промт 381).
 */

import { useLayoutEffect, useRef } from "react";
import { useLocation } from "wouter";

function storageKey(pathname: string, search: string): string {
  return `tandoor-scroll:${pathname}${search}`;
}

function readSaved(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function writeSaved(key: string, y: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, String(Math.max(0, Math.floor(y))));
  } catch {
    /* ignore quota */
  }
}

export type UseScrollRestorationOptions = {
  /** Дождаться готовности контента (данные загружены, список отрисован). */
  enabled?: boolean;
  /** Доп. ключ (например вкладка). */
  scope?: string;
};

/**
 * Сохраняет window.scrollY при уходе со страницы и восстанавливает при mount.
 */
export function useScrollRestoration(options?: UseScrollRestorationOptions): void {
  const enabled = options?.enabled ?? true;
  const scope = options?.scope ?? "";
  const [loc] = useLocation();
  const restoredRef = useRef(false);
  const keyRef = useRef("");

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const search = typeof window !== "undefined" ? window.location.search : "";
  const hashPath = loc.split("?")[0] ?? loc;
  const key = `${storageKey(pathname, search)}:${hashPath}${scope ? `:${scope}` : ""}`;
  keyRef.current = key;

  useLayoutEffect(() => {
    if (!enabled) return;
    restoredRef.current = false;
    const saved = readSaved(key);
    if (saved == null) return;

    const restore = () => {
      if (restoredRef.current) return;
      restoredRef.current = true;
      window.scrollTo({ top: saved, left: 0, behavior: "auto" });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(restore);
    });
  }, [key, enabled]);

  useLayoutEffect(() => {
    if (!enabled) return;

    const onScroll = () => {
      writeSaved(keyRef.current, window.scrollY);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      writeSaved(keyRef.current, window.scrollY);
    };
  }, [enabled, key]);
}
