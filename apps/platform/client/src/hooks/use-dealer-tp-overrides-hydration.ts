import { useEffect, useRef } from "react";
import { DEALER_OVERRIDES_HYDRATED_EVENT } from "@/lib/dealer-overrides-api";
import { TRADE_POINT_OVERRIDES_HYDRATED_EVENT } from "@/lib/trade-point-overrides-api";
import { hydrateAllDealerAndTradePointOverrides } from "@/lib/dealer-overrides-sync";

let globalHydratePromise: Promise<void> | null = null;

function runGlobalHydrate(): Promise<void> {
  if (!globalHydratePromise) {
    globalHydratePromise = hydrateAllDealerAndTradePointOverrides().then(() => undefined);
  }
  return globalHydratePromise;
}

/**
 * Однократная подгрузка оверрайдов дилера и ТТ с API (Промт 113).
 */
export function useDealerTpOverridesHydration(enabled = true): { ready: boolean } {
  const started = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    void runGlobalHydrate().finally(() => {
      readyRef.current = true;
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const bump = () => {
      readyRef.current = true;
    };
    window.addEventListener(DEALER_OVERRIDES_HYDRATED_EVENT, bump);
    window.addEventListener(TRADE_POINT_OVERRIDES_HYDRATED_EVENT, bump);
    return () => {
      window.removeEventListener(DEALER_OVERRIDES_HYDRATED_EVENT, bump);
      window.removeEventListener(TRADE_POINT_OVERRIDES_HYDRATED_EVENT, bump);
    };
  }, [enabled]);

  return { ready: readyRef.current };
}
