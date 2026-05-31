import { useEffect, useRef, useState } from "react";
import { DEALER_OVERRIDES_HYDRATED_EVENT } from "@/lib/dealer-overrides-api";
import { TRADE_POINT_OVERRIDES_HYDRATED_EVENT } from "@/lib/trade-point-overrides-api";
import {
  hydrateAllDealerAndTradePointOverrides,
  hydrateDealerOverridesForDealer,
  hydrateTradePointOverridesForEntity,
} from "@/lib/dealer-overrides-sync";
import { isDealerOverridesHydrated, isTradePointOverridesHydrated } from "@/lib/dealer-overrides-runtime";

let globalHydratePromise: Promise<void> | null = null;

function runGlobalHydrate(): Promise<void> {
  if (!globalHydratePromise) {
    globalHydratePromise = hydrateAllDealerAndTradePointOverrides().then(() => undefined);
  }
  return globalHydratePromise;
}

export type DealerTpOverridesHydrationOpts = {
  enabled?: boolean;
  dealerId?: string;
  tpId?: string;
};

/**
 * Подгрузка оверрайдов дилера и ТТ с API (Промт 113 / 113.4).
 */
export function useDealerTpOverridesHydration(opts: boolean | DealerTpOverridesHydrationOpts = true): {
  ready: boolean;
  hydrationVersion: number;
} {
  const resolved: DealerTpOverridesHydrationOpts =
    typeof opts === "boolean" ? { enabled: opts } : opts;
  const enabled = resolved.enabled !== false;
  const dealerId = resolved.dealerId;
  const tpId = resolved.tpId;

  const [hydrationVersion, setHydrationVersion] = useState(0);
  const entityHydrated = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const bump = () => setHydrationVersion((n) => n + 1);
    window.addEventListener(DEALER_OVERRIDES_HYDRATED_EVENT, bump);
    window.addEventListener(TRADE_POINT_OVERRIDES_HYDRATED_EVENT, bump);
    return () => {
      window.removeEventListener(DEALER_OVERRIDES_HYDRATED_EVENT, bump);
      window.removeEventListener(TRADE_POINT_OVERRIDES_HYDRATED_EVENT, bump);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void runGlobalHydrate().then(() => setHydrationVersion((n) => n + 1));
  }, [enabled]);

  useEffect(() => {
    if (!enabled || entityHydrated.current) return;
    if (!dealerId && !tpId) return;
    entityHydrated.current = true;
    void (async () => {
      if (dealerId) await hydrateDealerOverridesForDealer(dealerId);
      if (tpId || dealerId) {
        await hydrateTradePointOverridesForEntity({ tpId, dealerId });
      }
      setHydrationVersion((n) => n + 1);
    })();
  }, [enabled, dealerId, tpId]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void runGlobalHydrate().then(() => setHydrationVersion((n) => n + 1));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled]);

  const ready =
    enabled &&
    (dealerId || tpId
      ? Boolean(dealerId && isDealerOverridesHydrated()) || Boolean(tpId && isTradePointOverridesHydrated())
      : isDealerOverridesHydrated() && isTradePointOverridesHydrated());

  return { ready, hydrationVersion };
}
