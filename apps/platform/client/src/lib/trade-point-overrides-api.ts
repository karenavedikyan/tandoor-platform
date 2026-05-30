/**
 * HTTP API оверрайдов торговых точек (Postgres, prompt 113).
 */

import type { TradePointOverrideRow, TradePointTrainingRow } from "../../../shared/trade-point-overrides-types";
import type { TradePointOverrideField } from "../../../shared/trade-point-overrides-types";

type ApiOk<T> = { success: true; data: T };
type ApiErr = { success: false; code?: string; message?: string };

export type TradePointOverridesListData = {
  overrides: TradePointOverrideRow[];
  training: TradePointTrainingRow[];
};

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchTradePointOverridesList(opts?: {
  tpIds?: string[];
  dealerId?: string;
}): Promise<TradePointOverridesListData | null> {
  const params = new URLSearchParams();
  if (opts?.tpIds?.length) params.set("tp_ids", opts.tpIds.join(","));
  else if (opts?.dealerId) params.set("dealer_id", opts.dealerId);
  const q = params.toString() ? `?${params}` : "";
  try {
    const res = await fetch(`/api/trade-point-overrides/list${q}`, { credentials: "include", cache: "no-store" });
    const data = await parseJson<ApiOk<TradePointOverridesListData> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data;
  } catch {
    return null;
  }
}

export async function fetchTradePointOverride(tpId: string): Promise<{
  override: TradePointOverrideRow | null;
  training: TradePointTrainingRow | null;
} | null> {
  try {
    const res = await fetch(`/api/trade-point-overrides/get?tp_id=${encodeURIComponent(tpId)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<
      ApiOk<{ override: TradePointOverrideRow | null; training: TradePointTrainingRow | null }> | ApiErr
    >(res);
    if (!res.ok || !data.success) return null;
    return data.data;
  } catch {
    return null;
  }
}

export async function upsertTradePointOverride(
  tpId: string,
  fields: Partial<Record<TradePointOverrideField, unknown>>,
  dealerId?: string,
): Promise<TradePointOverrideRow | null> {
  try {
    const res = await fetch("/api/trade-point-overrides/upsert", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tp_id: tpId, dealer_id: dealerId, fields }),
    });
    const data = await parseJson<ApiOk<{ override: TradePointOverrideRow | null }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data.override;
  } catch {
    return null;
  }
}

export async function setTradePointTraining(
  tpId: string,
  partial: { product_training_done?: boolean },
): Promise<TradePointTrainingRow | null> {
  try {
    const res = await fetch("/api/trade-point-overrides/set-training", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tp_id: tpId, ...partial }),
    });
    const data = await parseJson<ApiOk<{ training: TradePointTrainingRow | null }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data.training;
  } catch {
    return null;
  }
}

export async function trashTradePoint(tpId: string): Promise<TradePointOverrideRow | null> {
  try {
    const res = await fetch("/api/trade-point-overrides/trash", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tp_id: tpId }),
    });
    const data = await parseJson<ApiOk<{ override: TradePointOverrideRow | null }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data.override;
  } catch {
    return null;
  }
}

export async function untrashTradePoint(tpId: string): Promise<TradePointOverrideRow | null> {
  try {
    const res = await fetch("/api/trade-point-overrides/untrash", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tp_id: tpId }),
    });
    const data = await parseJson<ApiOk<{ override: TradePointOverrideRow | null }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data.override;
  } catch {
    return null;
  }
}

export const TRADE_POINT_OVERRIDES_HYDRATED_EVENT = "tandoor-trade-point-overrides-hydrated";

export function notifyTradePointOverridesHydrated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TRADE_POINT_OVERRIDES_HYDRATED_EVENT));
}
