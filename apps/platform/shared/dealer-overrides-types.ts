/**
 * Типы оверрайдов дилера (Postgres, prompt 113).
 */

export type DealerOverrideRow = {
  dealer_id: string;
  name: string | null;
  city: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  general_comment: string | null;
  client_category: string | null;
  trashed_at: string | null;
  trashed_by: string | null;
  purge_requested_at: string | null;
  purge_requested_by: string | null;
  purged_at: string | null;
  purged_by: string | null;
  unloading_order: string | null;
  regional_manager_id: string | null;
  regional_manager_name: string | null;
  rop_id: string | null;
  rop_name: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type DealerTrainingRow = {
  dealer_id: string;
  product_training_done: boolean;
  needs_new_employees_training: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type DealerOverrideEventRow = {
  id: string;
  dealer_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
};

export type ManualDealerRow = {
  dealer_id: string;
  payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export const DEALER_OVERRIDE_FIELDS = [
  "name",
  "city",
  "contact_name",
  "contact_phone",
  "contact_email",
  "general_comment",
  "client_category",
  "trashed_at",
  "trashed_by",
  "unloading_order",
  "regional_manager_id",
  "regional_manager_name",
  "rop_id",
  "rop_name",
] as const;

export type DealerOverrideField = (typeof DEALER_OVERRIDE_FIELDS)[number];

export function mapDealerOverrideRow(r: Record<string, unknown>): DealerOverrideRow {
  return {
    dealer_id: String(r.dealer_id),
    name: r.name != null ? String(r.name) : null,
    city: r.city != null ? String(r.city) : null,
    contact_name: r.contact_name != null ? String(r.contact_name) : null,
    contact_phone: r.contact_phone != null ? String(r.contact_phone) : null,
    contact_email: r.contact_email != null ? String(r.contact_email) : null,
    general_comment: r.general_comment != null ? String(r.general_comment) : null,
    client_category: r.client_category != null ? String(r.client_category) : null,
    trashed_at: r.trashed_at != null ? String(r.trashed_at) : null,
    trashed_by: r.trashed_by != null ? String(r.trashed_by) : null,
    purge_requested_at: r.purge_requested_at != null ? String(r.purge_requested_at) : null,
    purge_requested_by: r.purge_requested_by != null ? String(r.purge_requested_by) : null,
    purged_at: r.purged_at != null ? String(r.purged_at) : null,
    purged_by: r.purged_by != null ? String(r.purged_by) : null,
    unloading_order: r.unloading_order != null ? String(r.unloading_order) : null,
    regional_manager_id: r.regional_manager_id != null ? String(r.regional_manager_id) : null,
    regional_manager_name: r.regional_manager_name != null ? String(r.regional_manager_name) : null,
    rop_id: r.rop_id != null ? String(r.rop_id) : null,
    rop_name: r.rop_name != null ? String(r.rop_name) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    updated_by: r.updated_by != null ? String(r.updated_by) : null,
  };
}

export function mapDealerTrainingRow(r: Record<string, unknown>): DealerTrainingRow {
  return {
    dealer_id: String(r.dealer_id),
    product_training_done: r.product_training_done === true || r.product_training_done === "t",
    needs_new_employees_training:
      r.needs_new_employees_training === true || r.needs_new_employees_training === "t",
    updated_at: String(r.updated_at),
    updated_by: r.updated_by != null ? String(r.updated_by) : null,
  };
}

export function serializeOverrideValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
