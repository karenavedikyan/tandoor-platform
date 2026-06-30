/**
 * Прогрев in-memory каталога (Промт 4): не на critical path dealer-base.
 */

import { useEffect, useState } from "react";
import { ensureCatalogLoaded, getCatalogProducts } from "./catalog-data.js";
import { isCatalogLazyLoadEnabled } from "./catalog-lazy-load-flag.js";

let backgroundWarmupScheduled = false;

function scheduleIdle(callback: () => void): void {
  if (typeof globalThis.requestIdleCallback === "function") {
    globalThis.requestIdleCallback(callback, { timeout: 3000 });
    return;
  }
  globalThis.setTimeout(callback, 1);
}

/** Фоновый прогрев после первого пейнта (только при CATALOG_LAZY_LOAD). */
export function scheduleCatalogBackgroundWarmup(): void {
  if (!isCatalogLazyLoadEnabled() || backgroundWarmupScheduled) return;
  backgroundWarmupScheduled = true;
  scheduleIdle(() => {
    void ensureCatalogLoaded().catch(() => {
      /* non-fatal: витрины могут остаться пустыми до повторного прогрева */
    });
  });
}

/** Прогрев на маунте поверхностей с каталогом; возвращает true, когда кэш готов. */
export function useCatalogReady(): boolean {
  const [ready, setReady] = useState(() => {
    if (!isCatalogLazyLoadEnabled()) return true;
    return getCatalogProducts().length > 0;
  });

  useEffect(() => {
    let cancelled = false;
    void ensureCatalogLoaded()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
