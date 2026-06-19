import { useCallback, useEffect, useState } from "react";
import {
  fetchShowcaseDistributionState,
  SHOWCASE_DISTRIBUTION_CHANGED_EVENT,
  type ShowcaseStorageV1Dto,
} from "@/lib/showcase-distribution-api";

function emptyState(): ShowcaseStorageV1Dto {
  return { overrides: {}, taskUpdates: {}, historyByDealer: {}, recommendationTaskEntries: {} };
}

export function useShowcaseDistributionState(dealerId: string): {
  state: ShowcaseStorageV1Dto | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<ShowcaseStorageV1Dto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!dealerId.trim()) {
      setState(emptyState());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = await fetchShowcaseDistributionState(dealerId);
      setState(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
      setState(emptyState());
    } finally {
      setLoading(false);
    }
  }, [dealerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener(SHOWCASE_DISTRIBUTION_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SHOWCASE_DISTRIBUTION_CHANGED_EVENT, onChanged);
  }, [refresh]);

  return { state, loading, error, refresh };
}
