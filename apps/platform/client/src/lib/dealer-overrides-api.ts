/**
 * HTTP API оверрайдов дилера (Postgres, prompt 113).
 */

import type { DealerOverrideRow, DealerTrainingRow } from "../../../shared/dealer-overrides-types";
import type { DealerOverrideField } from "../../../shared/dealer-overrides-types";

type ApiOk<T> = { success: true; data: T };
type ApiErr = { success: false; code?: string; message?: string };

export type DealerOverridesListData = {
  overrides: DealerOverrideRow[];
  training: DealerTrainingRow[];
  manual: { dealer_id: string; payload: Record<string, unknown>; created_by: string | null; created_at: string }[];
};

export type DealerOverrideGetData = {
  override: DealerOverrideRow | null;
  training: DealerTrainingRow | null;
};

export type DealerOverrideEventDto = {
  id: string;
  dealer_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchDealerOverridesList(dealerIds?: string[]): Promise<DealerOverridesListData | null> {
  const q =
    dealerIds && dealerIds.length > 0
      ? `?dealer_ids=${encodeURIComponent(dealerIds.join(","))}`
      : "";
  try {
    const res = await fetch(`/api/dealer-overrides/list${q}`, { credentials: "include", cache: "no-store" });
    const data = await parseJson<ApiOk<DealerOverridesListData> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data;
  } catch {
    return null;
  }
}

export async function fetchDealerOverride(dealerId: string): Promise<DealerOverrideGetData | null> {
  try {
    const res = await fetch(`/api/dealer-overrides/get?dealer_id=${encodeURIComponent(dealerId)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await parseJson<ApiOk<DealerOverrideGetData> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data;
  } catch {
    return null;
  }
}

export async function upsertDealerOverride(
  dealerId: string,
  fields: Partial<Record<DealerOverrideField, unknown>>,
): Promise<DealerOverrideRow | null> {
  try {
    const res = await fetch("/api/dealer-overrides/upsert", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealer_id: dealerId, fields }),
    });
    const data = await parseJson<ApiOk<{ override: DealerOverrideRow | null }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data.override;
  } catch {
    return null;
  }
}

export async function setDealerTraining(
  dealerId: string,
  partial: { product_training_done?: boolean; needs_new_employees_training?: boolean },
): Promise<DealerTrainingRow | null> {
  try {
    const res = await fetch("/api/dealer-overrides/set-training", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealer_id: dealerId, ...partial }),
    });
    const data = await parseJson<ApiOk<{ training: DealerTrainingRow | null }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data.training;
  } catch {
    return null;
  }
}

export async function trashDealer(dealerId: string): Promise<DealerOverrideRow | null> {
  try {
    const res = await fetch("/api/dealer-overrides/trash", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealer_id: dealerId }),
    });
    const data = await parseJson<ApiOk<{ override: DealerOverrideRow | null }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data.override;
  } catch {
    return null;
  }
}

export async function untrashDealer(dealerId: string): Promise<DealerOverrideRow | null> {
  try {
    const res = await fetch("/api/dealer-overrides/untrash", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealer_id: dealerId }),
    });
    const data = await parseJson<ApiOk<{ override: DealerOverrideRow | null }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data.override;
  } catch {
    return null;
  }
}

export async function createManualDealer(payload: {
  dealer_id?: string;
  payload: Record<string, unknown>;
}): Promise<{ dealer_id: string; payload: Record<string, unknown> } | null> {
  try {
    const res = await fetch("/api/dealer-overrides/create-manual", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseJson<ApiOk<{ dealer_id: string; payload: Record<string, unknown> }> | ApiErr>(res);
    if (!res.ok || !data.success) return null;
    return data.data;
  } catch {
    return null;
  }
}

export async function fetchDealerOverrideHistory(
  dealerId: string,
  field?: string,
): Promise<DealerOverrideEventDto[]> {
  const q = field
    ? `?dealer_id=${encodeURIComponent(dealerId)}&field=${encodeURIComponent(field)}`
    : `?dealer_id=${encodeURIComponent(dealerId)}`;
  try {
    const res = await fetch(`/api/dealer-overrides/history${q}`, { credentials: "include", cache: "no-store" });
    const data = await parseJson<ApiOk<DealerOverrideEventDto[]> | ApiErr>(res);
    if (!res.ok || !data.success) return [];
    return data.data;
  } catch {
    return [];
  }
}

export const DEALER_OVERRIDES_HYDRATED_EVENT = "tandoor-dealer-overrides-hydrated";

export function notifyDealerOverridesHydrated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEALER_OVERRIDES_HYDRATED_EVENT));
}
