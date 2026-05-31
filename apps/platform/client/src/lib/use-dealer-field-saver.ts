/**
 * Централизованное сохранение полей overrides дилера/ТТ в Postgres (Промт 113.3).
 */

import { useCallback, useMemo } from "react";
import type { DealerOverrideField } from "../../../shared/dealer-overrides-types";
import type { TradePointOverrideField } from "../../../shared/trade-point-overrides-types";
import {
  createManualDealerStrict,
  setDealerTrainingStrict,
  upsertDealerOverrideStrict,
} from "@/lib/dealer-overrides-api";
import type { OverridesApiResult } from "@/lib/overrides-api-result";
import { handleOverridesStrictResult } from "@/lib/overrides-save-feedback";
import { makePendingId } from "@/lib/overrides-pending-sync";
import { pushOverridesTrace } from "@/lib/overrides-trace-log";
import {
  setTradePointTrainingStrict,
  upsertTradePointOverrideStrict,
} from "@/lib/trade-point-overrides-api";

export const STRICT_COVERED_DEALER_FIELDS = [
  "name",
  "city",
  "contact_name",
  "contact_phone",
  "contact_email",
  "general_comment",
  "client_category",
  "unloading_order",
  "regional_manager_id",
  "regional_manager_name",
] as const satisfies readonly DealerOverrideField[];

export const STRICT_COVERED_TP_FIELDS = [
  "name",
  "city",
  "address",
  "contact_name",
  "contact_phone",
  "comment",
  "showcase_status",
  "shipment_days",
  "is_main_warehouse",
  "is_hardware_warehouse",
] as const satisfies readonly TradePointOverrideField[];

export const STRICT_COVERED_TRAINING_DEALER_FIELDS = [
  "product_training_done",
  "needs_new_employees_training",
] as const;

export const STRICT_COVERED_TRAINING_TP_FIELDS = ["product_training_done"] as const;

export type StrictCoveredField =
  | (typeof STRICT_COVERED_DEALER_FIELDS)[number]
  | (typeof STRICT_COVERED_TP_FIELDS)[number]
  | (typeof STRICT_COVERED_TRAINING_DEALER_FIELDS)[number]
  | (typeof STRICT_COVERED_TRAINING_TP_FIELDS)[number];

const DEALER_FIELD_LABELS: Record<DealerOverrideField, string> = {
  name: "Название",
  city: "Город",
  contact_name: "Имя контакта",
  contact_phone: "Телефон",
  contact_email: "Email",
  general_comment: "Общий комментарий",
  client_category: "Категория клиента",
  trashed_at: "Корзина",
  trashed_by: "Корзина",
  unloading_order: "Порядок выгрузки",
  regional_manager_id: "Региональный менеджер",
  regional_manager_name: "Региональный менеджер",
};

const TP_FIELD_LABELS: Record<TradePointOverrideField, string> = {
  dealer_id: "Дилер",
  name: "Название",
  city: "Город",
  address: "Адрес",
  contact_name: "Имя контакта",
  contact_phone: "Телефон",
  comment: "Комментарий",
  showcase_status: "Статус витрины",
  shipment_days: "Дни отгрузки",
  is_main_warehouse: "Основной склад",
  is_hardware_warehouse: "Склад комплектации",
  trashed_at: "Корзина",
  trashed_by: "Корзина",
};

export function isStrictCoveredDealerField(field: string): field is (typeof STRICT_COVERED_DEALER_FIELDS)[number] {
  return (STRICT_COVERED_DEALER_FIELDS as readonly string[]).includes(field);
}

export function isStrictCoveredTpField(field: string): field is (typeof STRICT_COVERED_TP_FIELDS)[number] {
  return (STRICT_COVERED_TP_FIELDS as readonly string[]).includes(field);
}

export function isStrictCoveredField(field: string): boolean {
  return (
    isStrictCoveredDealerField(field) ||
    isStrictCoveredTpField(field) ||
    (STRICT_COVERED_TRAINING_DEALER_FIELDS as readonly string[]).includes(field) ||
    (STRICT_COVERED_TRAINING_TP_FIELDS as readonly string[]).includes(field)
  );
}

export type SaveFieldOpts = {
  fieldLabel?: string;
  source?: string;
};

function currentSource(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof window !== "undefined" && window.location?.pathname) return window.location.pathname;
  return "unknown";
}

export async function saveDealerField(
  dealerId: string,
  field: DealerOverrideField,
  value: unknown,
  opts?: SaveFieldOpts,
): Promise<OverridesApiResult<{ override: unknown }>> {
  const source = currentSource(opts?.source);
  pushOverridesTrace({
    fn: "saveDealerField",
    stage: "ui_change_started",
    dealerId,
    field,
    newValue: value,
    source,
  });
  const fields = { [field]: value } as Partial<Record<DealerOverrideField, unknown>>;
  return saveDealerFields(dealerId, fields, { ...opts, fieldLabel: opts?.fieldLabel ?? DEALER_FIELD_LABELS[field] });
}

export async function saveDealerFields(
  dealerId: string,
  fields: Partial<Record<DealerOverrideField, unknown>>,
  opts?: SaveFieldOpts,
): Promise<OverridesApiResult<{ override: unknown }>> {
  const source = currentSource(opts?.source);
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    return { ok: true, data: { override: null } };
  }
  pushOverridesTrace({
    fn: "saveDealerFields",
    stage: "ui_change_started",
    dealerId,
    fieldsKeys: keys,
    source,
  });
  const result = await upsertDealerOverrideStrict(dealerId, fields);
  handleOverridesStrictResult(result, {
    pendingId: makePendingId("dealer-upsert", dealerId),
    pendingKind: "dealer-upsert",
    pendingPayload: { dealer_id: dealerId, fields },
    fieldLabel: opts?.fieldLabel ?? keys.map((k) => DEALER_FIELD_LABELS[k as DealerOverrideField] ?? k).join(", "),
  });
  return result;
}

export async function saveTradePointField(
  tpId: string,
  field: TradePointOverrideField,
  value: unknown,
  dealerId?: string,
  opts?: SaveFieldOpts,
): Promise<OverridesApiResult<{ override: unknown }>> {
  const fields = { [field]: value } as Partial<Record<TradePointOverrideField, unknown>>;
  return saveTradePointFields(tpId, fields, dealerId, {
    ...opts,
    fieldLabel: opts?.fieldLabel ?? TP_FIELD_LABELS[field],
  });
}

export async function saveTradePointFields(
  tpId: string,
  fields: Partial<Record<TradePointOverrideField, unknown>>,
  dealerId?: string,
  opts?: SaveFieldOpts,
): Promise<OverridesApiResult<{ override: unknown }>> {
  const source = currentSource(opts?.source);
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    return { ok: true, data: { override: null } };
  }
  pushOverridesTrace({
    fn: "saveTradePointFields",
    stage: "ui_change_started",
    tpId,
    dealerId,
    fieldsKeys: keys,
    source,
  });
  const result = await upsertTradePointOverrideStrict(tpId, fields, dealerId);
  handleOverridesStrictResult(result, {
    pendingId: makePendingId("tp-upsert", tpId),
    pendingKind: "tp-upsert",
    pendingPayload: { tp_id: tpId, dealer_id: dealerId, fields },
    fieldLabel: opts?.fieldLabel ?? keys.map((k) => TP_FIELD_LABELS[k as TradePointOverrideField] ?? k).join(", "),
  });
  return result;
}

export async function saveDealerTrainingField(
  dealerId: string,
  partial: { product_training_done?: boolean; needs_new_employees_training?: boolean },
  opts?: SaveFieldOpts,
): Promise<OverridesApiResult<{ training: unknown }>> {
  const source = currentSource(opts?.source);
  pushOverridesTrace({
    fn: "saveDealerTrainingField",
    stage: "ui_change_started",
    dealerId,
    fieldsKeys: Object.keys(partial),
    source,
  });
  const result = await setDealerTrainingStrict(dealerId, partial);
  const kind = partial.product_training_done !== undefined ? "dealer-training" : "dealer-training";
  handleOverridesStrictResult(result, {
    pendingId: makePendingId("dealer-training", dealerId),
    pendingKind: kind,
    pendingPayload: { dealer_id: dealerId, ...partial },
    fieldLabel: opts?.fieldLabel ?? "Обучение",
  });
  return result;
}

export async function saveTradePointTrainingField(
  tpId: string,
  partial: { product_training_done?: boolean },
  opts?: SaveFieldOpts,
): Promise<OverridesApiResult<{ training: unknown }>> {
  const source = currentSource(opts?.source);
  pushOverridesTrace({
    fn: "saveTradePointTrainingField",
    stage: "ui_change_started",
    tpId,
    source,
  });
  const result = await setTradePointTrainingStrict(tpId, partial);
  handleOverridesStrictResult(result, {
    pendingId: makePendingId("tp-training", tpId),
    pendingKind: "tp-training",
    pendingPayload: { tp_id: tpId, ...partial },
    fieldLabel: opts?.fieldLabel ?? "Обучение ТТ",
  });
  return result;
}

export async function saveManualDealerToDb(
  dealerId: string,
  payload: Record<string, unknown>,
  opts?: SaveFieldOpts,
): Promise<OverridesApiResult<{ dealer_id: string; payload: Record<string, unknown> }>> {
  const source = currentSource(opts?.source);
  pushOverridesTrace({ fn: "saveManualDealerToDb", stage: "ui_change_started", dealerId, source });
  const result = await createManualDealerStrict({ dealer_id: dealerId, payload });
  handleOverridesStrictResult(result, {
    pendingId: makePendingId("manual-dealer", dealerId),
    pendingKind: "manual-dealer",
    pendingPayload: { dealer_id: dealerId, payload },
    fieldLabel: opts?.fieldLabel ?? "Ручной клиент",
  });
  return result;
}

/** Маппинг полей actualization-blob → колонки dealer_overrides. */
export function mapActualizationDealerFieldsToOverrides(
  fields: Record<string, unknown>,
): Partial<Record<DealerOverrideField, unknown>> {
  const out: Partial<Record<DealerOverrideField, unknown>> = {};
  const nameRaw = fields.dealerName ?? fields.name;
  if (nameRaw !== undefined) out.name = String(nameRaw).trim() || null;
  if (fields.city !== undefined) out.city = String(fields.city).trim() || null;
  if (fields.phone !== undefined) out.contact_phone = String(fields.phone).trim() || null;
  if (fields.email !== undefined) out.contact_email = String(fields.email).trim() || null;
  if (fields.contactPerson !== undefined) out.contact_name = String(fields.contactPerson).trim() || null;
  if (fields.comment !== undefined) out.general_comment = String(fields.comment).trim() || null;
  if (fields.clientCategory !== undefined) out.client_category = String(fields.clientCategory);
  if (fields.unloadingOrder !== undefined) {
    const uo = fields.unloadingOrder;
    out.unloading_order =
      typeof uo === "number" && Number.isFinite(uo) && uo > 0 ? String(Math.floor(uo)) : uo ? String(uo) : null;
  }
  return out;
}

/** Маппинг полей actualization ТТ → trade_point_overrides. */
export function mapActualizationTpFieldsToOverrides(
  fields: Record<string, unknown>,
): Partial<Record<TradePointOverrideField, unknown>> {
  const out: Partial<Record<TradePointOverrideField, unknown>> = {};
  if (fields.name !== undefined) out.name = String(fields.name).trim() || null;
  if (fields.city !== undefined) out.city = String(fields.city).trim() || null;
  if (fields.address !== undefined) out.address = String(fields.address).trim() || null;
  if (fields.contactName !== undefined) out.contact_name = String(fields.contactName).trim() || null;
  if (fields.contactPhone !== undefined) out.contact_phone = String(fields.contactPhone).trim() || null;
  if (fields.comment !== undefined) out.comment = String(fields.comment).trim() || null;
  const status = fields.status ?? fields.tpStatusKind;
  if (status !== undefined) out.showcase_status = status != null ? String(status) : null;
  return out;
}

export function useDealerFieldSaver() {
  const source =
    typeof window !== "undefined" && window.location?.pathname ? window.location.pathname : "unknown";
  const saveField = useCallback(
    (dealerId: string, field: DealerOverrideField, value: unknown, opts?: SaveFieldOpts) =>
      saveDealerField(dealerId, field, value, { ...opts, source: opts?.source ?? source }),
    [source],
  );
  const saveFields = useCallback(
    (dealerId: string, fields: Partial<Record<DealerOverrideField, unknown>>, opts?: SaveFieldOpts) =>
      saveDealerFields(dealerId, fields, { ...opts, source: opts?.source ?? source }),
    [source],
  );
  const saveTraining = useCallback(
    (
      dealerId: string,
      partial: { product_training_done?: boolean; needs_new_employees_training?: boolean },
      opts?: SaveFieldOpts,
    ) => saveDealerTrainingField(dealerId, partial, { ...opts, source: opts?.source ?? source }),
    [source],
  );
  return useMemo(
    () => ({ saveDealerField: saveField, saveDealerFields: saveFields, saveDealerTrainingField: saveTraining, source }),
    [saveField, saveFields, saveTraining, source],
  );
}

export function useTradePointFieldSaver() {
  const source =
    typeof window !== "undefined" && window.location?.pathname ? window.location.pathname : "unknown";
  const saveField = useCallback(
    (tpId: string, field: TradePointOverrideField, value: unknown, dealerId?: string, opts?: SaveFieldOpts) =>
      saveTradePointField(tpId, field, value, dealerId, { ...opts, source: opts?.source ?? source }),
    [source],
  );
  const saveFields = useCallback(
    (
      tpId: string,
      fields: Partial<Record<TradePointOverrideField, unknown>>,
      dealerId?: string,
      opts?: SaveFieldOpts,
    ) => saveTradePointFields(tpId, fields, dealerId, { ...opts, source: opts?.source ?? source }),
    [source],
  );
  const saveTraining = useCallback(
    (tpId: string, partial: { product_training_done?: boolean }, opts?: SaveFieldOpts) =>
      saveTradePointTrainingField(tpId, partial, { ...opts, source: opts?.source ?? source }),
    [source],
  );
  return useMemo(
    () => ({
      saveTradePointField: saveField,
      saveTradePointFields: saveFields,
      saveTradePointTrainingField: saveTraining,
      source,
    }),
    [saveField, saveFields, saveTraining, source],
  );
}
