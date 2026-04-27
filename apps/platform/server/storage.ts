import type {
  ActivityEvent,
  Claim,
  Dealer,
  Document,
  Order,
  OrderItem,
  Organization,
  Product,
  Role,
  User,
  UserRole,
} from "@shared/schema";

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
  listDealers(): Promise<Dealer[]>;
  listProducts(): Promise<Product[]>;
  listOrders(): Promise<Order[]>;
  getOrderById(id: number): Promise<OrderDetails | undefined>;
  createOrder(input: CreateOrderInput): Promise<OrderDetails>;
  listClaims(): Promise<Claim[]>;
  listActivityEvents(): Promise<ActivityEvent[]>;
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
    name: "Volga Doors Dealer LLC",
    orgType: "dealer",
    taxId: "6312012456",
    city: "Samara",
    status: "active",
    createdAt: "2026-01-12T08:15:00.000Z",
  },
  {
    id: 3,
    name: "Ural Build Partner",
    orgType: "dealer",
    taxId: "6678990102",
    city: "Yekaterinburg",
    status: "active",
    createdAt: "2026-01-13T10:25:00.000Z",
  },
  {
    id: 4,
    name: "SteelCore Supplier JSC",
    orgType: "supplier",
    taxId: "7722334455",
    city: "Tula",
    status: "active",
    createdAt: "2026-01-15T11:05:00.000Z",
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
    firstName: "Olga",
    lastName: "Morozova",
    email: "o.morozova@tandoor.ru",
    phone: "+7 900 000-10-20",
    status: "active",
    createdAt: "2026-01-10T10:00:00.000Z",
  },
  {
    id: 3,
    organizationId: 2,
    firstName: "Denis",
    lastName: "Karpov",
    email: "d.karpov@volgadoors.ru",
    phone: "+7 902 111-22-33",
    status: "active",
    createdAt: "2026-01-12T08:45:00.000Z",
  },
  {
    id: 4,
    organizationId: 3,
    firstName: "Irina",
    lastName: "Sokolova",
    email: "i.sokolova@uralbuild.ru",
    phone: "+7 912 444-55-66",
    status: "active",
    createdAt: "2026-01-13T11:20:00.000Z",
  },
  {
    id: 5,
    organizationId: 4,
    firstName: "Pavel",
    lastName: "Serov",
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
  { id: 4, userId: 3, roleId: 4, assignedAt: "2026-01-12T08:46:00.000Z" },
  { id: 5, userId: 4, roleId: 4, assignedAt: "2026-01-13T11:21:00.000Z" },
  { id: 6, userId: 5, roleId: 10, assignedAt: "2026-01-15T12:06:00.000Z" },
];

const dealersSeed: Dealer[] = [
  {
    id: 1,
    organizationId: 2,
    managerUserId: 3,
    region: "Volga Federal District",
    tier: "gold",
    status: "active",
    createdAt: "2026-01-12T08:50:00.000Z",
  },
  {
    id: 2,
    organizationId: 3,
    managerUserId: 4,
    region: "Ural Federal District",
    tier: "silver",
    status: "active",
    createdAt: "2026-01-13T11:25:00.000Z",
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
    createdByUserId: 2,
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
    createdByUserId: 2,
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
    createdByUserId: 2,
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
    userId: 2,
    orderId: 1,
    claimId: null,
    message: "Order ORD-2026-0001 created by sales manager.",
    createdAt: "2026-01-20T10:15:00.000Z",
  },
  {
    id: 2,
    eventType: "document_added",
    entityType: "document",
    entityId: 1,
    organizationId: 1,
    userId: 2,
    orderId: 1,
    claimId: null,
    message: "Invoice INV-0001 added to order ORD-2026-0001.",
    createdAt: "2026-01-20T10:20:00.000Z",
  },
  {
    id: 3,
    eventType: "order_status_changed",
    entityType: "order",
    entityId: 2,
    organizationId: 1,
    userId: 2,
    orderId: 2,
    claimId: null,
    message: "Order ORD-2026-0002 moved to assembling.",
    createdAt: "2026-01-23T12:00:00.000Z",
  },
  {
    id: 4,
    eventType: "order_status_changed",
    entityType: "order",
    entityId: 3,
    organizationId: 1,
    userId: 2,
    orderId: 3,
    claimId: null,
    message: "Order ORD-2026-0003 shipped from warehouse.",
    createdAt: "2026-01-24T07:30:00.000Z",
  },
  {
    id: 5,
    eventType: "claim_created",
    entityType: "claim",
    entityId: 1,
    organizationId: 1,
    userId: 3,
    orderId: 3,
    claimId: 1,
    message: "Claim CLM-2026-001 created for order ORD-2026-0003.",
    createdAt: "2026-01-25T11:10:00.000Z",
  },
  {
    id: 6,
    eventType: "claim_created",
    entityType: "claim",
    entityId: 2,
    organizationId: 1,
    userId: 4,
    orderId: null,
    claimId: 2,
    message: "Claim CLM-2026-002 created without linked order.",
    createdAt: "2026-01-26T09:25:00.000Z",
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

  async listDealers(): Promise<Dealer[]> {
    return dealersSeed;
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
    const commentSuffix = input.comment?.trim() ? ` Comment: ${input.comment.trim()}` : "";
    activityEventsSeed.push({
      id: getNextId(activityEventsSeed),
      eventType: "order_created",
      entityType: "order",
      entityId: order.id,
      organizationId: order.organizationId,
      userId: order.createdByUserId,
      orderId: order.id,
      claimId: null,
      message: `Order ${order.orderNumber} created for ${dealerOrganization?.name ?? `dealer #${dealer.id}`}.${commentSuffix}`,
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
