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
  managerUserId: number | null;
  region: string | null;
  tier: string | null;
  status: string;
  createdAt: string;
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

// ---------- Seed data ----------

const organizationsSeed: Organization[] = [
  { id: 1, name: "Tandoor HQ", orgType: "tandoor", taxId: "770401001", city: "Moscow", status: "active", createdAt: "2026-01-10T09:00:00.000Z" },
  { id: 2, name: "Volga Doors Dealer LLC", orgType: "dealer", taxId: "6312012456", city: "Samara", status: "active", createdAt: "2026-01-12T08:15:00.000Z" },
  { id: 3, name: "Ural Build Partner", orgType: "dealer", taxId: "6678990102", city: "Yekaterinburg", status: "active", createdAt: "2026-01-13T10:25:00.000Z" },
  { id: 4, name: "SteelCore Supplier JSC", orgType: "supplier", taxId: "7722334455", city: "Tula", status: "active", createdAt: "2026-01-15T11:05:00.000Z" },
];

const usersSeed: User[] = [
  { id: 1, organizationId: 1, firstName: "Karen", lastName: "Avedikyan", email: "k.avedikyan@tandoor.ru", phone: "+7 900 000-10-10", status: "active", createdAt: "2026-01-10T09:30:00.000Z" },
  { id: 2, organizationId: 1, firstName: "Olga", lastName: "Morozova", email: "o.morozova@tandoor.ru", phone: "+7 900 000-10-20", status: "active", createdAt: "2026-01-10T10:00:00.000Z" },
  { id: 3, organizationId: 2, firstName: "Denis", lastName: "Karpov", email: "d.karpov@volgadoors.ru", phone: "+7 902 111-22-33", status: "active", createdAt: "2026-01-12T08:45:00.000Z" },
  { id: 4, organizationId: 3, firstName: "Irina", lastName: "Sokolova", email: "i.sokolova@uralbuild.ru", phone: "+7 912 444-55-66", status: "active", createdAt: "2026-01-13T11:20:00.000Z" },
  { id: 5, organizationId: 4, firstName: "Pavel", lastName: "Serov", email: "p.serov@steelcore.ru", phone: "+7 487 200-44-11", status: "active", createdAt: "2026-01-15T12:05:00.000Z" },
];

const dealersSeed: Dealer[] = [
  { id: 1, organizationId: 2, managerUserId: 3, region: "Volga Federal District", tier: "gold", status: "active", createdAt: "2026-01-12T08:50:00.000Z" },
  { id: 2, organizationId: 3, managerUserId: 4, region: "Ural Federal District", tier: "silver", status: "active", createdAt: "2026-01-13T11:25:00.000Z" },
];

const productsSeed: Product[] = [
  { id: 1, sku: "TD-ENTRY-860-BLK", name: "Tandoor Entry 860", category: "entry_door", finishColor: "Graphite Black", priceCents: 6890000, currency: "RUB", availabilityStatus: "in_stock", stockQty: 24, createdAt: "2026-01-16T08:00:00.000Z" },
  { id: 2, sku: "TD-ENTRY-960-OAK", name: "Tandoor Entry 960", category: "entry_door", finishColor: "Natural Oak", priceCents: 7450000, currency: "RUB", availabilityStatus: "in_stock", stockQty: 17, createdAt: "2026-01-16T08:02:00.000Z" },
  { id: 3, sku: "TD-LINE-GLASS-WHT", name: "Tandoor Line Glass", category: "interior_door", finishColor: "Polar White", priceCents: 3820000, currency: "RUB", availabilityStatus: "limited", stockQty: 8, createdAt: "2026-01-16T08:04:00.000Z" },
  { id: 4, sku: "TD-FIRE-900-MTL", name: "Tandoor FireSafe 900", category: "fire_door", finishColor: "Metal Gray", priceCents: 9120000, currency: "RUB", availabilityStatus: "in_stock", stockQty: 11, createdAt: "2026-01-16T08:06:00.000Z" },
  { id: 5, sku: "TD-LOFT-880-GRN", name: "Tandoor Loft 880", category: "entry_door", finishColor: "Olive Green", priceCents: 6990000, currency: "RUB", availabilityStatus: "backorder", stockQty: 0, createdAt: "2026-01-16T08:08:00.000Z" },
];

const ordersSeed: Order[] = [
  { id: 1, orderNumber: "ORD-2026-0001", organizationId: 1, dealerId: 1, createdByUserId: 2, status: "submitted", totalCents: 20670000, currency: "RUB", requestedDeliveryDate: "2026-02-05", createdAt: "2026-01-20T10:15:00.000Z", updatedAt: "2026-01-20T10:15:00.000Z" },
  { id: 2, orderNumber: "ORD-2026-0002", organizationId: 1, dealerId: 2, createdByUserId: 2, status: "assembling", totalCents: 14900000, currency: "RUB", requestedDeliveryDate: "2026-02-08", createdAt: "2026-01-21T09:40:00.000Z", updatedAt: "2026-01-23T12:00:00.000Z" },
  { id: 3, orderNumber: "ORD-2026-0003", organizationId: 1, dealerId: 1, createdByUserId: 2, status: "shipped", totalCents: 9120000, currency: "RUB", requestedDeliveryDate: "2026-01-30", createdAt: "2026-01-18T14:10:00.000Z", updatedAt: "2026-01-24T07:30:00.000Z" },
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
  { id: 1, eventType: "order_created", entityType: "order", entityId: 1, organizationId: 1, userId: 2, orderId: 1, claimId: null, message: "Order ORD-2026-0001 created by sales manager.", createdAt: "2026-01-20T10:15:00.000Z" },
  { id: 2, eventType: "document_added", entityType: "document", entityId: 1, organizationId: 1, userId: 2, orderId: 1, claimId: null, message: "Invoice INV-0001 added to order ORD-2026-0001.", createdAt: "2026-01-20T10:20:00.000Z" },
  { id: 3, eventType: "order_status_changed", entityType: "order", entityId: 2, organizationId: 1, userId: 2, orderId: 2, claimId: null, message: "Order ORD-2026-0002 moved to assembling.", createdAt: "2026-01-23T12:00:00.000Z" },
  { id: 4, eventType: "order_status_changed", entityType: "order", entityId: 3, organizationId: 1, userId: 2, orderId: 3, claimId: null, message: "Order ORD-2026-0003 shipped from warehouse.", createdAt: "2026-01-24T07:30:00.000Z" },
  { id: 5, eventType: "claim_created", entityType: "claim", entityId: 1, organizationId: 1, userId: 3, orderId: 3, claimId: 1, message: "Claim CLM-2026-001 created for order ORD-2026-0003.", createdAt: "2026-01-25T11:10:00.000Z" },
  { id: 6, eventType: "claim_created", entityType: "claim", entityId: 2, organizationId: 1, userId: 4, orderId: null, claimId: 2, message: "Claim CLM-2026-002 created without linked order.", createdAt: "2026-01-26T09:25:00.000Z" },
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
function listDealers(): ApiResult { return { status: 200, body: dealersSeed }; }
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
    const commentSuffix = payload.comment?.trim() ? ` Comment: ${payload.comment.trim()}` : "";
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

export default function handler(req: VercelRequest, res: VercelResponse): void {
  const method = req.method ?? "GET";
  const rawUrl = req.url ?? "/";
  const pathname = rawUrl.split("?")[0] ?? "/";
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
