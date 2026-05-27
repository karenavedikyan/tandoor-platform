/**
 * API юрлиц с платёжными реквизитами (Postgres, Промт 64).
 */

export type LegalEntityPaymentForm = "cash" | "bank" | "mixed";

export type LegalEntityDto = {
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

export type LegalEntityUpsertFields = {
  name?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  legalAddress?: string | null;
  paymentForm?: LegalEntityPaymentForm | null;
  paymentDelayDays?: number | null;
  creditLimitRub?: number | null;
  edoEnabled?: boolean | null;
  edoOperator?: string | null;
};

type ApiOk<T> = { success: true } & T;
type ApiErr = { success: false; code?: string; message?: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchLegalEntitiesForClient(clientId: string): Promise<LegalEntityDto[]> {
  const res = await fetch(`/api/legal-entities/list?clientId=${encodeURIComponent(clientId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await parseJson<ApiOk<{ items: LegalEntityDto[] }> | ApiErr>(res);
  if (!res.ok || !data.success) {
    throw new Error(!data.success ? data.message ?? "Не удалось загрузить юрлица" : `HTTP ${res.status}`);
  }
  return data.items;
}

export async function createLegalEntity(clientId: string, fields: LegalEntityUpsertFields): Promise<LegalEntityDto> {
  const res = await fetch("/api/legal-entities/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, ...fields }),
  });
  const data = await parseJson<ApiOk<{ item: LegalEntityDto }> | ApiErr>(res);
  if (!res.ok || !data.success) {
    throw new Error(!data.success ? data.message ?? "Не удалось создать юрлицо" : `HTTP ${res.status}`);
  }
  return data.item;
}

export async function patchLegalEntity(id: string, fields: LegalEntityUpsertFields): Promise<LegalEntityDto> {
  const res = await fetch(`/api/legal-entities/patch?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  const data = await parseJson<ApiOk<{ item: LegalEntityDto }> | ApiErr>(res);
  if (!res.ok || !data.success) {
    throw new Error(!data.success ? data.message ?? "Не удалось сохранить" : `HTTP ${res.status}`);
  }
  return data.item;
}

export async function deleteLegalEntity(id: string): Promise<void> {
  const res = await fetch(`/api/legal-entities/delete?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await parseJson<ApiOk<Record<string, never>> | ApiErr>(res);
  if (!res.ok || !data.success) {
    throw new Error(!data.success ? data.message ?? "Не удалось удалить" : `HTTP ${res.status}`);
  }
}

export type TradePointLegalEntityLink = {
  tradePointId: string;
  legalEntity: LegalEntityDto;
};

export async function fetchTradePointLegalEntityLink(tradePointId: string): Promise<TradePointLegalEntityLink | null> {
  const res = await fetch(
    `/api/legal-entities/trade-point-link?tradePointId=${encodeURIComponent(tradePointId)}`,
    { credentials: "include", cache: "no-store" },
  );
  const data = await parseJson<ApiOk<{ link: TradePointLegalEntityLink | null }> | ApiErr>(res);
  if (!res.ok || !data.success) {
    return null;
  }
  return data.link;
}

export const PAYMENT_FORM_OPTIONS: { value: LegalEntityPaymentForm | ""; label: string }[] = [
  { value: "", label: "Не указано" },
  { value: "cash", label: "Нал" },
  { value: "bank", label: "Безнал" },
  { value: "mixed", label: "Смешанная" },
];

export const EDO_OPERATOR_SUGGESTIONS = ["Диадок", "СБИС", "Контур", "Другое"] as const;
