import { useEffect, useMemo, useRef, useState } from "react";
import type { TradePointShowcaseActualization } from "@/lib/client-base-actualization-state";
import { fetchTradePointShowcaseBatch } from "@/lib/trade-point-showcase-shared-api";
import { SHOWCASE_MATRIX_STORE_CHANGED_EVENT } from "@/lib/showcase-matrix-store";

const FETCH_DEBOUNCE_MS = 120;
const pageCache = new Map<string, Record<string, TradePointShowcaseActualization>>();

function stableIdsKey(tradePointIds: readonly string[]): string {
  return [...new Set(tradePointIds.map((id) => id.trim()).filter(Boolean))].sort().join(",");
}

function recordsToMap(
  records: Awaited<ReturnType<typeof fetchTradePointShowcaseBatch>>,
): Record<string, TradePointShowcaseActualization> {
  const out: Record<string, TradePointShowcaseActualization> = {};
  for (const rec of records) {
    out[rec.tradePointId] = rec.data;
  }
  return out;
}

export function useTradePointShowcaseSharedStore(tradePointIds: readonly string[]): {
  ready: boolean;
  recordByTradePointId: Record<string, TradePointShowcaseActualization>;
} {
  const idsKey = useMemo(() => stableIdsKey(tradePointIds), [tradePointIds]);
  const [ready, setReady] = useState(() => pageCache.has(idsKey));
  const [recordByTradePointId, setRecordByTradePointId] = useState<Record<string, TradePointShowcaseActualization>>(
    () => pageCache.get(idsKey) ?? {},
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!idsKey) {
      setReady(true);
      setRecordByTradePointId({});
      return;
    }

    const cached = pageCache.get(idsKey);
    if (cached) {
      setRecordByTradePointId(cached);
      setReady(true);
    } else {
      setReady(false);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++requestSeqRef.current;

    debounceRef.current = setTimeout(() => {
      void (async () => {
        const records = await fetchTradePointShowcaseBatch(idsKey.split(","));
        if (requestSeqRef.current !== seq) return;
        const map = recordsToMap(records);
        pageCache.set(idsKey, map);
        setRecordByTradePointId(map);
        setReady(true);
      })();
    }, FETCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [idsKey]);

  useEffect(() => {
    const onInvalidate = () => {
      pageCache.delete(idsKey);
      requestSeqRef.current += 1;
      setReady(false);
      void (async () => {
        const records = await fetchTradePointShowcaseBatch(idsKey ? idsKey.split(",") : []);
        const map = recordsToMap(records);
        pageCache.set(idsKey, map);
        setRecordByTradePointId(map);
        setReady(true);
      })();
    };
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onInvalidate);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onInvalidate);
  }, [idsKey]);

  return { ready, recordByTradePointId };
}

export function __clearTradePointShowcaseSharedStoreCacheForTests(): void {
  pageCache.clear();
}
