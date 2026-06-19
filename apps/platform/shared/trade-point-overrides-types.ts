/**
 * Типы оверрайдов торговых точек (Postgres, prompt 113).
 */

import type { RecordStatus } from "./record-status.js";
import { parseRecordStatus } from "./record-status.js";

export type TradePointOverrideRow = {
  tp_id: string;
  dealer_id: string | null;
  is_primary: boolean;
  status: RecordStatus;
  name: string | null;
  city: string | null;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  comment: string | null;
  showcase_status: string | null;
  shipment_days: string | null;
  is_main_warehouse: boolean | null;
  is_hardware_warehouse: boolean | null;
  trashed_at: string | null;
  trashed_by: string | null;
  purge_requested_at: string | null;
  purge_requested_by: string | null;
  purged_at: string | null;
  purged_by: string | null;
  rop_id: string | null;
  rop_name: string | null;
  regional_manager_id: string | null;
  regional_manager_name: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type TradePointTrainingRow = {
  tp_id: string;
  product_training_done: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type TradePointOverrideEventRow = {
  id: string;
  tp_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
};

export const TRADE_POINT_OVERRIDE_FIELDS = [
  "dealer_id",
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
  "trashed_at",
  "trashed_by",
  "rop_id",
  "rop_name",
  "regional_manager_id",
  "regional_manager_name",
] as const;

export type TradePointOverrideField = (typeof TRADE_POINT_OVERRIDE_FIELDS)[number];

export function mapTradePointOverrideRow(r: Record<string, unknown>): TradePointOverrideRow {
  return {
    tp_id: String(r.tp_id),
    dealer_id: r.dealer_id != null ? String(r.dealer_id) : null,
    is_primary: r.is_primary === true || r.is_primary === "t",
    status: parseRecordStatus(r.status),
    name: r.name != null ? String(r.name) : null,
    city: r.city != null ? String(r.city) : null,
    address: r.address != null ? String(r.address) : null,
    contact_name: r.contact_name != null ? String(r.contact_name) : null,
    contact_phone: r.contact_phone != null ? String(r.contact_phone) : null,
    comment: r.comment != null ? String(r.comment) : null,
    showcase_status: r.showcase_status != null ? String(r.showcase_status) : null,
    shipment_days: r.shipment_days != null ? String(r.shipment_days) : null,
    is_main_warehouse:
      r.is_main_warehouse === null || r.is_main_warehouse === undefined
        ? null
        : r.is_main_warehouse === true || r.is_main_warehouse === "t",
    is_hardware_warehouse:
      r.is_hardware_warehouse === null || r.is_hardware_warehouse === undefined
        ? null
        : r.is_hardware_warehouse === true || r.is_hardware_warehouse === "t",
    trashed_at: r.trashed_at != null ? String(r.trashed_at) : null,
    trashed_by: r.trashed_by != null ? String(r.trashed_by) : null,
    purge_requested_at: r.purge_requested_at != null ? String(r.purge_requested_at) : null,
    purge_requested_by: r.purge_requested_by != null ? String(r.purge_requested_by) : null,
    purged_at: r.purged_at != null ? String(r.purged_at) : null,
    purged_by: r.purged_by != null ? String(r.purged_by) : null,
    rop_id: r.rop_id != null ? String(r.rop_id) : null,
    rop_name: r.rop_name != null ? String(r.rop_name) : null,
    regional_manager_id: r.regional_manager_id != null ? String(r.regional_manager_id) : null,
    regional_manager_name: r.regional_manager_name != null ? String(r.regional_manager_name) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    updated_by: r.updated_by != null ? String(r.updated_by) : null,
  };
}

export function mapTradePointTrainingRow(r: Record<string, unknown>): TradePointTrainingRow {
  return {
    tp_id: String(r.tp_id),
    product_training_done: r.product_training_done === true || r.product_training_done === "t",
    updated_at: String(r.updated_at),
    updated_by: r.updated_by != null ? String(r.updated_by) : null,
  };
}

export function serializeTpOverrideValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
