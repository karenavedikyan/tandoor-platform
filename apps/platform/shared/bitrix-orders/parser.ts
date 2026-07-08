import { XMLParser } from "fast-xml-parser";

export type ParsedBitrixOrderItem = {
  lineNo: number;
  productXmlId: string;
  productName1c: string | null;
  quantity: number;
  discountPerItem: number | null;
  priceNoDiscount: number | null;
  discountId: string | null;
  productId1cInternal: string | null;
  priceTypeUuid: string | null;
  supplyVariant: string | null;
  supplyDate: Date | null;
};

export type ParsedBitrixOrder = {
  bitrixOrderId: string;
  orderNumber: string;
  siteId: string | null;
  clientUuid: string | null;
  clientNumber1c: string | null;
  status: string;
  deliveryType: string | null;
  deliveryAddress: string | null;
  paymentMethod: string | null;
  paymentPercent: number | null;
  totalWithDiscount: number | null;
  totalDiscount: number | null;
  createdAtBitrix: Date | null;
  rawPayload: unknown;
  items: ParsedBitrixOrderItem[];
};

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
  parseTagValue: false,
  isArray: (tagName) => tagName === "Заказ" || tagName === "Товар",
});

function normText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function parseNumber(value: unknown): number | null {
  const s = normText(value);
  if (!s) return null;
  const normalized = s.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function parseBitrixDateTime(value: unknown): Date | null {
  const s = normText(value);
  if (!s) return null;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min, sec] = m;
  const localMs = Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min, +sec);
  return new Date(localMs - MOSCOW_OFFSET_MS);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function listOf<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseOrderItem(raw: Record<string, unknown>, lineNo: number): ParsedBitrixOrderItem | null {
  const productXmlId = normText(raw.Код);
  if (!productXmlId) return null;
  const quantity = parseNumber(raw.Количество);
  if (quantity == null) return null;

  return {
    lineNo,
    productXmlId,
    productName1c: normText(raw.Название),
    quantity,
    discountPerItem: parseNumber(raw.СкидкаНаТовар),
    priceNoDiscount: parseNumber(raw.ЦенаБезСкидки),
    discountId: normText(raw.ИДСкидки),
    productId1cInternal: normText(raw.ИДТовара),
    priceTypeUuid: normText(raw.ВидЦены),
    supplyVariant: normText(raw.ВариантОбеспечения),
    supplyDate: parseBitrixDateTime(raw.ДатаОбеспечения),
  };
}

function parseOrder(raw: Record<string, unknown>): ParsedBitrixOrder | null {
  const bitrixOrderId = normText(raw.ИД);
  const orderNumber = normText(raw.Номер);
  const status = normText(raw.СтатусЗаказа);
  if (!bitrixOrderId || !orderNumber || !status) return null;

  const goods = asRecord(raw.Товары);
  const itemRows = listOf<Record<string, unknown>>(goods.Товар as Record<string, unknown> | Record<string, unknown>[]);
  const items: ParsedBitrixOrderItem[] = [];
  itemRows.forEach((itemRaw, idx) => {
    const item = parseOrderItem(itemRaw, idx + 1);
    if (item) items.push(item);
  });

  return {
    bitrixOrderId,
    orderNumber,
    siteId: normText(raw.ИДСайта),
    clientUuid: normText(raw.ИДКлиента),
    clientNumber1c: normText(raw.НомерКлиента1С),
    status,
    deliveryType: normText(raw.СпособДоставки),
    deliveryAddress: normText(raw.АдресДоставки),
    paymentMethod: normText(raw.СпособОплаты),
    paymentPercent: parseNumber(raw.ПроцентОплаты),
    totalWithDiscount: parseNumber(raw.СуммаСоСкидкой),
    totalDiscount: parseNumber(raw.СуммаСкидки),
    createdAtBitrix: parseBitrixDateTime(raw.ДатаСоздания),
    rawPayload: raw,
    items,
  };
}

export function parseBitrixOrdersXml(xml: string): ParsedBitrixOrder[] {
  const parsed = xmlParser.parse(xml) as Record<string, unknown>;
  const root = asRecord(parsed.Заказы);
  const orders = listOf<Record<string, unknown>>(root.Заказ as Record<string, unknown> | Record<string, unknown>[]);
  const result: ParsedBitrixOrder[] = [];
  for (const orderRaw of orders) {
    const order = parseOrder(orderRaw);
    if (order) result.push(order);
  }
  return result;
}
