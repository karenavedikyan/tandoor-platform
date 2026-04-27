import { z } from "zod";
import { StorageError, storage } from "./storage";

export type ApiResult = {
  status: number;
  body: unknown;
};

const createOrderRequestSchema = z.object({
  dealerId: z.number().int().positive(),
  createdByUserId: z.number().int().positive().optional(),
  salesManagerId: z.number().int().positive().optional(),
  comment: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int(),
      }),
    )
    .min(1),
});

export async function getOrganizations(): Promise<ApiResult> {
  return { status: 200, body: await storage.listOrganizations() };
}

export async function getUsers(): Promise<ApiResult> {
  return { status: 200, body: await storage.listUsers() };
}

export async function getDealers(): Promise<ApiResult> {
  return { status: 200, body: await storage.listDealers() };
}

function parseIdParam(raw: string | undefined): number | null {
  if (raw == null) {
    return null;
  }
  const id = Number.parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

export async function getDealerById(rawId: string): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID дилера должен быть числом" } };
  }
  const detail = await storage.getDealerById(id);
  if (!detail) {
    return { status: 404, body: { message: "Дилер не найден" } };
  }
  return { status: 200, body: detail };
}

export async function getDealerTradePoints(dealerId: string): Promise<ApiResult> {
  const id = parseIdParam(dealerId);
  if (id == null) {
    return { status: 400, body: { message: "ID дилера должен быть числом" } };
  }
  if (!(await storage.getDealerById(id))) {
    return { status: 404, body: { message: "Дилер не найден" } };
  }
  return { status: 200, body: await storage.getTradePointsByDealerId(id) };
}

export async function getDealerTasks(dealerId: string): Promise<ApiResult> {
  const id = parseIdParam(dealerId);
  if (id == null) {
    return { status: 400, body: { message: "ID дилера должен быть числом" } };
  }
  if (!(await storage.getDealerById(id))) {
    return { status: 404, body: { message: "Дилер не найден" } };
  }
  return { status: 200, body: await storage.getDealerTasksByDealerId(id) };
}

export async function getDealerInteractions(dealerId: string): Promise<ApiResult> {
  const id = parseIdParam(dealerId);
  if (id == null) {
    return { status: 400, body: { message: "ID дилера должен быть числом" } };
  }
  if (!(await storage.getDealerById(id))) {
    return { status: 404, body: { message: "Дилер не найден" } };
  }
  return { status: 200, body: await storage.getDealerInteractionsByDealerId(id) };
}

export async function getProducts(): Promise<ApiResult> {
  return { status: 200, body: await storage.listProducts() };
}

export async function getOrders(): Promise<ApiResult> {
  return { status: 200, body: await storage.listOrders() };
}

export async function createOrder(body: unknown): Promise<ApiResult> {
  const parsed = createOrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        message: "Invalid order payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }

  const payload = parsed.data;
  const createdByUserId = payload.createdByUserId ?? payload.salesManagerId;
  if (!createdByUserId) {
    return {
      status: 400,
      body: {
        message: "Either createdByUserId or salesManagerId must be provided",
      },
    };
  }

  const hasInvalidQuantity = payload.items.some(
    (item) => !Number.isInteger(item.quantity) || item.quantity < 1,
  );
  if (hasInvalidQuantity) {
    return {
      status: 422,
      body: { message: "Each order item quantity must be at least 1" },
    };
  }

  try {
    const createdOrder = await storage.createOrder({
      dealerId: payload.dealerId,
      createdByUserId,
      comment: payload.comment,
      items: payload.items,
    });
    return { status: 201, body: createdOrder };
  } catch (error) {
    if (error instanceof StorageError) {
      return { status: error.status, body: { message: error.message } };
    }
    return { status: 500, body: { message: "Failed to create order" } };
  }
}

export async function getOrderById(rawId: string): Promise<ApiResult> {
  const id = Number.parseInt(rawId, 10);
  if (Number.isNaN(id)) {
    return {
      status: 400,
      body: { message: "Order id must be a valid number" },
    };
  }

  const order = await storage.getOrderById(id);
  if (!order) {
    return { status: 404, body: { message: "Order not found" } };
  }

  return { status: 200, body: order };
}

export async function getClaims(): Promise<ApiResult> {
  return { status: 200, body: await storage.listClaims() };
}

export async function getActivity(): Promise<ApiResult> {
  return { status: 200, body: await storage.listActivityEvents() };
}

export async function routeApiRequest(
  method: string,
  pathname: string,
  body: unknown,
): Promise<ApiResult> {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const upperMethod = method.toUpperCase();

  if (upperMethod === "GET" && normalized === "/api/organizations") {
    return getOrganizations();
  }
  if (upperMethod === "GET" && normalized === "/api/users") {
    return getUsers();
  }
  if (upperMethod === "GET" && normalized === "/api/dealers") {
    return getDealers();
  }
  const dealerDetailMatch = /^\/api\/dealers\/(\d+)$/.exec(normalized);
  if (upperMethod === "GET" && dealerDetailMatch) {
    return getDealerById(dealerDetailMatch[1]);
  }
  const tradePointsMatch = /^\/api\/dealers\/(\d+)\/trade-points$/.exec(normalized);
  if (upperMethod === "GET" && tradePointsMatch) {
    return getDealerTradePoints(tradePointsMatch[1]);
  }
  const tasksMatch = /^\/api\/dealers\/(\d+)\/tasks$/.exec(normalized);
  if (upperMethod === "GET" && tasksMatch) {
    return getDealerTasks(tasksMatch[1]);
  }
  const interactionsMatch = /^\/api\/dealers\/(\d+)\/interactions$/.exec(normalized);
  if (upperMethod === "GET" && interactionsMatch) {
    return getDealerInteractions(interactionsMatch[1]);
  }
  if (upperMethod === "GET" && normalized === "/api/products") {
    return getProducts();
  }
  if (upperMethod === "GET" && normalized === "/api/orders") {
    return getOrders();
  }
  if (upperMethod === "POST" && normalized === "/api/orders") {
    return createOrder(body);
  }
  const orderDetailMatch = /^\/api\/orders\/([^/]+)$/.exec(normalized);
  if (upperMethod === "GET" && orderDetailMatch) {
    return getOrderById(orderDetailMatch[1]);
  }
  if (upperMethod === "GET" && normalized === "/api/claims") {
    return getClaims();
  }
  if (upperMethod === "GET" && normalized === "/api/activity") {
    return getActivity();
  }

  return {
    status: 404,
    body: { message: `Not Found: ${upperMethod} ${normalized}` },
  };
}
