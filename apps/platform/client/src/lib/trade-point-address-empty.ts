export const TRADE_POINT_ADDRESS_EMPTY_LIST_LABEL = "Адрес не заполнен";
export const TRADE_POINT_ADDRESS_EMPTY_DETAIL_LABEL = "Адрес не заполнен — важно заполнить";

/** Пустой или плейсхолдер адреса (бэкфилл-точки с `address = ""`). */
export function isTradePointAddressEmpty(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return v === "" || v === "—" || v === "-";
}

/** Критерий пресета «Без адреса» в списке ТТ (адрес или город не заполнены). */
export function tradePointListRowHasNoAddress(address: string, city: string): boolean {
  return isTradePointAddressEmpty(address) || isTradePointAddressEmpty(city);
}
