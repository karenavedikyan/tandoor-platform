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
