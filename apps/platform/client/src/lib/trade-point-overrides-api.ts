/**
 * HTTP API оверрайдов торговых точек (Postgres, prompt 113 / 113.1).
 */

import type { TradePointOverrideRow, TradePointTrainingRow } from "../../../shared/trade-point-overrides-types";
import type { TradePointOverrideField } from "../../../shared/trade-point-overrides-types";
import { enqueuePendingSync, makePendingId } from "./overrides-pending-sync.js";
import { overridesApiPost, type OverridesApiResult } from "./overrides-api-result.js";
export {
  OVERRIDES_FORBIDDEN_OUT_OF_SCOPE_CODE,
  OVERRIDES_FORBIDDEN_OUT_OF_SCOPE_MESSAGE,
  isForbiddenOutOfScopeResult,
} from "./overrides-api-result.js";
import { sanitizeTradePointOverrideFieldsForApi } from "./overrides-persona-fields.js";
import { traceOverridesStrictCalled } from "./overrides-strict-trace.js";
import { invalidateMyDealerScope } from "./dealers-my-scope-api.js";

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

export async function upsertTradePointOverrideStrict(
  tpId: string,
  fields: Partial<Record<TradePointOverrideField, unknown>>,
  dealerId?: string,
): Promise<OverridesApiResult<{ override: TradePointOverrideRow | null }>> {
  const sanitizedFields = sanitizeTradePointOverrideFieldsForApi(fields);
  traceOverridesStrictCalled("upsertTradePointOverrideStrict", { tpId, dealerId, fields: sanitizedFields });
  const body = { tp_id: tpId, dealer_id: dealerId, fields: sanitizedFields };
  const r = await overridesApiPost<{ override: TradePointOverrideRow | null }>({
    scope: "trade-point",
    action: "upsert",
    url: "/api/trade-point-overrides/upsert",
    entityId: tpId,
    fields: sanitizedFields,
    body,
    traceFn: "upsertTradePointOverrideStrict",
  });
  if (!r.ok && r.network) {
    enqueuePendingSync({
      id: makePendingId("tp-upsert", tpId),
      kind: "tp-upsert",
      payload: body,
    });
  }
  return r;
}

export async function upsertTradePointOverride(
  tpId: string,
  fields: Partial<Record<TradePointOverrideField, unknown>>,
  dealerId?: string,
): Promise<TradePointOverrideRow | null> {
  const r = await upsertTradePointOverrideStrict(tpId, fields, dealerId);
  return r.ok ? r.data.override : null;
}

export async function setTradePointTrainingStrict(
  tpId: string,
  partial: { product_training_done?: boolean },
): Promise<OverridesApiResult<{ training: TradePointTrainingRow | null }>> {
  traceOverridesStrictCalled("setTradePointTrainingStrict", { tpId, fields: partial });
  const body = { tp_id: tpId, ...partial };
  const r = await overridesApiPost<{ training: TradePointTrainingRow | null }>({
    scope: "trade-point",
    action: "set-training",
    url: "/api/trade-point-overrides/set-training",
    entityId: tpId,
    fields: partial,
    body,
    traceFn: "setTradePointTrainingStrict",
  });
  if (!r.ok && r.network) {
    enqueuePendingSync({ id: makePendingId("tp-training", tpId), kind: "tp-training", payload: body });
  }
  return r;
}

export async function setTradePointTraining(
  tpId: string,
  partial: { product_training_done?: boolean },
): Promise<TradePointTrainingRow | null> {
  const r = await setTradePointTrainingStrict(tpId, partial);
  return r.ok ? r.data.training : null;
}

export async function trashTradePointStrict(tpId: string): Promise<OverridesApiResult<{ override: TradePointOverrideRow | null }>> {
  traceOverridesStrictCalled("trashTradePointStrict", { tpId });
  const body = { tp_id: tpId };
  const r = await overridesApiPost<{ override: TradePointOverrideRow | null }>({
    scope: "trade-point",
    action: "trash",
    url: "/api/trade-point-overrides/trash",
    entityId: tpId,
    body,
    traceFn: "trashTradePointStrict",
  });
  if (!r.ok && r.network) {
    enqueuePendingSync({ id: makePendingId("tp-trash", tpId), kind: "tp-trash", payload: body });
  }
  return r;
}

export async function trashTradePoint(tpId: string): Promise<TradePointOverrideRow | null> {
  const r = await trashTradePointStrict(tpId);
  return r.ok ? r.data.override : null;
}

export async function untrashTradePointStrict(tpId: string): Promise<OverridesApiResult<{ override: TradePointOverrideRow | null }>> {
  traceOverridesStrictCalled("untrashTradePointStrict", { tpId });
  const body = { tp_id: tpId };
  const r = await overridesApiPost<{ override: TradePointOverrideRow | null }>({
    scope: "trade-point",
    action: "untrash",
    url: "/api/trade-point-overrides/untrash",
    entityId: tpId,
    body,
    traceFn: "untrashTradePointStrict",
  });
  if (!r.ok && r.network) {
    enqueuePendingSync({ id: makePendingId("tp-untrash", tpId), kind: "tp-untrash", payload: body });
  }
  if (r.ok) invalidateMyDealerScope();
  return r;
}

export async function untrashTradePoint(tpId: string): Promise<TradePointOverrideRow | null> {
  const r = await untrashTradePointStrict(tpId);
  return r.ok ? r.data.override : null;
}

async function postTradePointPurgeAction<T>(
  action: string,
  body: Record<string, unknown>,
  traceFn: string,
): Promise<OverridesApiResult<T>> {
  const tpId = typeof body.tp_id === "string" ? body.tp_id : undefined;
  const r = await overridesApiPost<T>({
    scope: "trade-point",
    action,
    url: `/api/trade-point-overrides/${action}`,
    entityId: tpId,
    body,
    traceFn,
  });
  if (r.ok) invalidateMyDealerScope();
  return r;
}

export async function requestPurgeTradePointStrict(
  tpId: string,
): Promise<OverridesApiResult<{ override: TradePointOverrideRow | null }>> {
  traceOverridesStrictCalled("requestPurgeTradePointStrict", { tpId });
  return postTradePointPurgeAction("request-purge", { tp_id: tpId }, "requestPurgeTradePointStrict");
}

export async function requestPurgeTradePoint(tpId: string): Promise<TradePointOverrideRow | null> {
  const r = await requestPurgeTradePointStrict(tpId);
  return r.ok ? r.data.override : null;
}

export async function restoreTradePointStrict(
  tpId: string,
  target: "employee_trash" | "active" = "employee_trash",
): Promise<OverridesApiResult<{ override: TradePointOverrideRow | null }>> {
  traceOverridesStrictCalled("restoreTradePointStrict", { tpId, target });
  return postTradePointPurgeAction("restore", { tp_id: tpId, target }, "restoreTradePointStrict");
}

export async function restoreTradePoint(
  tpId: string,
  target: "employee_trash" | "active" = "employee_trash",
): Promise<TradePointOverrideRow | null> {
  const r = await restoreTradePointStrict(tpId, target);
  return r.ok ? r.data.override : null;
}

export async function purgeTradePointStrict(
  tpId: string,
): Promise<OverridesApiResult<{ override: TradePointOverrideRow | null }>> {
  traceOverridesStrictCalled("purgeTradePointStrict", { tpId });
  return postTradePointPurgeAction("purge", { tp_id: tpId }, "purgeTradePointStrict");
}

export async function purgeTradePoint(tpId: string): Promise<TradePointOverrideRow | null> {
  const r = await purgeTradePointStrict(tpId);
  return r.ok ? r.data.override : null;
}

export async function adminRestoreTradePointStrict(
  tpId: string,
): Promise<OverridesApiResult<{ override: TradePointOverrideRow | null }>> {
  traceOverridesStrictCalled("adminRestoreTradePointStrict", { tpId });
  return postTradePointPurgeAction("admin-restore", { tp_id: tpId }, "adminRestoreTradePointStrict");
}

export async function adminRestoreTradePoint(tpId: string): Promise<TradePointOverrideRow | null> {
  const r = await adminRestoreTradePointStrict(tpId);
  return r.ok ? r.data.override : null;
}

export const TRADE_POINT_OVERRIDES_HYDRATED_EVENT = "tandoor-trade-point-overrides-hydrated";

export function notifyTradePointOverridesHydrated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TRADE_POINT_OVERRIDES_HYDRATED_EVENT));
}
