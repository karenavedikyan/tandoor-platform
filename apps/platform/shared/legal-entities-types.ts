/**
 * Юрлица клиента (Postgres) — платёжные реквизиты на уровне юр.лица (Промт 64).
 */

export type LegalEntityPaymentForm = "cash" | "bank" | "mixed";

export type LegalEntityRow = {
  id: string;
  clientId: string;
  name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  legalAddress: string | null;
  paymentForm: LegalEntityPaymentForm | null;
  paymentDelayDays: number | null;
  creditLimitRub: string | null;
  edoEnabled: boolean | null;
  edoOperator: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LegalEntityCreatePayload = {
  name?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  legalAddress?: string | null;
  paymentForm?: LegalEntityPaymentForm | null;
  paymentDelayDays?: number | null;
  creditLimitRub?: number | string | null;
  edoEnabled?: boolean | null;
  edoOperator?: string | null;
};

export type LegalEntityPatchPayload = LegalEntityCreatePayload;

export function parsePaymentForm(raw: unknown): LegalEntityPaymentForm | null {
  if (raw == null || raw === "") return null;
  const v = String(raw).trim().toLowerCase();
  if (v === "cash" || v === "bank" || v === "mixed") return v;
  return null;
}

export type LegalEntityFullRow = LegalEntityRow & {
  internalCode: string | null;
  entityType: string | null;
  actualAddress: string | null;
  primaryContact: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  comment: string | null;
  updatedByUserId: string | null;
  updatedByName: string | null;
  source: string;
  isArchived: boolean;
};

export type LegalEntityHistoryRow = {
  id: string;
  clientId: string;
  legalEntityId: string | null;
  at: string;
  meta: string | null;
  body: string;
  actorUserId: string | null;
  actorName: string | null;
};

export function mapLegalEntityRow(r: Record<string, unknown>): LegalEntityRow {
  const credit = r.credit_limit_rub;
  return {
    id: String(r.id),
    clientId: String(r.client_id),
    name: r.name != null ? String(r.name) : null,
    inn: r.inn != null ? String(r.inn) : null,
    kpp: r.kpp != null ? String(r.kpp) : null,
    ogrn: r.ogrn != null ? String(r.ogrn) : null,
    legalAddress: r.legal_address != null ? String(r.legal_address) : null,
    paymentForm: parsePaymentForm(r.payment_form),
    paymentDelayDays:
      r.payment_delay_days == null || r.payment_delay_days === ""
        ? null
        : Number(r.payment_delay_days),
    creditLimitRub: credit == null ? null : String(credit),
    edoEnabled: r.edo_enabled == null ? null : Boolean(r.edo_enabled),
    edoOperator: r.edo_operator != null ? String(r.edo_operator) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function mapLegalEntityFullRow(r: Record<string, unknown>): LegalEntityFullRow {
  const base = mapLegalEntityRow(r);
  const statusRaw = r.status != null ? String(r.status) : "additional";
  const isArchived = Boolean(r.is_archived) || statusRaw === "archived";
  return {
    ...base,
    internalCode: r.internal_code != null ? String(r.internal_code) : null,
    entityType: r.entity_type != null ? String(r.entity_type) : null,
    actualAddress: r.actual_address != null ? String(r.actual_address) : null,
    primaryContact: r.primary_contact != null ? String(r.primary_contact) : null,
    phone: r.phone != null ? String(r.phone) : null,
    email: r.email != null ? String(r.email) : null,
    status: isArchived ? "archived" : statusRaw,
    comment: r.comment != null ? String(r.comment) : null,
    updatedByUserId: r.updated_by_user_id != null ? String(r.updated_by_user_id) : null,
    updatedByName: r.updated_by_name != null ? String(r.updated_by_name) : null,
    source: r.source != null ? String(r.source) : "manual",
    isArchived,
  };
}

export function mapLegalEntityHistoryRow(r: Record<string, unknown>): LegalEntityHistoryRow {
  return {
    id: String(r.id),
    clientId: String(r.client_id),
    legalEntityId: r.legal_entity_id != null ? String(r.legal_entity_id) : null,
    at: String(r.at),
    meta: r.meta != null ? String(r.meta) : null,
    body: String(r.body),
    actorUserId: r.actor_user_id != null ? String(r.actor_user_id) : null,
    actorName: r.actor_name != null ? String(r.actor_name) : null,
  };
}
