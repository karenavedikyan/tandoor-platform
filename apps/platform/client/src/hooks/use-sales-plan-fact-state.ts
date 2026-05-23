import { useCallback, useEffect, useState } from "react";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { fetchSalesPlanFactState, saveSalesPlanFactState } from "@/lib/sales-plan-fact-api";
import { createEmptySalesPlanFactState, normalizeSalesPlanFactState, type SalesPlanFactPersistedState } from "@/lib/sales-plan-fact-types";

export function useSalesPlanFactPersistedState(profile: ReleaseDemoProfile) {
  const [state, setState] = useState<SalesPlanFactPersistedState>(() => createEmptySalesPlanFactState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await fetchSalesPlanFactState(profile);
    setStorageMessage(r.meta.message ?? null);
    if (r.syncStatus === "api_ok" && r.meta.success) {
      setState(normalizeSalesPlanFactState(r.meta.state));
    } else {
      setError(r.errorMessage ?? "Не удалось загрузить данные.");
      setState(normalizeSalesPlanFactState(r.meta.state));
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const persist = useCallback(
    async (next: SalesPlanFactPersistedState) => {
      setSaving(true);
      setError(null);
      const normalized = normalizeSalesPlanFactState(next);
      setState(normalized);
      const r = await saveSalesPlanFactState(profile, normalized);
      setStorageMessage(r.meta.message ?? null);
      if (r.syncStatus === "error" || !r.meta.success) {
        setError(r.errorMessage ?? "Ошибка сохранения.");
      } else {
        setState(normalizeSalesPlanFactState(r.meta.state));
      }
      setSaving(false);
      return r;
    },
    [profile],
  );

  return { state, setState, loading, saving, error, storageMessage, reload, persist };
}
