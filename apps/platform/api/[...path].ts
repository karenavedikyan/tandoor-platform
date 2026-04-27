// Self-contained Vercel serverless function for the demo API.
//
// IMPORTANT: This file intentionally does NOT import from `server/*` or
// from the `@shared/*` TypeScript path alias. Vercel's serverless Node
// runtime bundles only this file and its (relative) dependencies, and it
// does not know about `tsconfig` path aliases. Importing through
// `@shared/schema` previously caused FUNCTION_INVOCATION_FAILED at runtime
// because the alias could not be resolved by the bundler, and it also
// pulled in `drizzle-orm` / `better-sqlite3` (a native module) that is
// not needed for the in-memory demo data.
//
// The local Express dev server keeps using `server/api-handlers.ts` and
// `server/storage.ts` — they share the same response shapes.

import { z } from "zod";

// ---------- Types (mirror of shared/schema.ts $inferSelect shapes) ----------

type Organization = {
  id: number;
  name: string;
  orgType: string;
  taxId: string | null;
  city: string | null;
  status: string;
  createdAt: string;
};

type Role = {
  id: number;
  code: string;
  name: string;
  description: string | null;
};

type User = {
  id: number;
  organizationId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
};

type UserRole = {
  id: number;
  userId: number;
  roleId: number;
  assignedAt: string;
};

type Dealer = {
  id: number;
  organizationId: number;
  name: string;
  dealerType: string;
  segment: string | null;
  region: string | null;
  city: string | null;
  salesManagerId: number | null;
  regionalManagerId: number | null;
  potentialLevel: string | null;
  status: string;
  managerUserId: number | null;
  tier: string | null;
  comment: string | null;
  createdAt: string;
};

type TradePoint = {
  id: number;
  dealerId: number;
  name: string;
  city: string;
  address: string;
  storeFormat: string;
  areaSqm: number | null;
  assortmentProfile: string;
  status: string;
  comment: string | null;
  createdAt: string;
};

type DealerTask = {
  id: number;
  dealerId: number;
  tradePointId: number | null;
  assignedToUserId: number;
  createdByUserId: number;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  source: string;
  createdAt: string;
  completedAt: string | null;
};

type DealerInteraction = {
  id: number;
  dealerId: number;
  tradePointId: number | null;
  userId: number;
  roleContext: string;
  type: string;
  summary: string;
  createdAt: string;
};

type UserPublic = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
};

type DealerListItem = {
  id: number;
  organizationId: number;
  organizationName: string;
  name: string;
  dealerType: "network" | "single";
  segment: string | null;
  status: string;
  salesManagerId: number | null;
  regionalManagerId: number | null;
  region: string | null;
  city: string | null;
  potentialLevel: "high" | "medium" | "low" | null;
  tradePointCount: number;
  activeTaskCount: number;
  lastInteractionDate: string | null;
  comment: string | null;
  createdAt: string;
  salesManager: UserPublic | null;
  regionalManager: UserPublic | null;
  salesManagerName: string;
  regionalManagerName: string;
};

type DealerDetail = {
  dealer: DealerListItem;
  tradePoints: TradePoint[];
  tasks: (DealerTask & { assignedToUserName: string; createdByUserName: string })[];
  interactions: (DealerInteraction & { userName: string })[];
  recentOrders: Order[];
  recentClaims: Claim[];
  distributionSummary: {
    tradePointsCovered: number;
    totalTradePoints: number;
    activeShowcaseGoals: number;
    activeDistributionTasks: number;
    placeholder: string;
  };
};

type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  finishColor: string;
  priceCents: number;
  currency: string;
  availabilityStatus: string;
  stockQty: number;
  createdAt: string;
};

type Order = {
  id: number;
  orderNumber: string;
  organizationId: number;
  dealerId: number;
  createdByUserId: number;
  status: string;
  totalCents: number;
  currency: string;
  requestedDeliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrderItem = {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
};

type Document = {
  id: number;
  organizationId: number;
  orderId: number | null;
  type: string;
  title: string;
  fileUrl: string | null;
  status: string;
  createdAt: string;
};

type Claim = {
  id: number;
  claimNumber: string;
  organizationId: number;
  dealerId: number;
  orderId: number | null;
  status: string;
  reason: string;
  description: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

type ActivityEvent = {
  id: number;
  eventType: string;
  entityType: string;
  entityId: number;
  organizationId: number;
  userId: number;
  orderId: number | null;
  claimId: number | null;
  message: string;
  createdAt: string;
};

type OrderDetails = Order & {
  items: OrderItem[];
  documents: Document[];
};

// ---------- Seed data (must stay in sync with server/storage.ts) ----------

const organizationsSeed: Organization[] = [
  { id: 1, name: "Tandoor HQ", orgType: "tandoor", taxId: "770401001", city: "Москва", status: "active", createdAt: "2026-01-10T09:00:00.000Z" },
  { id: 2, name: "Дверной Дом Юг", orgType: "dealer", taxId: "2312012345", city: "Краснодар", status: "active", createdAt: "2026-01-12T08:15:00.000Z" },
  { id: 3, name: "Салон дверей Северный", orgType: "dealer", taxId: "2312012346", city: "Краснодар", status: "active", createdAt: "2026-01-13T10:25:00.000Z" },
  { id: 4, name: "Дом дверей Сочи", orgType: "dealer", taxId: "2312012347", city: "Сочи", status: "active", createdAt: "2026-01-15T11:05:00.000Z" },
];

const usersSeed: User[] = [
  { id: 1, organizationId: 1, firstName: "Ольга", lastName: "Соколова", email: "o.sokolova@tandoor.ru", phone: "+7 900 000-10-10", status: "active", createdAt: "2026-01-10T09:30:00.000Z" },
  { id: 2, organizationId: 1, firstName: "Ольга", lastName: "Соколова", email: "o.sokolova@tandoor.ru", phone: "+7 900 000-10-20", status: "active", createdAt: "2026-01-10T10:00:00.000Z" },
  { id: 3, organizationId: 1, firstName: "Дмитрий", lastName: "Романов", email: "d.romanov@tandoor.ru", phone: "+7 900 000-10-30", status: "active", createdAt: "2026-01-10T10:10:00.000Z" },
  { id: 4, organizationId: 1, firstName: "Мария", lastName: "Лебедева", email: "m.lebedeva@tandoor.ru", phone: "+7 900 000-10-40", status: "active", createdAt: "2026-01-10T10:20:00.000Z" },
  { id: 5, organizationId: 1, firstName: "Анна", lastName: "Кравченко", email: "a.kravchenko@tandoor.ru", phone: "+7 900 000-10-50", status: "active", createdAt: "2026-01-10T10:30:00.000Z" },
  { id: 6, organizationId: 1, firstName: "Сергей", lastName: "Волков", email: "s.volkov@tandoor.ru", phone: "+7 900 000-10-60", status: "active", createdAt: "2026-01-10T10:40:00.000Z" },
  { id: 7, organizationId: 1, firstName: "Игорь", lastName: "Мельников", email: "i.melnikov@tandoor.ru", phone: "+7 900 000-10-70", status: "active", createdAt: "2026-01-10T10:50:00.000Z" },
];

const dealersSeed: Dealer[] = [
  { id: 1, organizationId: 2, name: "Дверной Дом Юг", dealerType: "network", segment: "сеть салонов дверей", region: "Краснодарский край", city: "Краснодар", salesManagerId: 5, regionalManagerId: 7, potentialLevel: "high", status: "active", managerUserId: 5, tier: "high", comment: "Ключевой сетевой партнёр на Юге, растущая выкладка и витрины.", createdAt: "2026-01-12T08:50:00.000Z" },
  { id: 2, organizationId: 3, name: "Салон дверей Северный", dealerType: "single", segment: "одиночный салон", region: "Краснодарский край", city: "Краснодар", salesManagerId: 5, regionalManagerId: 7, potentialLevel: "medium", status: "active", managerUserId: 5, tier: "medium", comment: "Точка в развитии: согласование ассортимента и обучение персонала.", createdAt: "2026-01-13T11:25:00.000Z" },
  { id: 3, organizationId: 4, name: "Дом дверей Сочи", dealerType: "single", segment: "региональный дилер", region: "Краснодарский край", city: "Сочи", salesManagerId: 5, regionalManagerId: 7, potentialLevel: "medium", status: "active", managerUserId: 5, tier: "medium", comment: "Стабильные заказы, фокус на витрине премиум-серии в сезон.", createdAt: "2026-01-14T09:15:00.000Z" },
];

const tradePointsSeed: TradePoint[] = [
  { id: 1, dealerId: 1, name: "Дверной Дом Юг — Краснодар", city: "Краснодар", address: "ул. Северная, 320", storeFormat: "showroom", areaSqm: 180, assortmentProfile: "входные и межкомнатные, премиум", status: "active", comment: null, createdAt: "2026-01-12T08:55:00.000Z" },
  { id: 2, dealerId: 1, name: "Дверной Дом Юг — Анапа", city: "Анапа", address: "ул. Ленина, 14", storeFormat: "showroom", areaSqm: 95, assortmentProfile: "входные, массив", status: "active", comment: null, createdAt: "2026-01-16T10:05:00.000Z" },
  { id: 3, dealerId: 1, name: "Дверной Дом Юг — Новороссийск", city: "Новороссийск", address: "пр-т Дзержинского, 211", storeFormat: "mixed", areaSqm: 120, assortmentProfile: "смешанный формат, усиление витрины", status: "active", comment: null, createdAt: "2026-01-19T11:20:00.000Z" },
  { id: 4, dealerId: 2, name: "Салон дверей Северный", city: "Краснодар", address: "ул. Российская, 74", storeFormat: "retail_store", areaSqm: 65, assortmentProfile: "межкомнатные, средний сегмент", status: "active", comment: null, createdAt: "2026-01-13T11:35:00.000Z" },
  { id: 5, dealerId: 3, name: "Дом дверей Сочи", city: "Сочи", address: "ул. Пластунская, 52", storeFormat: "showroom", areaSqm: 45, assortmentProfile: "компактная витрина, курортный трафик", status: "active", comment: null, createdAt: "2026-01-14T09:25:00.000Z" },
];

const dealerTasksSeed: DealerTask[] = [
  { id: 1, dealerId: 1, tradePointId: 1, assignedToUserId: 5, createdByUserId: 7, type: "showcase_goal", title: "Цель по витрине: линия Loft в Краснодаре", description: "Согласовать план выкладки серии Loft в основном зале до конца квартала.", status: "in_progress", priority: "high", dueDate: "2026-04-15", source: "regional_manager", createdAt: "2026-04-01T10:00:00.000Z", completedAt: null },
  { id: 2, dealerId: 1, tradePointId: null, assignedToUserId: 5, createdByUserId: 5, type: "call", title: "Звонок по отгрузке и условиям", description: "Уточнить сроки поставки и коммерческие условия по текущему договору.", status: "done", priority: "medium", dueDate: "2026-03-28", source: "sales_manager", createdAt: "2026-03-20T11:00:00.000Z", completedAt: "2026-03-27T16:00:00.000Z" },
  { id: 3, dealerId: 1, tradePointId: 2, assignedToUserId: 7, createdByUserId: 2, type: "visit_follow_up", title: "Проверить наличие POSM", description: "Закрепить договорённости по фокусу на входные двери премиум.", status: "new", priority: "medium", dueDate: "2026-04-20", source: "visit", createdAt: "2026-04-10T08:00:00.000Z", completedAt: null },
  { id: 4, dealerId: 2, tradePointId: 4, assignedToUserId: 6, createdByUserId: 5, type: "sales_follow_up", title: "Согласовать расширение матрицы", description: "Подготовить шаблоны актов и спецификации для подписания.", status: "in_progress", priority: "low", dueDate: "2026-04-12", source: "manual", createdAt: "2026-04-05T12:00:00.000Z", completedAt: null },
  { id: 5, dealerId: 2, tradePointId: null, assignedToUserId: 5, createdByUserId: 7, type: "other", title: "Синхронизация по ТТ в развитии", description: "Согласовать график выездов и приоритеты витрины.", status: "new", priority: "medium", dueDate: "2026-04-18", source: "regional_manager", createdAt: "2026-04-08T14:00:00.000Z", completedAt: null },
  { id: 6, dealerId: 3, tradePointId: 5, assignedToUserId: 7, createdByUserId: 5, type: "other", title: "Обновить витрину входных дверей", description: "Согласовать замену позиции в заказе из-за сроков производства.", status: "in_progress", priority: "high", dueDate: "2026-04-11", source: "order", createdAt: "2026-04-09T09:30:00.000Z", completedAt: null },
];

const dealerInteractionsSeed: DealerInteraction[] = [
  { id: 1, dealerId: 1, tradePointId: 1, userId: 5, roleContext: "sales_manager", type: "call", summary: "Короткий звонок: подтверждение поставки и согласование встречи по витрине.", createdAt: "2026-04-02T09:00:00.000Z" },
  { id: 2, dealerId: 1, tradePointId: 1, userId: 7, roleContext: "regional_manager", type: "visit", summary: "Полевой визит в Краснодар, осмотр основной витрины, отметка по дистрибуции.", createdAt: "2026-04-03T11:30:00.000Z" },
  { id: 3, dealerId: 1, tradePointId: 2, userId: 1, roleContext: "system", type: "task_created", summary: "Черновик отчёта дистрибуции по точке в Анапе (фото витрины, топ SKU).", createdAt: "2026-04-04T08:15:00.000Z" },
  { id: 4, dealerId: 2, tradePointId: 4, userId: 5, roleContext: "sales_manager", type: "meeting", summary: "Онлайн-встреча с владельцем: дорожная карта развития точки.", createdAt: "2026-04-05T10:00:00.000Z" },
  { id: 5, dealerId: 2, tradePointId: null, userId: 2, roleContext: "sales_head", type: "task_created", summary: "Создана операционная задача ассистенту по подготовке документов к договору.", createdAt: "2026-04-05T12:00:00.000Z" },
  { id: 6, dealerId: 2, tradePointId: null, userId: 4, roleContext: "sales_assistant", type: "meeting", summary: "Уточнение реквизитов и сроков подготовки спецификации.", createdAt: "2026-04-05T15:00:00.000Z" },
  { id: 7, dealerId: 3, tradePointId: 5, userId: 7, roleContext: "regional_manager", type: "visit", summary: "Плановый визит в Сочи, согласование площади под новую витрину.", createdAt: "2026-04-07T13:00:00.000Z" },
  { id: 8, dealerId: 3, tradePointId: 5, userId: 5, roleContext: "sales_manager", type: "message", summary: "Согласованы скидка и сроки по срочному заказу; передано в производство.", createdAt: "2026-04-09T09:00:00.000Z" },
];

const productsSeed: Product[] = [
  { id: 1, sku: "TD-ENTRY-860-BLK", name: "Tandoor Entry 860", category: "entry_door", finishColor: "Graphite Black", priceCents: 6890000, currency: "RUB", availabilityStatus: "in_stock", stockQty: 24, createdAt: "2026-01-16T08:00:00.000Z" },
  { id: 2, sku: "TD-ENTRY-960-OAK", name: "Tandoor Entry 960", category: "entry_door", finishColor: "Natural Oak", priceCents: 7450000, currency: "RUB", availabilityStatus: "in_stock", stockQty: 17, createdAt: "2026-01-16T08:02:00.000Z" },
  { id: 3, sku: "TD-LINE-GLASS-WHT", name: "Tandoor Line Glass", category: "interior_door", finishColor: "Polar White", priceCents: 3820000, currency: "RUB", availabilityStatus: "limited", stockQty: 8, createdAt: "2026-01-16T08:04:00.000Z" },
  { id: 4, sku: "TD-FIRE-900-MTL", name: "Tandoor FireSafe 900", category: "fire_door", finishColor: "Metal Gray", priceCents: 9120000, currency: "RUB", availabilityStatus: "in_stock", stockQty: 11, createdAt: "2026-01-16T08:06:00.000Z" },
  { id: 5, sku: "TD-LOFT-880-GRN", name: "Tandoor Loft 880", category: "entry_door", finishColor: "Olive Green", priceCents: 6990000, currency: "RUB", availabilityStatus: "backorder", stockQty: 0, createdAt: "2026-01-16T08:08:00.000Z" },
];

const ordersSeed: Order[] = [
  { id: 1, orderNumber: "ORD-2026-0001", organizationId: 1, dealerId: 1, createdByUserId: 5, status: "submitted", totalCents: 20670000, currency: "RUB", requestedDeliveryDate: "2026-02-05", createdAt: "2026-01-20T10:15:00.000Z", updatedAt: "2026-01-20T10:15:00.000Z" },
  { id: 2, orderNumber: "ORD-2026-0002", organizationId: 1, dealerId: 2, createdByUserId: 5, status: "assembling", totalCents: 14900000, currency: "RUB", requestedDeliveryDate: "2026-02-08", createdAt: "2026-01-21T09:40:00.000Z", updatedAt: "2026-01-23T12:00:00.000Z" },
  { id: 3, orderNumber: "ORD-2026-0003", organizationId: 1, dealerId: 1, createdByUserId: 5, status: "shipped", totalCents: 9120000, currency: "RUB", requestedDeliveryDate: "2026-01-30", createdAt: "2026-01-18T14:10:00.000Z", updatedAt: "2026-01-24T07:30:00.000Z" },
];

const orderItemsSeed: OrderItem[] = [
  { id: 1, orderId: 1, productId: 1, quantity: 2, unitPriceCents: 6890000, totalPriceCents: 13780000 },
  { id: 2, orderId: 1, productId: 3, quantity: 1, unitPriceCents: 3820000, totalPriceCents: 3820000 },
  { id: 3, orderId: 1, productId: 2, quantity: 1, unitPriceCents: 7450000, totalPriceCents: 7450000 },
  { id: 4, orderId: 2, productId: 2, quantity: 2, unitPriceCents: 7450000, totalPriceCents: 14900000 },
  { id: 5, orderId: 3, productId: 4, quantity: 1, unitPriceCents: 9120000, totalPriceCents: 9120000 },
];

const documentsSeed: Document[] = [
  { id: 1, organizationId: 1, orderId: 1, type: "invoice", title: "Invoice INV-0001", fileUrl: "/docs/invoice-inv-0001.pdf", status: "published", createdAt: "2026-01-20T10:20:00.000Z" },
  { id: 2, organizationId: 1, orderId: 2, type: "contract", title: "Supply Contract SC-2026-02", fileUrl: "/docs/contract-sc-2026-02.pdf", status: "published", createdAt: "2026-01-21T10:00:00.000Z" },
  { id: 3, organizationId: 1, orderId: 3, type: "shipment_document", title: "Shipment Waybill SHP-143", fileUrl: "/docs/waybill-shp-143.pdf", status: "published", createdAt: "2026-01-24T07:35:00.000Z" },
];

const claimsSeed: Claim[] = [
  { id: 1, claimNumber: "CLM-2026-001", organizationId: 1, dealerId: 1, orderId: 3, status: "in_review", reason: "Packaging damage", description: "Minor panel scratches found on delivery.", resolutionNote: null, createdAt: "2026-01-25T11:10:00.000Z", updatedAt: "2026-01-25T11:30:00.000Z" },
  { id: 2, claimNumber: "CLM-2026-002", organizationId: 1, dealerId: 2, orderId: null, status: "new", reason: "Wrong finish color", description: "Requested oak finish, delivered white finish.", resolutionNote: null, createdAt: "2026-01-26T09:25:00.000Z", updatedAt: "2026-01-26T09:25:00.000Z" },
];

const activityEventsSeed: ActivityEvent[] = [
  { id: 1, eventType: "order_created", entityType: "order", entityId: 1, organizationId: 1, userId: 5, orderId: 1, claimId: null, message: "Создан заказ ORD-2026-0001 менеджером продаж.", createdAt: "2026-01-20T10:15:00.000Z" },
  { id: 2, eventType: "document_added", entityType: "document", entityId: 1, organizationId: 1, userId: 5, orderId: 1, claimId: null, message: "К заказу ORD-2026-0001 добавлен счёт INV-0001.", createdAt: "2026-01-20T10:20:00.000Z" },
  { id: 3, eventType: "order_status_changed", entityType: "order", entityId: 2, organizationId: 1, userId: 5, orderId: 2, claimId: null, message: "Заказ ORD-2026-0002 переведён в комплектацию.", createdAt: "2026-01-23T12:00:00.000Z" },
  { id: 4, eventType: "order_status_changed", entityType: "order", entityId: 3, organizationId: 1, userId: 5, orderId: 3, claimId: null, message: "Заказ ORD-2026-0003 отгружен со склада.", createdAt: "2026-01-24T07:30:00.000Z" },
  { id: 5, eventType: "claim_created", entityType: "claim", entityId: 1, organizationId: 1, userId: 5, orderId: 3, claimId: 1, message: "Создана рекламация CLM-2026-001 по заказу ORD-2026-0003.", createdAt: "2026-01-25T11:10:00.000Z" },
  { id: 6, eventType: "claim_created", entityType: "claim", entityId: 2, organizationId: 1, userId: 5, orderId: null, claimId: 2, message: "Создана рекламация CLM-2026-002 без привязки к заказу.", createdAt: "2026-01-26T09:25:00.000Z" },
];

// Suppress "unused" warnings for the role/userRole shapes — kept for parity
// with the local Express server's storage.ts. They're not exposed via any
// /api endpoint that this function serves.
void ({} as Role);
void ({} as UserRole);

// ---------- Routing helpers ----------

class StorageError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "StorageError";
  }
}

function getNextId<T extends { id: number }>(entries: T[]): number {
  return entries.reduce((maxId, entry) => Math.max(maxId, entry.id), 0) + 1;
}

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const maxSequence = ordersSeed.reduce((maxValue, order) => {
    const matched = /^ORD-(\d{4})-(\d+)$/.exec(order.orderNumber);
    if (!matched) return maxValue;
    const matchedYear = Number.parseInt(matched[1], 10);
    const matchedSequence = Number.parseInt(matched[2], 10);
    if (matchedYear !== year || Number.isNaN(matchedSequence)) return maxValue;
    return Math.max(maxValue, matchedSequence);
  }, 0);
  return `ORD-${year}-${String(maxSequence + 1).padStart(4, "0")}`;
}

function getOrderDetails(id: number): OrderDetails | undefined {
  const order = ordersSeed.find((entry) => entry.id === id);
  if (!order) return undefined;
  return {
    ...order,
    items: orderItemsSeed.filter((item) => item.orderId === order.id),
    documents: documentsSeed.filter((document) => document.orderId === order.id),
  };
}

function getUserById(id: number | null | undefined): User | undefined {
  if (id == null) return undefined;
  return usersSeed.find((user) => user.id === id);
}

function userToPublic(user: User | undefined): UserPublic | null {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
  };
}

function countActiveTasks(tasks: DealerTask[]): number {
  return tasks.filter((t) => t.status === "new" || t.status === "in_progress").length;
}

function userNameById(id: number | null | undefined): string {
  const user = getUserById(id);
  if (!user) return "Не назначен";
  return `${user.firstName} ${user.lastName}`.trim();
}

function toDealerListItem(dealer: Dealer): DealerListItem {
  const salesId = dealer.salesManagerId ?? dealer.managerUserId;
  const regionalId = dealer.regionalManagerId;
  const tradePointCount = tradePointsSeed.filter((point) => point.dealerId === dealer.id).length;
  const tasksForDealer = dealerTasksSeed.filter((task) => task.dealerId === dealer.id);
  const latestInteraction =
    dealerInteractionsSeed
      .filter((entry) => entry.dealerId === dealer.id)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  return {
    id: dealer.id,
    organizationId: dealer.organizationId,
    organizationName:
      organizationsSeed.find((organization) => organization.id === dealer.organizationId)?.name ?? dealer.name,
    name: dealer.name,
    dealerType: (dealer.dealerType as "network" | "single") ?? "single",
    segment: dealer.segment,
    status: dealer.status,
    salesManagerId: salesId,
    regionalManagerId: regionalId,
    region: dealer.region,
    city: dealer.city,
    potentialLevel: (dealer.potentialLevel as "high" | "medium" | "low" | null) ?? null,
    tradePointCount,
    activeTaskCount: countActiveTasks(tasksForDealer),
    lastInteractionDate: latestInteraction?.createdAt ?? null,
    comment: dealer.comment,
    createdAt: dealer.createdAt,
    salesManager: userToPublic(getUserById(salesId)),
    regionalManager: userToPublic(getUserById(regionalId)),
    salesManagerName: userNameById(salesId),
    regionalManagerName: userNameById(regionalId),
  };
}

function getDealerSummaryList(): DealerListItem[] {
  return dealersSeed.map((dealer) => toDealerListItem(dealer));
}

function getDealerDetail(id: number): DealerDetail | undefined {
  const dealer = dealersSeed.find((d) => d.id === id);
  if (!dealer) return undefined;
  const tradePoints = tradePointsSeed.filter((point) => point.dealerId === dealer.id).sort((a, b) => a.id - b.id);
  const tasks = dealerTasksSeed
    .filter((task) => task.dealerId === dealer.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((task) => ({
      ...task,
      assignedToUserName: userNameById(task.assignedToUserId),
      createdByUserName: userNameById(task.createdByUserId),
    }));
  const interactions = dealerInteractionsSeed
    .filter((entry) => entry.dealerId === dealer.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((interaction) => ({
      ...interaction,
      userName: userNameById(interaction.userId),
    }));
  const recentOrders = ordersSeed
    .filter((order) => order.dealerId === dealer.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const recentClaims = claimsSeed
    .filter((claim) => claim.dealerId === dealer.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const activeShowcaseGoals = dealerTasksSeed.filter(
    (task) =>
      task.dealerId === dealer.id &&
      task.type === "showcase_goal" &&
      task.status !== "done" &&
      task.status !== "rejected",
  ).length;
  const activeDistributionTasks = dealerTasksSeed.filter(
    (task) =>
      task.dealerId === dealer.id &&
      task.type === "distribution_gap" &&
      task.status !== "done" &&
      task.status !== "rejected",
  ).length;

  return {
    dealer: toDealerListItem(dealer),
    tradePoints,
    tasks,
    interactions,
    recentOrders,
    recentClaims,
    distributionSummary: {
      tradePointsCovered: tradePoints.filter((point) => point.status === "active").length,
      totalTradePoints: tradePoints.length,
      activeShowcaseGoals,
      activeDistributionTasks,
      placeholder:
        "Здесь будет отображаться покрытие моделей Tandoor по торговым точкам дилера после запуска отчетов дистрибуции.",
    },
  };
}

const createOrderRequestSchema = z.object({
  dealerId: z.number().int().positive(),
  createdByUserId: z.number().int().positive().optional(),
  salesManagerId: z.number().int().positive().optional(),
  comment: z.string().trim().max(1000).optional(),
  items: z
    .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int() }))
    .min(1),
});

type ApiResult = { status: number; body: unknown };

function listOrganizations(): ApiResult { return { status: 200, body: organizationsSeed }; }
function listUsers(): ApiResult { return { status: 200, body: usersSeed }; }
function listDealers(): ApiResult { return { status: 200, body: getDealerSummaryList() }; }
function getDealerByIdRoute(rawId: string): ApiResult {
  const id = Number.parseInt(rawId, 10);
  if (Number.isNaN(id)) return { status: 400, body: { message: "ID дилера должен быть числом" } };
  const detail = getDealerDetail(id);
  if (!detail) return { status: 404, body: { message: "Дилер не найден" } };
  return { status: 200, body: detail };
}
function getDealerTradePointsRoute(rawId: string): ApiResult {
  const id = Number.parseInt(rawId, 10);
  if (Number.isNaN(id)) return { status: 400, body: { message: "ID дилера должен быть числом" } };
  if (!dealersSeed.find((d) => d.id === id)) return { status: 404, body: { message: "Дилер не найден" } };
  const list = tradePointsSeed.filter((p) => p.dealerId === id).sort((a, b) => a.id - b.id);
  return { status: 200, body: list };
}
function getDealerTasksRoute(rawId: string): ApiResult {
  const id = Number.parseInt(rawId, 10);
  if (Number.isNaN(id)) return { status: 400, body: { message: "ID дилера должен быть числом" } };
  if (!dealersSeed.find((d) => d.id === id)) return { status: 404, body: { message: "Дилер не найден" } };
  const list = dealerTasksSeed
    .filter((task) => task.dealerId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((task) => ({
      ...task,
      assignedToUserName: userNameById(task.assignedToUserId),
      createdByUserName: userNameById(task.createdByUserId),
    }));
  return { status: 200, body: list };
}
function getDealerInteractionsRoute(rawId: string): ApiResult {
  const id = Number.parseInt(rawId, 10);
  if (Number.isNaN(id)) return { status: 400, body: { message: "ID дилера должен быть числом" } };
  if (!dealersSeed.find((d) => d.id === id)) return { status: 404, body: { message: "Дилер не найден" } };
  const list = dealerInteractionsSeed
    .filter((entry) => entry.dealerId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((interaction) => ({
      ...interaction,
      userName: userNameById(interaction.userId),
    }));
  return { status: 200, body: list };
}
function listProducts(): ApiResult { return { status: 200, body: productsSeed }; }
function listOrders(): ApiResult {
  return { status: 200, body: [...ordersSeed].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}
function listClaims(): ApiResult { return { status: 200, body: claimsSeed }; }
function listActivity(): ApiResult {
  return { status: 200, body: [...activityEventsSeed].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
}

function getOrderByIdRoute(rawId: string): ApiResult {
  const id = Number.parseInt(rawId, 10);
  if (Number.isNaN(id)) return { status: 400, body: { message: "Order id must be a valid number" } };
  const order = getOrderDetails(id);
  if (!order) return { status: 404, body: { message: "Order not found" } };
  return { status: 200, body: order };
}

function createOrder(body: unknown): ApiResult {
  const parsed = createOrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        message: "Invalid order payload",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
    };
  }
  const payload = parsed.data;
  const createdByUserId = payload.createdByUserId ?? payload.salesManagerId;
  if (!createdByUserId) {
    return { status: 400, body: { message: "Either createdByUserId or salesManagerId must be provided" } };
  }
  if (payload.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    return { status: 422, body: { message: "Each order item quantity must be at least 1" } };
  }

  try {
    const dealer = dealersSeed.find((entry) => entry.id === payload.dealerId);
    if (!dealer) throw new StorageError(404, "Dealer not found");
    const createdByUser = usersSeed.find((entry) => entry.id === createdByUserId);
    if (!createdByUser) throw new StorageError(404, "User not found");

    const mergedItems = new Map<number, number>();
    for (const item of payload.items) {
      mergedItems.set(item.productId, (mergedItems.get(item.productId) ?? 0) + item.quantity);
    }

    let totalCents = 0;
    let nextOrderItemId = getNextId(orderItemsSeed);
    const newOrderId = getNextId(ordersSeed);
    const newOrderItems: OrderItem[] = [];

    for (const [productId, quantity] of Array.from(mergedItems.entries())) {
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new StorageError(422, "Each order item quantity must be at least 1");
      }
      const product = productsSeed.find((entry) => entry.id === productId);
      if (!product) throw new StorageError(404, `Product ${productId} not found`);
      const totalPriceCents = product.priceCents * quantity;
      totalCents += totalPriceCents;
      newOrderItems.push({
        id: nextOrderItemId,
        orderId: newOrderId,
        productId,
        quantity,
        unitPriceCents: product.priceCents,
        totalPriceCents,
      });
      nextOrderItemId += 1;
    }

    const nowIso = new Date().toISOString();
    const order: Order = {
      id: newOrderId,
      orderNumber: generateOrderNumber(),
      organizationId: createdByUser.organizationId,
      dealerId: dealer.id,
      createdByUserId: createdByUser.id,
      status: "submitted",
      totalCents,
      currency: "RUB",
      requestedDeliveryDate: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    ordersSeed.push(order);
    orderItemsSeed.push(...newOrderItems);

    const dealerOrganization = organizationsSeed.find((entry) => entry.id === dealer.organizationId);
    const commentSuffix = payload.comment?.trim() ? ` Комментарий: ${payload.comment.trim()}` : "";
    activityEventsSeed.push({
      id: getNextId(activityEventsSeed),
      eventType: "order_created",
      entityType: "order",
      entityId: order.id,
      organizationId: order.organizationId,
      userId: order.createdByUserId,
      orderId: order.id,
      claimId: null,
      message: `Создан заказ ${order.orderNumber} для дилера ${dealerOrganization?.name ?? `№${dealer.id}`}.${commentSuffix}`,
      createdAt: nowIso,
    });
    dealerInteractionsSeed.push({
      id: getNextId(dealerInteractionsSeed),
      dealerId: dealer.id,
      tradePointId: null,
      userId: createdByUser.id,
      roleContext: "sales_manager",
      type: "order",
      summary: `Оформлен заказ ${order.orderNumber}.`,
      createdAt: nowIso,
    });

    const created = getOrderDetails(order.id);
    if (!created) throw new StorageError(500, "Failed to build created order response");
    return { status: 201, body: created };
  } catch (error) {
    if (error instanceof StorageError) return { status: error.status, body: { message: error.message } };
    return { status: 500, body: { message: "Failed to create order" } };
  }
}

function routeApiRequest(method: string, pathname: string, body: unknown): ApiResult {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const upperMethod = method.toUpperCase();

  if (upperMethod === "GET" && normalized === "/api/organizations") return listOrganizations();
  if (upperMethod === "GET" && normalized === "/api/users") return listUsers();
  if (upperMethod === "GET" && normalized === "/api/dealers") return listDealers();
  const dealerTradeMatch = /^\/api\/dealers\/(\d+)\/trade-points$/.exec(normalized);
  if (upperMethod === "GET" && dealerTradeMatch) return getDealerTradePointsRoute(dealerTradeMatch[1]);
  const dealerTasksMatch = /^\/api\/dealers\/(\d+)\/tasks$/.exec(normalized);
  if (upperMethod === "GET" && dealerTasksMatch) return getDealerTasksRoute(dealerTasksMatch[1]);
  const dealerIntMatch = /^\/api\/dealers\/(\d+)\/interactions$/.exec(normalized);
  if (upperMethod === "GET" && dealerIntMatch) return getDealerInteractionsRoute(dealerIntMatch[1]);
  const dealerIdMatch = /^\/api\/dealers\/(\d+)$/.exec(normalized);
  if (upperMethod === "GET" && dealerIdMatch) return getDealerByIdRoute(dealerIdMatch[1]);
  if (upperMethod === "GET" && normalized === "/api/products") return listProducts();
  if (upperMethod === "GET" && normalized === "/api/orders") return listOrders();
  if (upperMethod === "POST" && normalized === "/api/orders") return createOrder(body);
  const orderDetailMatch = /^\/api\/orders\/([^/]+)$/.exec(normalized);
  if (upperMethod === "GET" && orderDetailMatch) return getOrderByIdRoute(orderDetailMatch[1]);
  if (upperMethod === "GET" && normalized === "/api/claims") return listClaims();
  if (upperMethod === "GET" && normalized === "/api/activity") return listActivity();

  return { status: 404, body: { message: `Not Found: ${upperMethod} ${normalized}` } };
}

// ---------- Vercel handler ----------

type VercelRequest = {
  method?: string;
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (data: unknown) => void;
  end: (data?: string) => void;
};

function readJsonBody(req: VercelRequest): unknown {
  if (req.body === undefined || req.body === null) return undefined;
  if (typeof req.body === "string") {
    if (req.body.length === 0) return undefined;
    try { return JSON.parse(req.body); } catch { return undefined; }
  }
  if (Buffer.isBuffer(req.body)) {
    const text = req.body.toString("utf8");
    if (!text) return undefined;
    try { return JSON.parse(text); } catch { return undefined; }
  }
  return req.body;
}

function getPathQueryFromUrl(rawUrl: string): string | string[] | undefined {
  const queryString = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?") + 1) : "";
  if (!queryString) {
    return undefined;
  }
  const params = new URLSearchParams(queryString);
  const values = params.getAll("path").filter((value) => value.length > 0);
  if (values.length === 0) {
    return undefined;
  }
  return values.length === 1 ? values[0] : values;
}

function normalizeRequestedPath(rawPath: string | string[] | undefined): string | undefined {
  if (rawPath == null) {
    return undefined;
  }
  const merged = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
  const cleaned = merged
    .split("/")
    .map((part) => decodeURIComponent(part).trim())
    .filter((part) => part.length > 0)
    .join("/");
  if (!cleaned || cleaned === "[...path]") {
    return "/api";
  }
  if (cleaned.startsWith("api/")) {
    return `/${cleaned}`;
  }
  if (cleaned.startsWith("/api/")) {
    return cleaned;
  }
  return `/api/${cleaned}`;
}

function resolvePathname(req: VercelRequest): string {
  const rawUrl = req.url ?? "/";
  const queryPath = req.query?.path ?? getPathQueryFromUrl(rawUrl);
  const normalizedFromQuery = normalizeRequestedPath(queryPath);
  if (normalizedFromQuery) {
    return normalizedFromQuery;
  }
  return rawUrl.split("?")[0] ?? "/";
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  const method = req.method ?? "GET";
  const pathname = resolvePathname(req);
  const body =
    method === "POST" || method === "PUT" || method === "PATCH"
      ? readJsonBody(req)
      : undefined;

  try {
    const result = routeApiRequest(method, pathname, body);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(result.status).json(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(500).json({ message });
  }
}
