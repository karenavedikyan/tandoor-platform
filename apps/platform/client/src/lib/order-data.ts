/**
 * Локальный безопасный контур заказов и складов дилера для платформы Tandoor.
 *
 * Структура полей повторяет логику ЛК дилера/клиента, синхронизированного с 1С:
 * заказ всегда привязан к дилеру и его складу, может быть привязан к торговой точке,
 * имеет состав позиций, статусы, ближайшее действие и сводные технические признаки.
 * Поля sync.* сознательно нейтральные и не отражают реальные внутренние идентификаторы
 * 1С/Bitrix — модель заранее готова к замене на API без переписывания UI.
 *
 * В этих данных намеренно нет: реальных цен по контракту, остатков складов 1С, реальных
 * номеров документов, внутренних идентификаторов Bitrix, ключей синхронизации, токенов.
 * Все значения — обезличенные, но в структуре и стиле, идентичных рабочему контуру дилера.
 */

import { DEALER_BASE_ROWS, type DealerRow, type DealerTradePoint } from "@/lib/dealer-base-mock-data";

export type DealerWarehouseType = "региональный" | "точечный" | "транзитный";
export type DealerWarehouseStatus = "активен" | "ограничен" | "на инвентаризации";

export type DealerWarehouse = {
  /** Внутренний идентификатор склада в контуре платформы. */
  warehouseId: string;
  dealerId: string;
  /** Список торговых точек, которые обслуживаются этим складом. */
  tradePointIds: string[];
  name: string;
  city: string;
  region: string;
  type: DealerWarehouseType;
  /** Является ли склад основным для дилера. */
  isPrimary: boolean;
  /** Зона доставки склада в нейтральной формулировке. */
  deliveryZone: string;
  status: DealerWarehouseStatus;
};

export type OrderStatus =
  | "новый"
  | "на подтверждении"
  | "подтверждён"
  | "в комплектации"
  | "частично укомплектован"
  | "отгружен"
  | "доставлен"
  | "закрыт"
  | "отменён";

export type OrderPaymentStatus = "ожидает оплату" | "частично оплачен" | "оплачен" | "проблема оплаты" | "не требуется";
export type OrderShipmentStatus =
  | "не отгружен"
  | "готовится"
  | "частично отгружен"
  | "отгружен"
  | "доставлен"
  | "проблема отгрузки";

export type OrderSource = "ЛК дилера" | "Менеджер" | "1С" | "Заявка";

export type OrderItemAvailability = "в наличии" | "под заказ" | "ожидание поставки" | "недостаточно";
export type OrderItemMatrixLink = "входит в матрицу" | "вне матрицы" | "рекомендован к матрице" | "под проверку";
export type OrderItemShowcaseLink = "присутствует на витрине" | "отсутствует на витрине" | "под проверку" | "не требуется";

export type OrderItem = {
  productId: string;
  productName: string;
  productArticle: string;
  category: string;
  quantity: number;
  unit: string;
  availability: OrderItemAvailability;
  warehouseStatus: string;
  linkedMatrixStatus: OrderItemMatrixLink;
  linkedShowcaseStatus: OrderItemShowcaseLink;
};

export type OrderAttentionFlag =
  | "новый"
  | "на подтверждении"
  | "проблема оплаты"
  | "проблема отгрузки"
  | "изменение состава"
  | "неполная комплектация"
  | "связан с матрицей"
  | "связан с витриной";

export type OrderHistoryEvent = {
  id: string;
  date: string;
  text: string;
};

export type OrderRow = {
  id: string;
  /** Видимый номер заказа в нейтральном формате. */
  number: string;
  date: string;
  updatedAt: string;
  dealerId: string;
  dealerName: string;
  tradePointId?: string;
  tradePointName?: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCity: string;
  /** Нейтральное направление доставки без реальных адресов. */
  deliveryDirection: string;
  source: OrderSource;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  shipmentStatus: OrderShipmentStatus;
  /** Безопасный нейтральный показатель — диапазон по объёму, без реальной выручки. */
  totalAmountLabel: string;
  currency: string;
  manager: string;
  /** Признак того, что заказ синхронизирован через единый контур ЛК дилера. */
  syncOrigin: "ЛК дилера";
  /** Признак того, что заказ виден менеджеру через тот же синхронизированный контур. */
  syncVisibleToManager: boolean;
  items: OrderItem[];
  attentionFlags: OrderAttentionFlag[];
  nextAction: string;
  history: OrderHistoryEvent[];
};

const WAREHOUSE_NAMES = ["Юг-Главный", "Юг-Регион", "Город-Логистика", "Транзит-Юг"];
const DELIVERY_DIRECTIONS = [
  "Самовывоз со склада дилера",
  "Доставка до торговой точки",
  "Кросс-докинг со склада региона",
];
const SOURCES: OrderSource[] = ["ЛК дилера", "Менеджер", "1С", "Заявка"];
const STATUS_FLOW: OrderStatus[] = [
  "новый",
  "на подтверждении",
  "подтверждён",
  "в комплектации",
  "частично укомплектован",
  "отгружен",
  "доставлен",
  "закрыт",
];
const PAYMENT_FLOW: OrderPaymentStatus[] = [
  "ожидает оплату",
  "частично оплачен",
  "оплачен",
  "проблема оплаты",
];
const SHIPMENT_FLOW: OrderShipmentStatus[] = [
  "не отгружен",
  "готовится",
  "частично отгружен",
  "отгружен",
  "доставлен",
  "проблема отгрузки",
];
const AMOUNT_LABELS = [
  "до 100 тыс. ₽",
  "100–250 тыс. ₽",
  "250–500 тыс. ₽",
  "500 тыс. – 1 млн ₽",
  "более 1 млн ₽",
];

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** Стабильное число для сидов заказов/складов, если id клиента не числовой (Release 1). */
export function dealerSeedIndex(dealer: { id: string }): number {
  const n = parseInt(dealer.id, 10);
  if (Number.isFinite(n) && n > 0) return n;
  let h = 0;
  for (let i = 0; i < dealer.id.length; i += 1) {
    h = (Math.imul(h, 31) + dealer.id.charCodeAt(i)) | 0;
  }
  const v = Math.abs(h) % 100000;
  return v === 0 ? 1 : v;
}

function dateFor(i: number, offsetDays: number): string {
  const day = ((i * 3 + offsetDays) % 27) + 1;
  const month = ((i + offsetDays) % 5) + 1;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.2026`;
}

function buildWarehousesForDealer(dealer: DealerRow): DealerWarehouse[] {
  const i = dealerSeedIndex(dealer);
  const points = dealer.tradePoints;
  const warehouses: DealerWarehouse[] = [];

  const primaryName = `${WAREHOUSE_NAMES[i % WAREHOUSE_NAMES.length]} · ${dealer.city}`;
  const primaryPoints = points.length > 0 ? points.map((p) => p.id) : [];
  warehouses.push({
    warehouseId: `${dealer.id}-W01`,
    dealerId: dealer.id,
    tradePointIds: primaryPoints,
    name: primaryName,
    city: dealer.city,
    region: dealer.region,
    type: "региональный",
    isPrimary: true,
    deliveryZone: `${dealer.region} · основной`,
    status: i % 9 === 0 ? "ограничен" : "активен",
  });

  if (points.length >= 2) {
    const secondName = `Склад при точке №${points[1]?.id ?? "02"}`;
    warehouses.push({
      warehouseId: `${dealer.id}-W02`,
      dealerId: dealer.id,
      tradePointIds: points[1] ? [points[1].id] : [],
      name: secondName,
      city: points[1]?.city ?? dealer.city,
      region: dealer.region,
      type: "точечный",
      isPrimary: false,
      deliveryZone: `${dealer.region} · точечный`,
      status: i % 7 === 3 ? "на инвентаризации" : "активен",
    });
  }

  if (points.length >= 3) {
    warehouses.push({
      warehouseId: `${dealer.id}-W03`,
      dealerId: dealer.id,
      tradePointIds: [points[2]!.id],
      name: `Транзитный склад · ${points[2]!.city}`,
      city: points[2]!.city,
      region: dealer.region,
      type: "транзитный",
      isPrimary: false,
      deliveryZone: `${dealer.region} · транзит`,
      status: "активен",
    });
  }

  return warehouses;
}

function pickWarehouseForPoint(
  warehouses: DealerWarehouse[],
  point: DealerTradePoint | undefined,
  fallbackIndex: number,
): DealerWarehouse {
  if (point) {
    const w = warehouses.find((wh) => wh.tradePointIds.includes(point.id));
    if (w) return w;
  }
  return warehouses[fallbackIndex % warehouses.length] ?? warehouses[0]!;
}

function buildItems(
  i: number,
  dealer: DealerRow,
  point: DealerTradePoint | undefined,
  hasMatrixLink: boolean,
  hasShowcaseLink: boolean,
): OrderItem[] {
  const productSeed = [
    { id: "TND-MK-101", name: "Дверь МК «Тандор Линия»", article: "MK-101", category: "Межкомнатные" },
    { id: "TND-VH-204", name: "Дверь ВХ «Тандор Стандарт»", article: "VH-204", category: "Входные" },
    { id: "TND-VH-302", name: "Дверь ВХ «Тандор Премьер»", article: "VH-302", category: "Входные" },
    { id: "TND-MK-118", name: "Дверь МК «Тандор Софт»", article: "MK-118", category: "Межкомнатные" },
    { id: "TND-FUR-014", name: "Комплект фурнитуры «Тандор Базовый»", article: "FUR-014", category: "Фурнитура" },
    { id: "TND-MK-126", name: "Дверь МК «Тандор Графит»", article: "MK-126", category: "Межкомнатные" },
  ];
  const availabilityOpts: OrderItemAvailability[] = ["в наличии", "под заказ", "ожидание поставки", "недостаточно"];
  const matrixOpts: OrderItemMatrixLink[] = ["входит в матрицу", "вне матрицы", "рекомендован к матрице", "под проверку"];
  const showcaseOpts: OrderItemShowcaseLink[] = [
    "присутствует на витрине",
    "отсутствует на витрине",
    "под проверку",
    "не требуется",
  ];
  const count = 2 + ((i + dealer.id.charCodeAt(2)) % 4);
  const items: OrderItem[] = [];
  for (let k = 0; k < count; k += 1) {
    const idx = (i + k * 2) % productSeed.length;
    const seed = productSeed[idx]!;
    const availability = availabilityOpts[(i + k) % availabilityOpts.length]!;
    const matrixStatus = hasMatrixLink && k === 0
      ? "входит в матрицу"
      : matrixOpts[(i + k * 3) % matrixOpts.length]!;
    const showcaseStatus = hasShowcaseLink && k === 1
      ? "отсутствует на витрине"
      : showcaseOpts[(i + k) % showcaseOpts.length]!;
    items.push({
      productId: seed.id,
      productName: seed.name,
      productArticle: seed.article,
      category: seed.category,
      quantity: 2 + ((i + k) % 6),
      unit: seed.category === "Фурнитура" ? "компл." : "шт.",
      availability,
      warehouseStatus:
        availability === "в наличии"
          ? "Есть на складе"
          : availability === "недостаточно"
            ? "Недостаточно — запланирована поставка"
            : "Подтверждается со склада",
      linkedMatrixStatus: matrixStatus,
      linkedShowcaseStatus: showcaseStatus,
    });
  }
  return items;
}

function buildAttentionFlags(
  status: OrderStatus,
  payment: OrderPaymentStatus,
  shipment: OrderShipmentStatus,
  matrixLink: boolean,
  showcaseLink: boolean,
  partial: boolean,
  changed: boolean,
): OrderAttentionFlag[] {
  const flags: OrderAttentionFlag[] = [];
  if (status === "новый") flags.push("новый");
  if (status === "на подтверждении") flags.push("на подтверждении");
  if (payment === "проблема оплаты") flags.push("проблема оплаты");
  if (shipment === "проблема отгрузки") flags.push("проблема отгрузки");
  if (changed) flags.push("изменение состава");
  if (partial || status === "частично укомплектован") flags.push("неполная комплектация");
  if (matrixLink) flags.push("связан с матрицей");
  if (showcaseLink) flags.push("связан с витриной");
  return flags;
}

function buildHistory(i: number, status: OrderStatus): OrderHistoryEvent[] {
  const baseDate = dateFor(i, 0);
  const events: OrderHistoryEvent[] = [
    { id: `h-${i}-1`, date: baseDate, text: "Заказ создан в ЛК дилера" },
    { id: `h-${i}-2`, date: dateFor(i, 1), text: "Заказ передан в синхронизированный контур" },
  ];
  if (status !== "новый" && status !== "на подтверждении") {
    events.push({ id: `h-${i}-3`, date: dateFor(i, 2), text: "Подтверждение менеджером" });
  }
  if (
    status === "в комплектации" ||
    status === "частично укомплектован" ||
    status === "отгружен" ||
    status === "доставлен" ||
    status === "закрыт"
  ) {
    events.push({ id: `h-${i}-4`, date: dateFor(i, 3), text: "Передан на склад в комплектацию" });
  }
  if (status === "отгружен" || status === "доставлен" || status === "закрыт") {
    events.push({ id: `h-${i}-5`, date: dateFor(i, 4), text: "Передан в отгрузку" });
  }
  if (status === "доставлен" || status === "закрыт") {
    events.push({ id: `h-${i}-6`, date: dateFor(i, 5), text: "Доставка подтверждена" });
  }
  return events;
}

function buildOrdersForDealer(dealer: DealerRow, warehouses: DealerWarehouse[]): OrderRow[] {
  const i = dealerSeedIndex(dealer);
  const points = dealer.tradePoints;
  const ordersPerDealer = 2 + (i % 3);
  const out: OrderRow[] = [];

  for (let k = 0; k < ordersPerDealer; k += 1) {
    const pointIdx = points.length > 0 ? (i + k) % points.length : -1;
    const point = pointIdx >= 0 ? points[pointIdx] : undefined;
    const warehouse = pickWarehouseForPoint(warehouses, point, k);
    const status = STATUS_FLOW[(i + k) % STATUS_FLOW.length]!;
    const payment = PAYMENT_FLOW[(i + k * 2) % PAYMENT_FLOW.length]!;
    const shipment = SHIPMENT_FLOW[(i + k) % SHIPMENT_FLOW.length]!;
    const source = SOURCES[(i + k) % SOURCES.length]!;
    const matrixLink = (i + k) % 3 !== 0;
    const showcaseLink = (i + k) % 4 === 0;
    const partial = status === "частично укомплектован";
    const changed = (i + k) % 5 === 2;
    const id = `${dealer.id}-O${pad3(k + 1)}`;
    const number = `TND-${dealer.id}-${pad3(2400 + i * 7 + k)}`;
    const items = buildItems(i + k, dealer, point, matrixLink, showcaseLink);
    const flags = buildAttentionFlags(status, payment, shipment, matrixLink, showcaseLink, partial, changed);
    const nextAction =
      status === "новый"
        ? "Подтвердить заказ и проверить состав"
        : status === "на подтверждении"
          ? "Согласовать состав и сроки с дилером"
          : payment === "проблема оплаты"
            ? "Связаться с бухгалтерией дилера"
            : shipment === "проблема отгрузки"
              ? "Согласовать новую дату отгрузки"
              : status === "частично укомплектован"
                ? "Уточнить остатки и допоставку"
                : status === "в комплектации"
                  ? "Дождаться готовности отгрузки"
                  : status === "отгружен"
                    ? "Отследить доставку"
                    : "Проверить закрытие документов";

    out.push({
      id,
      number,
      date: dateFor(i + k, 0),
      updatedAt: dateFor(i + k, 4),
      dealerId: dealer.id,
      dealerName: dealer.name,
      tradePointId: point?.id,
      tradePointName: point?.name,
      warehouseId: warehouse.warehouseId,
      warehouseName: warehouse.name,
      warehouseCity: warehouse.city,
      deliveryDirection: DELIVERY_DIRECTIONS[(i + k) % DELIVERY_DIRECTIONS.length]!,
      source,
      status,
      paymentStatus: payment,
      shipmentStatus: shipment,
      totalAmountLabel: AMOUNT_LABELS[(i + k) % AMOUNT_LABELS.length]!,
      currency: "₽",
      manager: dealer.manager,
      syncOrigin: "ЛК дилера",
      syncVisibleToManager: true,
      items,
      attentionFlags: flags,
      nextAction,
      history: buildHistory(i + k, status),
    });
  }
  return out;
}

const WAREHOUSES: DealerWarehouse[] = DEALER_BASE_ROWS.flatMap((d) => buildWarehousesForDealer(d));
const ORDERS: OrderRow[] = DEALER_BASE_ROWS.flatMap((d) => {
  const wh = WAREHOUSES.filter((w) => w.dealerId === d.id);
  return buildOrdersForDealer(d, wh);
});

export function getAllOrders(): OrderRow[] {
  return ORDERS;
}

export function getOrderById(id: string): OrderRow | undefined {
  return ORDERS.find((o) => o.id === id);
}

export function getDealerWarehouses(dealerId: string): DealerWarehouse[] {
  return WAREHOUSES.filter((w) => w.dealerId === dealerId);
}

export function getOrdersForDealer(dealerId: string): OrderRow[] {
  return ORDERS.filter((o) => o.dealerId === dealerId);
}

export function getOrdersForTradePoint(dealerId: string, tradePointId: string): OrderRow[] {
  return ORDERS.filter((o) => o.dealerId === dealerId && o.tradePointId === tradePointId);
}

const ATTENTION_PRIORITY: OrderAttentionFlag[] = [
  "проблема оплаты",
  "проблема отгрузки",
  "новый",
  "на подтверждении",
  "неполная комплектация",
  "изменение состава",
  "связан с матрицей",
  "связан с витриной",
];

export function orderNeedsManagerAttention(order: OrderRow): boolean {
  return order.attentionFlags.some((f) =>
    [
      "новый",
      "на подтверждении",
      "проблема оплаты",
      "проблема отгрузки",
      "изменение состава",
      "неполная комплектация",
      "связан с матрицей",
      "связан с витриной",
    ].includes(f),
  );
}

function attentionScore(order: OrderRow): number {
  let score = 0;
  for (const f of order.attentionFlags) {
    const idx = ATTENTION_PRIORITY.indexOf(f);
    if (idx >= 0) score += ATTENTION_PRIORITY.length - idx;
  }
  return score;
}

export function getOrdersForSalesManager(managerName: string, limit = 8): OrderRow[] {
  const mine = ORDERS.filter((o) => o.manager === managerName && orderNeedsManagerAttention(o));
  const fallback = ORDERS.filter(orderNeedsManagerAttention);
  const pool = mine.length > 0 ? mine : fallback;
  return [...pool].sort((a, b) => attentionScore(b) - attentionScore(a)).slice(0, limit);
}

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  "новый": "border-primary/40 bg-primary/10 text-primary",
  "на подтверждении": "border-amber-200 bg-amber-50 text-amber-950",
  "подтверждён": "border-sky-200 bg-sky-50 text-sky-950",
  "в комплектации": "border-amber-200 bg-amber-50 text-amber-950",
  "частично укомплектован": "border-amber-300 bg-amber-100/70 text-amber-950",
  "отгружен": "border-emerald-200 bg-emerald-50 text-emerald-900",
  "доставлен": "border-emerald-300 bg-emerald-100/70 text-emerald-950",
  "закрыт": "border-border bg-muted/60 text-foreground",
  "отменён": "border-neutral-200 bg-muted text-muted-foreground",
};

export const ORDER_PAYMENT_TONE: Record<OrderPaymentStatus, string> = {
  "ожидает оплату": "border-amber-200 bg-amber-50 text-amber-950",
  "частично оплачен": "border-amber-300 bg-amber-100/70 text-amber-950",
  "оплачен": "border-emerald-200 bg-emerald-50 text-emerald-900",
  "проблема оплаты": "border-red-200 bg-red-50 text-red-900",
  "не требуется": "border-border bg-muted/60 text-foreground",
};

export const ORDER_SHIPMENT_TONE: Record<OrderShipmentStatus, string> = {
  "не отгружен": "border-border bg-muted/60 text-foreground",
  "готовится": "border-amber-200 bg-amber-50 text-amber-950",
  "частично отгружен": "border-amber-300 bg-amber-100/70 text-amber-950",
  "отгружен": "border-emerald-200 bg-emerald-50 text-emerald-900",
  "доставлен": "border-emerald-300 bg-emerald-100/70 text-emerald-950",
  "проблема отгрузки": "border-red-200 bg-red-50 text-red-900",
};

export const ORDER_FLAG_TONE: Record<OrderAttentionFlag, string> = {
  "новый": "border-primary/40 bg-primary/10 text-primary",
  "на подтверждении": "border-amber-200 bg-amber-50 text-amber-950",
  "проблема оплаты": "border-red-200 bg-red-50 text-red-900",
  "проблема отгрузки": "border-red-200 bg-red-50 text-red-900",
  "изменение состава": "border-amber-200 bg-amber-50 text-amber-950",
  "неполная комплектация": "border-amber-300 bg-amber-100/70 text-amber-950",
  "связан с матрицей": "border-sky-200 bg-sky-50 text-sky-950",
  "связан с витриной": "border-sky-200 bg-sky-50 text-sky-950",
};

/** Быстрые фильтры журнала заказов на `/orders`. */
export type OrdersQuickFilter = "all" | "new" | "payment" | "shipment" | "attention";

export function orderAwaitingConfirmation(o: OrderRow): boolean {
  return o.status === "на подтверждении" || o.status === "новый" || o.attentionFlags.includes("на подтверждении");
}

export function orderPaymentProblem(o: OrderRow): boolean {
  return o.paymentStatus === "проблема оплаты" || o.attentionFlags.includes("проблема оплаты");
}

export function orderShipmentProblem(o: OrderRow): boolean {
  return o.shipmentStatus === "проблема отгрузки" || o.attentionFlags.includes("проблема отгрузки");
}

export function summarizeOrdersKpis(rows: OrderRow[]) {
  return {
    total: rows.length,
    attention: rows.filter(orderNeedsManagerAttention).length,
    awaiting: rows.filter(orderAwaitingConfirmation).length,
    pay: rows.filter(orderPaymentProblem).length,
    ship: rows.filter(orderShipmentProblem).length,
  };
}

export function applyOrdersQuickFilter(rows: OrderRow[], f: OrdersQuickFilter): OrderRow[] {
  if (f === "all") return rows;
  if (f === "new") return rows.filter(orderAwaitingConfirmation);
  if (f === "payment") return rows.filter(orderPaymentProblem);
  if (f === "shipment") return rows.filter(orderShipmentProblem);
  return rows.filter(orderNeedsManagerAttention);
}

export function applyOrdersSearch(rows: OrderRow[], q: string): OrderRow[] {
  const n = q.trim().toLowerCase();
  if (!n) return rows;
  return rows.filter((o) => {
    if (o.number.toLowerCase().includes(n) || o.id.toLowerCase().includes(n)) return true;
    if (o.dealerName.toLowerCase().includes(n)) return true;
    if (o.warehouseName.toLowerCase().includes(n)) return true;
    if (o.tradePointName?.toLowerCase().includes(n)) return true;
    if (o.nextAction.toLowerCase().includes(n)) return true;
    return o.items.some(
      (it) =>
        it.productName.toLowerCase().includes(n) ||
        it.productArticle.toLowerCase().includes(n) ||
        it.productId.toLowerCase().includes(n),
    );
  });
}
