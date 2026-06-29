/**
 * Материализация основной торговой точки клиента (общая логика UI + бэкфилл).
 */

export const PRIMARY_TRADE_POINT_NAME = "Основная торговая точка";
export const PRIMARY_TRADE_POINT_FORMAT = "Розница / салон";

export type PrimaryTradePointMaterializationFields = {
  name: string;
  city: string;
  address: string;
  format: string;
  contactName: string;
  contactPhone: string;
  email: string;
  comment: string;
};

export type DealerPrimaryTradePointSource = {
  city?: string | null;
  releaseAddress?: string | null;
  contacts?: {
    lpr?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
};

/** Детерминированный id основной ТТ — один на клиента, без дублей при повторных вызовах. */
export function primaryTradePointMaterializationId(dealerId: string): string {
  const id = dealerId.trim();
  if (!id) throw new Error("dealerId обязателен");
  return `manual-tp-primary-${id}`;
}

export function buildPrimaryTradePointMaterializationFields(
  dealer: DealerPrimaryTradePointSource,
): PrimaryTradePointMaterializationFields {
  return {
    name: PRIMARY_TRADE_POINT_NAME,
    city: dealer.city?.trim() || "—",
    address: dealer.releaseAddress?.trim() || "Адрес не указан",
    format: PRIMARY_TRADE_POINT_FORMAT,
    contactName: dealer.contacts?.lpr?.trim() || "",
    contactPhone: dealer.contacts?.phone?.trim() || "",
    email: dealer.contacts?.email?.trim() || "",
    comment: "",
  };
}
