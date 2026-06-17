/**
 * HTTP API оверрайдов дилера (Postgres, prompt 113 / 113.1).
 */

import type { DealerOverrideRow, DealerTrainingRow } from "../../../shared/dealer-overrides-types";
import type { DealerOverrideField } from "../../../shared/dealer-overrides-types";
import {
  enqueuePendingSync,
  makePendingId,
  type PendingSyncKind,
} from "./overrides-pending-sync.js";
import { overridesApiPost, type OverridesApiResult } from "./overrides-api-result.js";
export {
  OVERRIDES_FORBIDDEN_OUT_OF_SCOPE_CODE,
  OVERRIDES_FORBIDDEN_OUT_OF_SCOPE_MESSAGE,
  isForbiddenOutOfScopeResult,
} from "./overrides-api-result.js";
import { sanitizeDealerOverrideFieldsForApi } from "./overrides-persona-fields.js";
import { traceOverridesStrictCalled } from "./overrides-strict-trace.js";
import { invalidateMyDealerScope } from "./dealers-my-scope-api.js";

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

function enqueueOnNetwork(kind: PendingSyncKind, dealerId: string, payload: unknown): void {
  enqueuePendingSync({
    id: makePendingId(kind, dealerId),
    kind,
    payload,
  });
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

export async function upsertDealerOverrideStrict(
  dealerId: string,
  fields: Partial<Record<DealerOverrideField, unknown>>,
): Promise<OverridesApiResult<{ override: DealerOverrideRow | null }>> {
  const sanitizedFields = sanitizeDealerOverrideFieldsForApi(fields);
  traceOverridesStrictCalled("upsertDealerOverrideStrict", { dealerId, fields: sanitizedFields });
  const body = { dealer_id: dealerId, fields: sanitizedFields };
  const r = await overridesApiPost<{ override: DealerOverrideRow | null }>({
    scope: "dealer",
    action: "upsert",
    url: "/api/dealer-overrides/upsert",
    entityId: dealerId,
    fields: sanitizedFields,
    body,
    traceFn: "upsertDealerOverrideStrict",
  });
  if (!r.ok && r.network) enqueueOnNetwork("dealer-upsert", dealerId, body);
  return r;
}

export async function upsertDealerOverride(
  dealerId: string,
  fields: Partial<Record<DealerOverrideField, unknown>>,
): Promise<DealerOverrideRow | null> {
  const r = await upsertDealerOverrideStrict(dealerId, fields);
  return r.ok ? r.data.override : null;
}

export async function setDealerTrainingStrict(
  dealerId: string,
  partial: { product_training_done?: boolean; needs_new_employees_training?: boolean },
): Promise<OverridesApiResult<{ training: DealerTrainingRow | null }>> {
  traceOverridesStrictCalled("setDealerTrainingStrict", { dealerId, fields: partial });
  const body = { dealer_id: dealerId, ...partial };
  const r = await overridesApiPost<{ training: DealerTrainingRow | null }>({
    scope: "dealer",
    action: "set-training",
    url: "/api/dealer-overrides/set-training",
    entityId: dealerId,
    fields: partial,
    body,
    traceFn: "setDealerTrainingStrict",
  });
  if (!r.ok && r.network) enqueueOnNetwork("dealer-training", dealerId, body);
  return r;
}

export async function setDealerTraining(
  dealerId: string,
  partial: { product_training_done?: boolean; needs_new_employees_training?: boolean },
): Promise<DealerTrainingRow | null> {
  const r = await setDealerTrainingStrict(dealerId, partial);
  return r.ok ? r.data.training : null;
}

export async function trashDealerStrict(dealerId: string): Promise<OverridesApiResult<{ override: DealerOverrideRow | null }>> {
  traceOverridesStrictCalled("trashDealerStrict", { dealerId });
  const body = { dealer_id: dealerId };
  const r = await overridesApiPost<{ override: DealerOverrideRow | null }>({
    scope: "dealer",
    action: "trash",
    url: "/api/dealer-overrides/trash",
    entityId: dealerId,
    body,
    traceFn: "trashDealerStrict",
  });
  if (!r.ok && r.network) enqueueOnNetwork("dealer-trash", dealerId, body);
  return r;
}

export async function trashDealer(dealerId: string): Promise<DealerOverrideRow | null> {
  const r = await trashDealerStrict(dealerId);
  return r.ok ? r.data.override : null;
}

export async function untrashDealerStrict(dealerId: string): Promise<OverridesApiResult<{ override: DealerOverrideRow | null }>> {
  traceOverridesStrictCalled("untrashDealerStrict", { dealerId });
  const body = { dealer_id: dealerId };
  const r = await overridesApiPost<{ override: DealerOverrideRow | null }>({
    scope: "dealer",
    action: "untrash",
    url: "/api/dealer-overrides/untrash",
    entityId: dealerId,
    body,
    traceFn: "untrashDealerStrict",
  });
  if (!r.ok && r.network) enqueueOnNetwork("dealer-untrash", dealerId, body);
  return r;
}

export async function untrashDealer(dealerId: string): Promise<DealerOverrideRow | null> {
  const r = await untrashDealerStrict(dealerId);
  return r.ok ? r.data.override : null;
}

async function postDealerPurgeAction<T>(
  action: string,
  body: Record<string, unknown>,
  traceFn: string,
): Promise<OverridesApiResult<T>> {
  const dealerId = typeof body.dealer_id === "string" ? body.dealer_id : undefined;
  const r = await overridesApiPost<T>({
    scope: "dealer",
    action,
    url: `/api/dealer-overrides/${action}`,
    entityId: dealerId,
    body,
    traceFn,
  });
  if (r.ok) invalidateMyDealerScope();
  return r;
}

export async function requestPurgeDealerStrict(
  dealerId: string,
): Promise<OverridesApiResult<{ override: DealerOverrideRow | null }>> {
  traceOverridesStrictCalled("requestPurgeDealerStrict", { dealerId });
  return postDealerPurgeAction("request-purge", { dealer_id: dealerId }, "requestPurgeDealerStrict");
}

export async function requestPurgeDealer(dealerId: string): Promise<DealerOverrideRow | null> {
  const r = await requestPurgeDealerStrict(dealerId);
  return r.ok ? r.data.override : null;
}

export async function restoreDealerStrict(
  dealerId: string,
  target: "employee_trash" | "active" = "employee_trash",
): Promise<OverridesApiResult<{ override: DealerOverrideRow | null }>> {
  traceOverridesStrictCalled("restoreDealerStrict", { dealerId, target });
  return postDealerPurgeAction("restore", { dealer_id: dealerId, target }, "restoreDealerStrict");
}

export async function restoreDealer(
  dealerId: string,
  target: "employee_trash" | "active" = "employee_trash",
): Promise<DealerOverrideRow | null> {
  const r = await restoreDealerStrict(dealerId, target);
  return r.ok ? r.data.override : null;
}

export async function purgeDealerStrict(
  dealerId: string,
): Promise<OverridesApiResult<{ override: DealerOverrideRow | null }>> {
  traceOverridesStrictCalled("purgeDealerStrict", { dealerId });
  return postDealerPurgeAction("purge", { dealer_id: dealerId }, "purgeDealerStrict");
}

export async function purgeDealer(dealerId: string): Promise<DealerOverrideRow | null> {
  const r = await purgeDealerStrict(dealerId);
  return r.ok ? r.data.override : null;
}

export async function adminRestoreDealerStrict(
  dealerId: string,
): Promise<OverridesApiResult<{ override: DealerOverrideRow | null }>> {
  traceOverridesStrictCalled("adminRestoreDealerStrict", { dealerId });
  return postDealerPurgeAction("admin-restore", { dealer_id: dealerId }, "adminRestoreDealerStrict");
}

export async function adminRestoreDealer(dealerId: string): Promise<DealerOverrideRow | null> {
  const r = await adminRestoreDealerStrict(dealerId);
  return r.ok ? r.data.override : null;
}

export async function createManualDealerStrict(payload: {
  dealer_id?: string;
  payload: Record<string, unknown>;
}): Promise<OverridesApiResult<{ dealer_id: string; payload: Record<string, unknown> }>> {
  traceOverridesStrictCalled("createManualDealerStrict", { dealerId: payload.dealer_id, args: payload });
  const r = await overridesApiPost<{ dealer_id: string; payload: Record<string, unknown> }>({
    scope: "dealer",
    action: "create-manual",
    url: "/api/dealer-overrides/create-manual",
    entityId: payload.dealer_id,
    body: payload,
    traceFn: "createManualDealerStrict",
  });
  if (!r.ok && r.network) {
    enqueueOnNetwork("manual-dealer", payload.dealer_id ?? "new", payload);
  }
  return r;
}

export async function createManualDealer(payload: {
  dealer_id?: string;
  payload: Record<string, unknown>;
}): Promise<{ dealer_id: string; payload: Record<string, unknown> } | null> {
  const r = await createManualDealerStrict(payload);
  return r.ok ? r.data : null;
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
