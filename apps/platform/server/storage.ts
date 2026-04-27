import type {
  ActivityEvent,
  Claim,
  Dealer,
  DealerInteraction,
  DealerTask,
  DistributionReport,
  DistributionReportItem,
  Document,
  Order,
  OrderItem,
  Organization,
  Product,
  RegionalRoute,
  Role,
  RouteVisit,
  TradePoint,
  User,
  UserRole,
} from "@shared/schema";
import type {
  DealerDetail,
  DealerInteractionWithUser,
  DealerListItem,
  DealerTaskWithUsers,
} from "./dealer-crm";
import { countActiveTasks, toDealerListItem } from "./dealer-crm";

export type OrderDetails = Order & {
  items: OrderItem[];
  documents: Document[];
};

export type CreateOrderItemInput = {
  productId: number;
  quantity: number;
};

export type CreateOrderInput = {
  dealerId: number;
  createdByUserId: number;
  items: CreateOrderItemInput[];
  comment?: string;
};

export type RouteVisitDetail = RouteVisit & {
  dealer: DealerListItem;
  tradePoint: TradePoint;
};

export type RegionalRouteDetail = RegionalRoute & {
  regionalManager: User;
  visits: RouteVisitDetail[];
  summary: {
    planned: number;
    completed: number;
    inProgress: number;
    skipped: number;
  };
};

export type DistributionReportResponse = {
  report: DistributionReport;
  items: DistributionReportItem[];
  summary: {
    totalModelsChecked: number;
    presentModelsCount: number;
    missingModelsCount: number;
    showcaseModelsCount: number;
  };
};

export type VisitDetail = {
  visit: RouteVisitDetail;
  route: RegionalRoute;
  dealer: DealerListItem;
  tradePoint: TradePoint;
  salesManager: User | null;
  regionalManager: User | null;
  activeTaskCount: number;
  distributionReport: DistributionReportResponse | null;
  productChecklist: DistributionReportItem[];
};

export type DemoDistributionReportPayload = {
  hasShowcase: boolean;
  showcaseDoorsCount: number;
  displayQuality: string;
  competitorPresence: string;
  recommendation: string;
  nextAction: string;
  items: Array<{
    productId: number;
    isPresent: boolean;
    isOnShowcase: boolean;
    stockStatus: string;
    comment?: string | null;
  }>;
};

export class StorageError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export interface IStorage {
  listOrganizations(): Promise<Organization[]>;
  listUsers(): Promise<User[]>;
  listRoles(): Promise<Role[]>;
  listUserRoles(): Promise<UserRole[]>;
  listDealers(): Promise<DealerListItem[]>;
  getDealerById(id: number): Promise<DealerDetail | undefined>;
  getTradePointsByDealerId(dealerId: number): Promise<TradePoint[]>;
  getDealerTasksByDealerId(dealerId: number): Promise<DealerTaskWithUsers[]>;
  getDealerInteractionsByDealerId(dealerId: number): Promise<DealerInteractionWithUser[]>;
  listProducts(): Promise<Product[]>;
  listOrders(): Promise<Order[]>;
  getOrderById(id: number): Promise<OrderDetails | undefined>;
  createOrder(input: CreateOrderInput): Promise<OrderDetails>;
  listClaims(): Promise<Claim[]>;
  listActivityEvents(): Promise<ActivityEvent[]>;
  listRegionalRoutes(): Promise<RegionalRoute[]>;
  getRegionalRouteById(id: number): Promise<RegionalRouteDetail | undefined>;
  getRegionalManagerVisitById(id: number): Promise<VisitDetail | undefined>;
  getDistributionReportByVisitId(visitId: number): Promise<DistributionReportResponse | undefined>;
  saveDistributionReportDraft(
    visitId: number,
    payload: DemoDistributionReportPayload,
  ): Promise<{ success: true; report: DistributionReportResponse }>;
  submitDistributionReport(
    visitId: number,
    payload: DemoDistributionReportPayload,
  ): Promise<{ success: true; message: string; report: DistributionReportResponse }>;
}

const organizationsSeed: Organization[] = [
  {
    id: 1,
    name: "Tandoor HQ",
    orgType: "tandoor",
    taxId: "770401001",
    city: "Moscow",
    status: "active",
    createdAt: "2026-01-10T09:00:00.000Z",
  },
  {
    id: 2,
    name: "Дверной Дом Юг",
    orgType: "dealer",
    taxId: "2312012345",
    city: "Краснодар",
    status: "active",
    createdAt: "2026-01-12T08:15:00.000Z",
  },
  {
    id: 3,
    name: "Салон дверей Северный",
    orgType: "dealer",
    taxId: "2312012346",
    city: "Краснодар",
    status: "active",
    createdAt: "2026-01-13T10:25:00.000Z",
  },
  {
    id: 4,
    name: "Дом дверей Сочи",
    orgType: "dealer",
    taxId: "2312012347",
    city: "Сочи",
    status: "active",
    createdAt: "2026-01-15T11:05:00.000Z",
  },
  {
    id: 5,
    name: "SteelCore Supplier JSC",
    orgType: "supplier",
    taxId: "7722334455",
    city: "Tula",
    status: "active",
    createdAt: "2026-01-15T12:00:00.000Z",
  },
];

const rolesSeed: Role[] = [
  { id: 1, code: "admin", name: "Administrator", description: "Full access" },
  {
    id: 2,
    code: "sales_manager",
    name: "Sales Manager",
    description: "Manages customer orders",
  },
  {
    id: 3,
    code: "regional_manager",
    name: "Regional Manager",
    description: "Supervises regional dealer network",
  },
  {
    id: 4,
    code: "dealer_buyer",
    name: "Dealer Buyer",
    description: "Creates dealer purchase orders",
  },
  {
    id: 5,
    code: "warehouse_operator",
    name: "Warehouse Operator",
    description: "Controls stock and reservations",
  },
  {
    id: 6,
    code: "logistician",
    name: "Logistician",
    description: "Coordinates delivery workflow",
  },
  {
    id: 7,
    code: "service_specialist",
    name: "Service Specialist",
    description: "Handles claims and service requests",
  },
  {
    id: 8,
    code: "marketer",
    name: "Marketer",
    description: "Runs partner promotion programs",
  },
  {
    id: 9,
    code: "executive",
    name: "Executive",
    description: "Monitors top-level KPIs",
  },
  {
    id: 10,
    code: "supplier",
    name: "Supplier",
    description: "Represents supplier organization",
  },
];

const usersSeed: User[] = [
  {
    id: 1,
    organizationId: 1,
    firstName: "Karen",
    lastName: "Avedikyan",
    email: "k.avedikyan@tandoor.ru",
    phone: "+7 900 000-10-10",
    status: "active",
    createdAt: "2026-01-10T09:30:00.000Z",
  },
  {
    id: 2,
    organizationId: 1,
    firstName: "Ольга",
    lastName: "Соколова",
    email: "o.sokolova@tandoor.ru",
    phone: "+7 900 000-10-20",
    status: "active",
    createdAt: "2026-01-10T10:00:00.000Z",
  },
  {
    id: 3,
    organizationId: 1,
    firstName: "Дмитрий",
    lastName: "Романов",
    email: "d.romanov@tandoor.ru",
    phone: "+7 900 000-10-30",
    status: "active",
    createdAt: "2026-01-10T10:10:00.000Z",
  },
  {
    id: 4,
    organizationId: 1,
    firstName: "Мария",
    lastName: "Лебедева",
    email: "m.lebedeva@tandoor.ru",
    phone: "+7 900 000-10-40",
    status: "active",
    createdAt: "2026-01-10T10:20:00.000Z",
  },
  {
    id: 5,
    organizationId: 1,
    firstName: "Анна",
    lastName: "Кравченко",
    email: "a.kravchenko@tandoor.ru",
    phone: "+7 900 000-10-50",
    status: "active",
    createdAt: "2026-01-10T10:30:00.000Z",
  },
  {
    id: 6,
    organizationId: 1,
    firstName: "Сергей",
    lastName: "Волков",
    email: "s.volkov@tandoor.ru",
    phone: "+7 900 000-10-60",
    status: "active",
    createdAt: "2026-01-10T10:40:00.000Z",
  },
  {
    id: 7,
    organizationId: 1,
    firstName: "Игорь",
    lastName: "Мельников",
    email: "i.melnikov@tandoor.ru",
    phone: "+7 900 000-10-70",
    status: "active",
    createdAt: "2026-01-10T10:50:00.000Z",
  },
  {
    id: 8,
    organizationId: 5,
    firstName: "Павел",
    lastName: "Серов",
    email: "p.serov@steelcore.ru",
    phone: "+7 487 200-44-11",
    status: "active",
    createdAt: "2026-01-15T12:05:00.000Z",
  },
];

const userRolesSeed: UserRole[] = [
  { id: 1, userId: 1, roleId: 1, assignedAt: "2026-01-10T09:31:00.000Z" },
  { id: 2, userId: 2, roleId: 2, assignedAt: "2026-01-10T10:01:00.000Z" },
  { id: 3, userId: 2, roleId: 3, assignedAt: "2026-01-10T10:02:00.000Z" },
  { id: 4, userId: 3, roleId: 2, assignedAt: "2026-01-10T10:11:00.000Z" },
  { id: 5, userId: 4, roleId: 3, assignedAt: "2026-01-10T10:21:00.000Z" },
  { id: 6, userId: 5, roleId: 2, assignedAt: "2026-01-10T10:31:00.000Z" },
  { id: 7, userId: 6, roleId: 2, assignedAt: "2026-01-10T10:41:00.000Z" },
  { id: 8, userId: 7, roleId: 3, assignedAt: "2026-01-10T10:51:00.000Z" },
  { id: 9, userId: 8, roleId: 10, assignedAt: "2026-01-15T12:06:00.000Z" },
];

const dealersSeed: Dealer[] = [
  {
    id: 1,
    organizationId: 2,
    name: "Дверной Дом Юг",
    dealerType: "network",
    segment: "сеть салонов дверей",
    region: "Краснодарский край",
    city: "Краснодар",
    salesManagerId: 5,
    regionalManagerId: 7,
    potentialLevel: "high",
    status: "active",
    managerUserId: 5,
    tier: "high",
    comment: "Ключевой сетевой партнёр на Юге, растущая выкладка и витрины.",
    createdAt: "2026-01-12T08:50:00.000Z",
  },
  {
    id: 2,
    organizationId: 3,
    name: "Салон дверей Северный",
    dealerType: "single",
    segment: "одиночный салон",
    region: "Краснодарский край",
    city: "Краснодар",
    salesManagerId: 5,
    regionalManagerId: 7,
    potentialLevel: "medium",
    status: "active",
    managerUserId: 5,
    tier: "medium",
    comment: "Точка в развитии: согласование ассортимента и обучение персонала.",
    createdAt: "2026-01-13T11:25:00.000Z",
  },
  {
    id: 3,
    organizationId: 4,
    name: "Дом дверей Сочи",
    dealerType: "single",
    segment: "региональный дилер",
    region: "Краснодарский край",
    city: "Сочи",
    salesManagerId: 5,
    regionalManagerId: 7,
    potentialLevel: "medium",
    status: "active",
    managerUserId: 5,
    tier: "medium",
    comment: "Стабильные заказы, фокус на витрине премиум-серии в сезон.",
    createdAt: "2026-01-14T09:15:00.000Z",
  },
];

const tradePointsSeed: TradePoint[] = [
  {
    id: 1,
    dealerId: 1,
    name: "Дверной Дом Юг — Краснодар",
    city: "Краснодар",
    address: "ул. Северная, 320",
    storeFormat: "showroom",
    areaSqm: 180,
    assortmentProfile: "входные и межкомнатные, премиум",
    status: "active",
    comment: null,
    createdAt: "2026-01-12T08:55:00.000Z",
  },
  {
    id: 2,
    dealerId: 1,
    name: "Дверной Дом Юг — Анапа",
    city: "Анапа",
    address: "ул. Ленина, 14",
    storeFormat: "showroom",
    areaSqm: 95,
    assortmentProfile: "входные, массив",
    status: "active",
    comment: null,
    createdAt: "2026-01-16T10:05:00.000Z",
  },
  {
    id: 3,
    dealerId: 1,
    name: "Дверной Дом Юг — Новороссийск",
    city: "Новороссийск",
    address: "пр-т Дзержинского, 211",
    storeFormat: "mixed",
    areaSqm: 120,
    assortmentProfile: "смешанный формат, усиление витрины",
    status: "active",
    comment: null,
    createdAt: "2026-01-19T11:20:00.000Z",
  },
  {
    id: 4,
    dealerId: 2,
    name: "Салон дверей Северный",
    city: "Краснодар",
    address: "ул. Российская, 74",
    storeFormat: "showroom",
    areaSqm: 65,
    assortmentProfile: "межкомнатные, средний сегмент",
    status: "active",
    comment: null,
    createdAt: "2026-01-13T11:35:00.000Z",
  },
  {
    id: 5,
    dealerId: 3,
    name: "Дом дверей Сочи",
    city: "Сочи",
    address: "ул. Пластунская, 52",
    storeFormat: "showroom",
    areaSqm: 45,
    assortmentProfile: "компактная витрина, курортный трафик",
    status: "active",
    comment: null,
    createdAt: "2026-01-14T09:25:00.000Z",
  },
];

const dealerTasksSeed: DealerTask[] = [
  {
    id: 1,
    dealerId: 1,
    tradePointId: 1,
    assignedToUserId: 5,
    createdByUserId: 7,
    type: "showcase_goal",
    title: "Цель по витрине: линия Loft в Краснодаре",
    description: "Согласовать план выкладки серии Loft в основном зале до конца квартала.",
    status: "in_progress",
    priority: "high",
    dueDate: "2026-04-15",
    source: "manual",
    createdAt: "2026-04-01T10:00:00.000Z",
    completedAt: null,
  },
  {
    id: 2,
    dealerId: 1,
    tradePointId: null,
    assignedToUserId: 5,
    createdByUserId: 5,
    type: "distribution_gap",
    title: "Звонок по отгрузке и условиям",
    description: "Уточнить сроки поставки и коммерческие условия по текущему договору.",
    status: "done",
    priority: "medium",
    dueDate: "2026-03-28",
    source: "distribution_report",
    createdAt: "2026-03-20T11:00:00.000Z",
    completedAt: "2026-03-27T16:00:00.000Z",
  },
  {
    id: 3,
    dealerId: 1,
    tradePointId: 2,
    assignedToUserId: 7,
    createdByUserId: 2,
    type: "other",
    title: "Проверить наличие POSM",
    description: "Проверить наличие и корректность размещения POSM-материалов.",
    status: "new",
    priority: "medium",
    dueDate: "2026-04-20",
    source: "visit",
    createdAt: "2026-04-10T08:00:00.000Z",
    completedAt: null,
  },
  {
    id: 4,
    dealerId: 2,
    tradePointId: 4,
    assignedToUserId: 6,
    createdByUserId: 5,
    type: "sales_follow_up",
    title: "Комплект документов к договору",
    description: "Подготовить шаблоны актов и спецификации для подписания.",
    status: "in_progress",
    priority: "low",
    dueDate: "2026-04-12",
    source: "order",
    createdAt: "2026-04-05T12:00:00.000Z",
    completedAt: null,
  },
  {
    id: 5,
    dealerId: 2,
    tradePointId: null,
    assignedToUserId: 5,
    createdByUserId: 7,
    type: "other",
    title: "Синхронизация по ТТ в развитии",
    description: "Согласовать график выездов и приоритеты витрины.",
    status: "new",
    priority: "medium",
    dueDate: "2026-04-18",
    source: "visit",
    createdAt: "2026-04-08T14:00:00.000Z",
    completedAt: null,
  },
  {
    id: 6,
    dealerId: 3,
    tradePointId: 5,
    assignedToUserId: 7,
    createdByUserId: 5,
    type: "visit_follow_up",
    title: "Обновить витрину входных дверей",
    description: "Обновить выкладку входных дверей по результатам визита РМ.",
    status: "new",
    priority: "high",
    dueDate: "2026-04-11",
    source: "visit",
    createdAt: "2026-04-09T09:30:00.000Z",
    completedAt: null,
  },
  {
    id: 7,
    dealerId: 3,
    tradePointId: null,
    assignedToUserId: 4,
    createdByUserId: 3,
    type: "document",
    title: "Подготовить пакет документов по дилеру",
    description: "Проверить и подготовить документы для обновления условий сотрудничества.",
    status: "new",
    priority: "low",
    dueDate: "2026-04-22",
    source: "manual",
    createdAt: "2026-04-12T10:00:00.000Z",
    completedAt: null,
  },
];

const dealerInteractionsSeed: DealerInteraction[] = [
  {
    id: 1,
    dealerId: 1,
    tradePointId: 1,
    userId: 5,
    roleContext: "sales_manager",
    type: "call",
    summary: "Короткий звонок: подтверждение поставки и согласование встречи по витрине.",
    createdAt: "2026-04-02T09:00:00.000Z",
  },
  {
    id: 2,
    dealerId: 1,
    tradePointId: 1,
    userId: 7,
    roleContext: "regional_manager",
    type: "visit",
    summary: "Полевой визит в Краснодар, осмотр основной витрины, отметка по дистрибуции.",
    createdAt: "2026-04-03T11:30:00.000Z",
  },
  {
    id: 3,
    dealerId: 1,
    tradePointId: 2,
    userId: 7,
    roleContext: "regional_manager",
    type: "task_created",
    summary: "Создана задача по расширению матрицы в Анапе.",
    createdAt: "2026-04-04T08:15:00.000Z",
  },
  {
    id: 4,
    dealerId: 2,
    tradePointId: 4,
    userId: 5,
    roleContext: "sales_manager",
    type: "meeting",
    summary: "Онлайн-встреча с владельцем: дорожная карта развития точки.",
    createdAt: "2026-04-05T10:00:00.000Z",
  },
  {
    id: 5,
    dealerId: 2,
    tradePointId: null,
    userId: 1,
    roleContext: "system",
    type: "task_created",
    summary: "Создана операционная задача ассистенту по подготовке документов к договору.",
    createdAt: "2026-04-05T12:00:00.000Z",
  },
  {
    id: 6,
    dealerId: 2,
    tradePointId: null,
    userId: 5,
    roleContext: "sales_manager",
    type: "order",
    summary: "Оформлен заказ по обновленной матрице дилера.",
    createdAt: "2026-04-05T15:00:00.000Z",
  },
  {
    id: 7,
    dealerId: 3,
    tradePointId: 5,
    userId: 7,
    roleContext: "regional_manager",
    type: "visit",
    summary: "Плановый визит в Сочи, согласование площади под новую витрину.",
    createdAt: "2026-04-07T13:00:00.000Z",
  },
  {
    id: 8,
    dealerId: 3,
    tradePointId: 5,
    userId: 5,
    roleContext: "sales_manager",
    type: "claim",
    summary: "Зафиксирована рекламация по повреждению упаковки, согласованы корректирующие действия.",
    createdAt: "2026-04-09T09:00:00.000Z",
  },
];

const productsSeed: Product[] = [
  {
    id: 1,
    sku: "TD-ENTRY-860-BLK",
    name: "Tandoor Entry 860",
    category: "entry_door",
    finishColor: "Graphite Black",
    priceCents: 6890000,
    currency: "RUB",
    availabilityStatus: "in_stock",
    stockQty: 24,
    createdAt: "2026-01-16T08:00:00.000Z",
  },
  {
    id: 2,
    sku: "TD-ENTRY-960-OAK",
    name: "Tandoor Entry 960",
    category: "entry_door",
    finishColor: "Natural Oak",
    priceCents: 7450000,
    currency: "RUB",
    availabilityStatus: "in_stock",
    stockQty: 17,
    createdAt: "2026-01-16T08:02:00.000Z",
  },
  {
    id: 3,
    sku: "TD-LINE-GLASS-WHT",
    name: "Tandoor Line Glass",
    category: "interior_door",
    finishColor: "Polar White",
    priceCents: 3820000,
    currency: "RUB",
    availabilityStatus: "limited",
    stockQty: 8,
    createdAt: "2026-01-16T08:04:00.000Z",
  },
  {
    id: 4,
    sku: "TD-FIRE-900-MTL",
    name: "Tandoor FireSafe 900",
    category: "fire_door",
    finishColor: "Metal Gray",
    priceCents: 9120000,
    currency: "RUB",
    availabilityStatus: "in_stock",
    stockQty: 11,
    createdAt: "2026-01-16T08:06:00.000Z",
  },
  {
    id: 5,
    sku: "TD-LOFT-880-GRN",
    name: "Tandoor Loft 880",
    category: "entry_door",
    finishColor: "Olive Green",
    priceCents: 6990000,
    currency: "RUB",
    availabilityStatus: "backorder",
    stockQty: 0,
    createdAt: "2026-01-16T08:08:00.000Z",
  },
];

const ordersSeed: Order[] = [
  {
    id: 1,
    orderNumber: "ORD-2026-0001",
    organizationId: 1,
    dealerId: 1,
    createdByUserId: 5,
    status: "submitted",
    totalCents: 20670000,
    currency: "RUB",
    requestedDeliveryDate: "2026-02-05",
    createdAt: "2026-01-20T10:15:00.000Z",
    updatedAt: "2026-01-20T10:15:00.000Z",
  },
  {
    id: 2,
    orderNumber: "ORD-2026-0002",
    organizationId: 1,
    dealerId: 2,
    createdByUserId: 5,
    status: "assembling",
    totalCents: 14900000,
    currency: "RUB",
    requestedDeliveryDate: "2026-02-08",
    createdAt: "2026-01-21T09:40:00.000Z",
    updatedAt: "2026-01-23T12:00:00.000Z",
  },
  {
    id: 3,
    orderNumber: "ORD-2026-0003",
    organizationId: 1,
    dealerId: 1,
    createdByUserId: 5,
    status: "shipped",
    totalCents: 9120000,
    currency: "RUB",
    requestedDeliveryDate: "2026-01-30",
    createdAt: "2026-01-18T14:10:00.000Z",
    updatedAt: "2026-01-24T07:30:00.000Z",
  },
];

const orderItemsSeed: OrderItem[] = [
  {
    id: 1,
    orderId: 1,
    productId: 1,
    quantity: 2,
    unitPriceCents: 6890000,
    totalPriceCents: 13780000,
  },
  {
    id: 2,
    orderId: 1,
    productId: 3,
    quantity: 1,
    unitPriceCents: 3820000,
    totalPriceCents: 3820000,
  },
  {
    id: 3,
    orderId: 1,
    productId: 2,
    quantity: 1,
    unitPriceCents: 7450000,
    totalPriceCents: 7450000,
  },
  {
    id: 4,
    orderId: 2,
    productId: 2,
    quantity: 2,
    unitPriceCents: 7450000,
    totalPriceCents: 14900000,
  },
  {
    id: 5,
    orderId: 3,
    productId: 4,
    quantity: 1,
    unitPriceCents: 9120000,
    totalPriceCents: 9120000,
  },
];

const documentsSeed: Document[] = [
  {
    id: 1,
    organizationId: 1,
    orderId: 1,
    type: "invoice",
    title: "Invoice INV-0001",
    fileUrl: "/docs/invoice-inv-0001.pdf",
    status: "published",
    createdAt: "2026-01-20T10:20:00.000Z",
  },
  {
    id: 2,
    organizationId: 1,
    orderId: 2,
    type: "contract",
    title: "Supply Contract SC-2026-02",
    fileUrl: "/docs/contract-sc-2026-02.pdf",
    status: "published",
    createdAt: "2026-01-21T10:00:00.000Z",
  },
  {
    id: 3,
    organizationId: 1,
    orderId: 3,
    type: "shipment_document",
    title: "Shipment Waybill SHP-143",
    fileUrl: "/docs/waybill-shp-143.pdf",
    status: "published",
    createdAt: "2026-01-24T07:35:00.000Z",
  },
];

const claimsSeed: Claim[] = [
  {
    id: 1,
    claimNumber: "CLM-2026-001",
    organizationId: 1,
    dealerId: 1,
    orderId: 3,
    status: "in_review",
    reason: "Packaging damage",
    description: "Minor panel scratches found on delivery.",
    resolutionNote: null,
    createdAt: "2026-01-25T11:10:00.000Z",
    updatedAt: "2026-01-25T11:30:00.000Z",
  },
  {
    id: 2,
    claimNumber: "CLM-2026-002",
    organizationId: 1,
    dealerId: 2,
    orderId: null,
    status: "new",
    reason: "Wrong finish color",
    description: "Requested oak finish, delivered white finish.",
    resolutionNote: null,
    createdAt: "2026-01-26T09:25:00.000Z",
    updatedAt: "2026-01-26T09:25:00.000Z",
  },
];

const activityEventsSeed: ActivityEvent[] = [
  {
    id: 1,
    eventType: "order_created",
    entityType: "order",
    entityId: 1,
    organizationId: 1,
    userId: 5,
    orderId: 1,
    claimId: null,
    message: "Создан заказ ORD-2026-0001 менеджером продаж.",
    createdAt: "2026-01-20T10:15:00.000Z",
  },
  {
    id: 2,
    eventType: "document_added",
    entityType: "document",
    entityId: 1,
    organizationId: 1,
    userId: 5,
    orderId: 1,
    claimId: null,
    message: "К заказу ORD-2026-0001 добавлен счёт INV-0001.",
    createdAt: "2026-01-20T10:20:00.000Z",
  },
  {
    id: 3,
    eventType: "order_status_changed",
    entityType: "order",
    entityId: 2,
    organizationId: 1,
    userId: 5,
    orderId: 2,
    claimId: null,
    message: "Заказ ORD-2026-0002 переведён в комплектацию.",
    createdAt: "2026-01-23T12:00:00.000Z",
  },
  {
    id: 4,
    eventType: "order_status_changed",
    entityType: "order",
    entityId: 3,
    organizationId: 1,
    userId: 5,
    orderId: 3,
    claimId: null,
    message: "Заказ ORD-2026-0003 отгружен со склада.",
    createdAt: "2026-01-24T07:30:00.000Z",
  },
  {
    id: 5,
    eventType: "claim_created",
    entityType: "claim",
    entityId: 1,
    organizationId: 1,
    userId: 5,
    orderId: 3,
    claimId: 1,
    message: "Создана рекламация CLM-2026-001 по заказу ORD-2026-0003.",
    createdAt: "2026-01-25T11:10:00.000Z",
  },
  {
    id: 6,
    eventType: "claim_created",
    entityType: "claim",
    entityId: 2,
    organizationId: 1,
    userId: 5,
    orderId: null,
    claimId: 2,
    message: "Создана рекламация CLM-2026-002 без привязки к заказу.",
    createdAt: "2026-01-26T09:25:00.000Z",
  },
];

const regionalRoutesSeed: RegionalRoute[] = [
  {
    id: 1,
    regionalManagerId: 7,
    routeDate: "2026-04-27",
    title: "Маршрут Юг / Краснодар",
    region: "Краснодарский край",
    status: "in_progress",
    plannedVisitsCount: 5,
    completedVisitsCount: 2,
    createdAt: "2026-04-27T07:00:00.000Z",
  },
];

const routeVisitsSeed: RouteVisit[] = [
  {
    id: 1,
    routeId: 1,
    dealerId: 1,
    tradePointId: 1,
    plannedTime: "09:30",
    visitStatus: "completed",
    visitPurpose: "distribution_check",
    priority: "high",
    comment: "Витрина в хорошем состоянии, есть пробелы по премиум-моделям.",
    startedAt: "2026-04-27T09:35:00.000Z",
    completedAt: "2026-04-27T10:20:00.000Z",
  },
  {
    id: 2,
    routeId: 1,
    dealerId: 2,
    tradePointId: 4,
    plannedTime: "11:30",
    visitStatus: "in_progress",
    visitPurpose: "showcase_check",
    priority: "high",
    comment: "Идет фотофиксация выкладки и проверка POSM.",
    startedAt: "2026-04-27T11:42:00.000Z",
    completedAt: null,
  },
  {
    id: 3,
    routeId: 1,
    dealerId: 1,
    tradePointId: 2,
    plannedTime: "14:30",
    visitStatus: "planned",
    visitPurpose: "distribution_check",
    priority: "medium",
    comment: "Проверка представленности ключевых моделей.",
    startedAt: null,
    completedAt: null,
  },
  {
    id: 4,
    routeId: 1,
    dealerId: 1,
    tradePointId: 3,
    plannedTime: "16:30",
    visitStatus: "planned",
    visitPurpose: "training",
    priority: "medium",
    comment: "Короткое обучение консультантов по новой линейке.",
    startedAt: null,
    completedAt: null,
  },
  {
    id: 5,
    routeId: 1,
    dealerId: 3,
    tradePointId: 5,
    plannedTime: "18:00",
    visitStatus: "planned",
    visitPurpose: "order_follow_up",
    priority: "low",
    comment: "Проверка статуса заказов и обновление приоритетов.",
    startedAt: null,
    completedAt: null,
  },
];

const distributionReportsSeed: DistributionReport[] = [
  {
    id: 1,
    visitId: 1,
    dealerId: 1,
    tradePointId: 1,
    regionalManagerId: 7,
    reportStatus: "draft",
    hasShowcase: 1,
    showcaseDoorsCount: 12,
    totalModelsChecked: 8,
    presentModelsCount: 5,
    missingModelsCount: 3,
    displayQuality: "good",
    competitorPresence: "medium",
    recommendation: "Усилить премиум-серию и обновить POSM.",
    nextAction:
      "Поставить цель менеджеру продаж: согласовать выставление 3 недостающих моделей.",
    createdAt: "2026-04-27T10:25:00.000Z",
    submittedAt: null,
  },
];

const distributionReportItemsSeed: DistributionReportItem[] = [
  {
    id: 1,
    reportId: 1,
    productId: 1,
    modelName: "Tandoor Classic 80",
    sku: "TD-ENTRY-860-BLK",
    category: "entry_door",
    isPresent: 1,
    isOnShowcase: 1,
    stockStatus: "in_stock",
    comment: "Стабильный спрос, модель стоит на центральной витрине.",
  },
  {
    id: 2,
    reportId: 1,
    productId: 2,
    modelName: "Tandoor Line 90",
    sku: "TD-ENTRY-960-OAK",
    category: "entry_door",
    isPresent: 1,
    isOnShowcase: 0,
    stockStatus: "low_stock",
    comment: "Есть в остатках, но не выставлена фронтально.",
  },
  {
    id: 3,
    reportId: 1,
    productId: 3,
    modelName: "Tandoor Premium 100",
    sku: "TD-LINE-GLASS-WHT",
    category: "interior_door",
    isPresent: 0,
    isOnShowcase: 0,
    stockStatus: "out_of_stock",
    comment: "Не представлена в торговом зале.",
  },
  {
    id: 4,
    reportId: 1,
    productId: 5,
    modelName: "Tandoor Loft Graphite",
    sku: "TD-LOFT-880-GRN",
    category: "entry_door",
    isPresent: 1,
    isOnShowcase: 1,
    stockStatus: "low_stock",
    comment: "Хорошая выкладка, нужна дозаявка.",
  },
  {
    id: 5,
    reportId: 1,
    productId: 4,
    modelName: "Tandoor Urban White",
    sku: "TD-FIRE-900-MTL",
    category: "fire_door",
    isPresent: 0,
    isOnShowcase: 0,
    stockStatus: "unknown",
    comment: "Данные по доступности уточняются с менеджером салона.",
  },
];

function getNextId<T extends { id: number }>(entries: T[]): number {
  return entries.reduce((maxId, entry) => Math.max(maxId, entry.id), 0) + 1;
}

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const maxSequence = ordersSeed.reduce((maxValue, order) => {
    const matched = /^ORD-(\d{4})-(\d+)$/.exec(order.orderNumber);
    if (!matched) {
      return maxValue;
    }

    const matchedYear = Number.parseInt(matched[1], 10);
    const matchedSequence = Number.parseInt(matched[2], 10);
    if (matchedYear !== year || Number.isNaN(matchedSequence)) {
      return maxValue;
    }

    return Math.max(maxValue, matchedSequence);
  }, 0);

  return `ORD-${year}-${String(maxSequence + 1).padStart(4, "0")}`;
}

function getUserById(id: number | null | undefined): User | undefined {
  if (id == null) {
    return undefined;
  }
  return usersSeed.find((user) => user.id === id);
}

function userNameById(id: number | null | undefined): string {
  const user = getUserById(id);
  if (!user) {
    return "Не назначен";
  }
  return `${user.firstName} ${user.lastName}`.trim();
}

function dealerListItemById(id: number): DealerListItem | undefined {
  const dealer = dealersSeed.find((entry) => entry.id === id);
  if (!dealer) return undefined;
  return toDealerListItem(
    dealer,
    usersSeed,
    tradePointsSeed,
    dealerTasksSeed,
    dealerInteractionsSeed,
    organizationsSeed,
  );
}

function routeVisitDetail(visit: RouteVisit): RouteVisitDetail | undefined {
  const dealer = dealerListItemById(visit.dealerId);
  const tradePoint = tradePointsSeed.find((point) => point.id === visit.tradePointId);
  if (!dealer || !tradePoint) {
    return undefined;
  }
  return {
    ...visit,
    dealer,
    tradePoint,
  };
}

function reportResponseForVisit(visitId: number): DistributionReportResponse | undefined {
  const report = distributionReportsSeed.find((entry) => entry.visitId === visitId);
  if (!report) {
    return undefined;
  }
  const items = distributionReportItemsSeed
    .filter((entry) => entry.reportId === report.id)
    .sort((a, b) => a.id - b.id);
  return {
    report,
    items,
    summary: {
      totalModelsChecked: report.totalModelsChecked,
      presentModelsCount: report.presentModelsCount,
      missingModelsCount: report.missingModelsCount,
      showcaseModelsCount: items.filter((item) => item.isOnShowcase === 1).length,
    },
  };
}

function rebuildReportFromPayload(
  existing: DistributionReport,
  payload: DemoDistributionReportPayload,
  status: "draft" | "submitted",
): DistributionReport {
  const totalModelsChecked = payload.items.length;
  const presentModelsCount = payload.items.filter((item) => item.isPresent).length;
  const missingModelsCount = totalModelsChecked - presentModelsCount;
  return {
    ...existing,
    reportStatus: status,
    hasShowcase: payload.hasShowcase ? 1 : 0,
    showcaseDoorsCount: payload.showcaseDoorsCount,
    totalModelsChecked,
    presentModelsCount,
    missingModelsCount,
    displayQuality: payload.displayQuality,
    competitorPresence: payload.competitorPresence,
    recommendation: payload.recommendation,
    nextAction: payload.nextAction,
    submittedAt: status === "submitted" ? new Date().toISOString() : null,
  };
}

function applyReportItems(
  reportId: number,
  payloadItems: DemoDistributionReportPayload["items"],
): void {
  for (let index = distributionReportItemsSeed.length - 1; index >= 0; index -= 1) {
    if (distributionReportItemsSeed[index].reportId === reportId) {
      distributionReportItemsSeed.splice(index, 1);
    }
  }

  const nextIdStart = getNextId(distributionReportItemsSeed);
  const normalizedItems: DistributionReportItem[] = payloadItems.map((item, idx) => {
    const product = productsSeed.find((entry) => entry.id === item.productId);
    return {
      id: nextIdStart + idx,
      reportId,
      productId: item.productId,
      modelName: product?.name ?? `Модель #${item.productId}`,
      sku: product?.sku ?? "N/A",
      category: product?.category ?? "unknown",
      isPresent: item.isPresent ? 1 : 0,
      isOnShowcase: item.isOnShowcase ? 1 : 0,
      stockStatus: item.stockStatus,
      comment: item.comment ?? null,
    };
  });
  distributionReportItemsSeed.push(...normalizedItems);
}

function defaultChecklistItems(): DistributionReportItem[] {
  return productsSeed.slice(0, 5).map((product, index) => ({
    id: 10_000 + index + 1,
    reportId: 0,
    productId: product.id,
    modelName: product.name,
    sku: product.sku,
    category: product.category,
    isPresent: 0,
    isOnShowcase: 0,
    stockStatus: "unknown",
    comment: null,
  }));
}

export class DatabaseStorage implements IStorage {
  async listOrganizations(): Promise<Organization[]> {
    return organizationsSeed;
  }

  async listUsers(): Promise<User[]> {
    return usersSeed;
  }

  async listRoles(): Promise<Role[]> {
    return rolesSeed;
  }

  async listUserRoles(): Promise<UserRole[]> {
    return userRolesSeed;
  }

  async listDealers(): Promise<DealerListItem[]> {
    return dealersSeed.map((dealer) =>
      toDealerListItem(
        dealer,
        usersSeed,
        tradePointsSeed,
        dealerTasksSeed,
        dealerInteractionsSeed,
        organizationsSeed,
      ),
    );
  }

  async getDealerById(id: number): Promise<DealerDetail | undefined> {
    const dealer = dealersSeed.find((entry) => entry.id === id);
    if (!dealer) {
      return undefined;
    }

    const listItem = toDealerListItem(
      dealer,
      usersSeed,
      tradePointsSeed,
      dealerTasksSeed,
      dealerInteractionsSeed,
      organizationsSeed,
    );
    const tradePoints = await this.getTradePointsByDealerId(id);
    const tasks = await this.getDealerTasksByDealerId(id);
    const interactions = await this.getDealerInteractionsByDealerId(id);
    const recentOrders = ordersSeed
      .filter((order) => order.dealerId === id)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
    const recentClaims = claimsSeed
      .filter((claim) => claim.dealerId === id)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
    const activeShowcaseGoals = dealerTasksSeed.filter(
      (task) =>
        task.dealerId === id &&
        task.type === "showcase_goal" &&
        task.status !== "done" &&
        task.status !== "rejected",
    ).length;
    const activeDistributionTasks = dealerTasksSeed.filter(
      (task) =>
        task.dealerId === id &&
        task.type === "distribution_gap" &&
        task.status !== "done" &&
        task.status !== "rejected",
    ).length;
    return {
      dealer: {
        ...listItem,
        organizationName: organizationsSeed.find((organization) => organization.id === dealer.organizationId)?.name ?? listItem.name,
      },
      salesManager: listItem.salesManager,
      regionalManager: listItem.regionalManager,
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

  async getTradePointsByDealerId(dealerId: number): Promise<TradePoint[]> {
    return tradePointsSeed
      .filter((point) => point.dealerId === dealerId)
      .sort((a, b) => a.id - b.id);
  }

  async getDealerTasksByDealerId(dealerId: number): Promise<DealerTaskWithUsers[]> {
    return dealerTasksSeed
      .filter((task) => task.dealerId === dealerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((task) => ({
        ...task,
        assignedToUserName: userNameById(task.assignedToUserId),
        createdByUserName: userNameById(task.createdByUserId),
      }));
  }

  async getDealerInteractionsByDealerId(dealerId: number): Promise<DealerInteractionWithUser[]> {
    return dealerInteractionsSeed
      .filter((entry) => entry.dealerId === dealerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((interaction) => ({
        ...interaction,
        userName: userNameById(interaction.userId),
      }));
  }

  async listRegionalRoutes(): Promise<RegionalRoute[]> {
    return regionalRoutesSeed
      .slice()
      .sort((a, b) => a.routeDate.localeCompare(b.routeDate));
  }

  async getRegionalRouteById(id: number): Promise<RegionalRouteDetail | undefined> {
    const route = regionalRoutesSeed.find((entry) => entry.id === id);
    if (!route) {
      return undefined;
    }
    const regionalManager = getUserById(route.regionalManagerId);
    if (!regionalManager) {
      return undefined;
    }
    const visits = routeVisitsSeed
      .filter((visit) => visit.routeId === id)
      .map(routeVisitDetail)
      .filter((entry): entry is RouteVisitDetail => Boolean(entry))
      .sort((a, b) => a.plannedTime.localeCompare(b.plannedTime));
    return {
      ...route,
      regionalManager,
      visits,
      summary: {
        planned: visits.filter((visit) => visit.visitStatus === "planned").length,
        completed: visits.filter((visit) => visit.visitStatus === "completed").length,
        inProgress: visits.filter((visit) => visit.visitStatus === "in_progress").length,
        skipped: visits.filter((visit) => visit.visitStatus === "skipped").length,
      },
    };
  }

  async getRegionalManagerVisitById(id: number): Promise<VisitDetail | undefined> {
    const visit = routeVisitsSeed.find((entry) => entry.id === id);
    if (!visit) {
      return undefined;
    }
    const detailedVisit = routeVisitDetail(visit);
    if (!detailedVisit) {
      return undefined;
    }
    const route = regionalRoutesSeed.find((entry) => entry.id === visit.routeId);
    if (!route) {
      return undefined;
    }
    const dealer = detailedVisit.dealer;
    const salesManager = getUserById(dealer.salesManagerId);
    const regionalManager = getUserById(dealer.regionalManagerId);
    const distributionReport = reportResponseForVisit(id) ?? null;
    return {
      visit: detailedVisit,
      route,
      dealer,
      tradePoint: detailedVisit.tradePoint,
      salesManager: salesManager ?? null,
      regionalManager: regionalManager ?? null,
      activeTaskCount: dealer.activeTaskCount,
      distributionReport,
      productChecklist: distributionReport?.items ?? defaultChecklistItems(),
    };
  }

  async getDistributionReportByVisitId(
    visitId: number,
  ): Promise<DistributionReportResponse | undefined> {
    const visit = routeVisitsSeed.find((entry) => entry.id === visitId);
    if (!visit) {
      return undefined;
    }
    const existing = reportResponseForVisit(visitId);
    if (existing) {
      return existing;
    }
    return {
      report: {
        id: 0,
        visitId,
        dealerId: visit.dealerId,
        tradePointId: visit.tradePointId,
        regionalManagerId:
          regionalRoutesSeed.find((entry) => entry.id === visit.routeId)?.regionalManagerId ?? 7,
        reportStatus: "draft",
        hasShowcase: 0,
        showcaseDoorsCount: 0,
        totalModelsChecked: 0,
        presentModelsCount: 0,
        missingModelsCount: 0,
        displayQuality: "average",
        competitorPresence: "none",
        recommendation: "",
        nextAction: "",
        createdAt: new Date().toISOString(),
        submittedAt: null,
      },
      items: defaultChecklistItems(),
      summary: {
        totalModelsChecked: 0,
        presentModelsCount: 0,
        missingModelsCount: 0,
        showcaseModelsCount: 0,
      },
    };
  }

  async saveDistributionReportDraft(
    visitId: number,
    payload: DemoDistributionReportPayload,
  ): Promise<{ success: true; report: DistributionReportResponse }> {
    const visit = routeVisitsSeed.find((entry) => entry.id === visitId);
    if (!visit) {
      throw new StorageError(404, "Визит не найден");
    }
    if (payload.items.length === 0) {
      throw new StorageError(422, "Список моделей для отчета пуст");
    }
    const route = regionalRoutesSeed.find((entry) => entry.id === visit.routeId);
    if (!route) {
      throw new StorageError(404, "Маршрут не найден");
    }
    const existing = distributionReportsSeed.find((entry) => entry.visitId === visitId);
    const now = new Date().toISOString();
    const baseReport: DistributionReport =
      existing ??
      {
        id: getNextId(distributionReportsSeed),
        visitId,
        dealerId: visit.dealerId,
        tradePointId: visit.tradePointId,
        regionalManagerId: route.regionalManagerId,
        reportStatus: "draft",
        hasShowcase: 0,
        showcaseDoorsCount: 0,
        totalModelsChecked: 0,
        presentModelsCount: 0,
        missingModelsCount: 0,
        displayQuality: "average",
        competitorPresence: "none",
        recommendation: "",
        nextAction: "",
        createdAt: now,
        submittedAt: null,
      };
    const rebuilt = rebuildReportFromPayload(baseReport, payload, "draft");
    if (existing) {
      const index = distributionReportsSeed.findIndex((entry) => entry.id === existing.id);
      distributionReportsSeed[index] = rebuilt;
    } else {
      distributionReportsSeed.push(rebuilt);
    }
    applyReportItems(rebuilt.id, payload.items);
    const report = reportResponseForVisit(visitId);
    if (!report) {
      throw new StorageError(500, "Не удалось подготовить ответ по отчету");
    }
    return { success: true, report };
  }

  async submitDistributionReport(
    visitId: number,
    payload: DemoDistributionReportPayload,
  ): Promise<{ success: true; message: string; report: DistributionReportResponse }> {
    const draft = await this.saveDistributionReportDraft(visitId, payload);
    const report = distributionReportsSeed.find((entry) => entry.visitId === visitId);
    if (!report) {
      throw new StorageError(500, "Отчет не найден");
    }
    const submitted = rebuildReportFromPayload(report, payload, "submitted");
    const reportIndex = distributionReportsSeed.findIndex((entry) => entry.id === report.id);
    distributionReportsSeed[reportIndex] = submitted;

    const visit = routeVisitsSeed.find((entry) => entry.id === visitId);
    if (visit) {
      visit.visitStatus = "completed";
      visit.completedAt = new Date().toISOString();
    }
    const route = visit ? regionalRoutesSeed.find((entry) => entry.id === visit.routeId) : undefined;
    if (route) {
      route.completedVisitsCount = routeVisitsSeed.filter(
        (entry) => entry.routeId === route.id && entry.visitStatus === "completed",
      ).length;
      if (route.completedVisitsCount >= route.plannedVisitsCount) {
        route.status = "completed";
      }
    }

    const response = reportResponseForVisit(visitId) ?? draft.report;
    return {
      success: true,
      message:
        "Отчет дистрибуции отправлен. На его основании будут сформированы цели по витрине.",
      report: response,
    };
  }

  async listProducts(): Promise<Product[]> {
    return productsSeed;
  }

  async listOrders(): Promise<Order[]> {
    return [...ordersSeed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getOrderById(id: number): Promise<OrderDetails | undefined> {
    const order = ordersSeed.find((entry) => entry.id === id);
    if (!order) {
      return undefined;
    }

    return {
      ...order,
      items: orderItemsSeed.filter((item) => item.orderId === order.id),
      documents: documentsSeed.filter((document) => document.orderId === order.id),
    };
  }

  async createOrder(input: CreateOrderInput): Promise<OrderDetails> {
    const dealer = dealersSeed.find((entry) => entry.id === input.dealerId);
    if (!dealer) {
      throw new StorageError(404, "Dealer not found");
    }

    const createdByUser = usersSeed.find((entry) => entry.id === input.createdByUserId);
    if (!createdByUser) {
      throw new StorageError(404, "User not found");
    }

    const mergedItems = new Map<number, number>();
    for (const item of input.items) {
      const quantity = mergedItems.get(item.productId) ?? 0;
      mergedItems.set(item.productId, quantity + item.quantity);
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
      if (!product) {
        throw new StorageError(404, `Product ${productId} not found`);
      }

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
    const commentSuffix = input.comment?.trim() ? ` Комментарий: ${input.comment.trim()}` : "";
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

    const createdOrder = await this.getOrderById(order.id);
    if (!createdOrder) {
      throw new StorageError(500, "Failed to build created order response");
    }

    return createdOrder;
  }

  async listClaims(): Promise<Claim[]> {
    return claimsSeed;
  }

  async listActivityEvents(): Promise<ActivityEvent[]> {
    return [...activityEventsSeed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export const storage = new DatabaseStorage();

export {
  organizationsSeed,
  rolesSeed,
  usersSeed,
  userRolesSeed,
  dealersSeed,
  tradePointsSeed,
  dealerTasksSeed,
  dealerInteractionsSeed,
  regionalRoutesSeed,
  routeVisitsSeed,
  distributionReportsSeed,
  distributionReportItemsSeed,
  productsSeed,
  ordersSeed,
  orderItemsSeed,
  documentsSeed,
  claimsSeed,
  activityEventsSeed,
};
