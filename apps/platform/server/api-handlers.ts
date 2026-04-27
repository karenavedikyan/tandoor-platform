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

const distributionReportItemSchema = z.object({
  productId: z.number().int().positive(),
  isPresent: z.boolean(),
  isOnShowcase: z.boolean(),
  stockStatus: z.enum(["in_stock", "low_stock", "out_of_stock", "unknown"]),
  comment: z.string().trim().max(500).optional().nullable(),
});

const distributionReportPayloadSchema = z.object({
  hasShowcase: z.boolean(),
  showcaseDoorsCount: z.number().int().min(0),
  displayQuality: z.enum(["excellent", "good", "average", "poor"]),
  competitorPresence: z.enum(["none", "low", "medium", "high"]),
  recommendation: z.string().trim().min(1),
  nextAction: z.string().trim().min(1),
  items: z.array(distributionReportItemSchema).min(1),
});

const showcaseGoalStatusUpdateSchema = z.object({
  status: z.enum([
    "new",
    "in_progress",
    "agreed",
    "completed",
    "rejected",
    "overdue",
  ]),
});

const salesTaskStatusUpdateSchema = z.object({
  status: z.enum([
    "new",
    "in_progress",
    "waiting_dealer",
    "done",
    "overdue",
    "cancelled",
  ]),
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

export async function getRegionalRoutes(): Promise<ApiResult> {
  return { status: 200, body: await storage.listRegionalRoutes() };
}

export async function getRegionalManagerWorkspace(): Promise<ApiResult> {
  return { status: 200, body: await storage.getRegionalManagerWorkspace() };
}

export async function getRegionalRouteById(rawId: string): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID маршрута должен быть числом" } };
  }
  const detail = await storage.getRegionalRouteById(id);
  if (!detail) {
    return { status: 404, body: { message: "Маршрут не найден" } };
  }
  return { status: 200, body: detail };
}

export async function getRegionalVisitById(rawId: string): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID визита должен быть числом" } };
  }
  const detail = await storage.getRegionalManagerVisitById(id);
  if (!detail) {
    return { status: 404, body: { message: "Визит не найден" } };
  }
  return { status: 200, body: detail };
}

export async function getRegionalVisitDistributionReport(rawId: string): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID визита должен быть числом" } };
  }
  const report = await storage.getDistributionReportByVisitId(id);
  if (!report) {
    return { status: 404, body: { message: "Отчет по визиту не найден" } };
  }
  return { status: 200, body: report };
}

export async function saveRegionalVisitDistributionDraft(
  rawId: string,
  body: unknown,
): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID визита должен быть числом" } };
  }
  const parsed = distributionReportPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        message: "Некорректные данные отчета",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }
  try {
    return { status: 200, body: await storage.saveDistributionReportDraft(id, parsed.data) };
  } catch (error) {
    if (error instanceof StorageError) {
      return { status: error.status, body: { message: error.message } };
    }
    return { status: 500, body: { message: "Не удалось сохранить черновик отчета" } };
  }
}

export async function submitRegionalVisitDistributionReport(
  rawId: string,
  body: unknown,
): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID визита должен быть числом" } };
  }
  const parsed = distributionReportPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        message: "Некорректные данные отчета",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }
  try {
    return {
      status: 200,
      body: await storage.submitDistributionReport(id, parsed.data),
    };
  } catch (error) {
    if (error instanceof StorageError) {
      return { status: error.status, body: { message: error.message } };
    }
    return { status: 500, body: { message: "Не удалось отправить отчет" } };
  }
}

export async function getSalesShowcaseGoals(): Promise<ApiResult> {
  return { status: 200, body: await storage.listShowcaseGoals() };
}

export async function getSalesShowcaseGoalById(rawId: string): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID цели должен быть числом" } };
  }
  const detail = await storage.getShowcaseGoalById(id);
  if (!detail) {
    return { status: 404, body: { message: "Цель по витрине не найдена" } };
  }
  return { status: 200, body: detail };
}

export async function getSalesTasks(): Promise<ApiResult> {
  return { status: 200, body: await storage.listSalesTasks() };
}

export async function getSalesLeadershipDashboard(): Promise<ApiResult> {
  return { status: 200, body: await storage.getSalesLeadershipDashboard() };
}

export async function getSalesManagerWorkspace(): Promise<ApiResult> {
  return { status: 200, body: await storage.getSalesManagerWorkspace() };
}

export async function getClientImportTemplate(): Promise<ApiResult> {
  return { status: 200, body: await storage.getClientImportTemplateFields() };
}

export async function getClientImportPreview(): Promise<ApiResult> {
  return { status: 200, body: await storage.getClientImportPreview() };
}

export async function validateClientImport(): Promise<ApiResult> {
  return { status: 200, body: await storage.validateClientImport() };
}

export async function commitClientImport(): Promise<ApiResult> {
  return { status: 200, body: await storage.commitClientImport() };
}

export async function getSalesTaskById(rawId: string): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID задачи должен быть числом" } };
  }
  const detail = await storage.getSalesTaskById(id);
  if (!detail) {
    return { status: 404, body: { message: "Задача отдела продаж не найдена" } };
  }
  return { status: 200, body: detail };
}

export async function updateSalesShowcaseGoalStatus(
  rawId: string,
  body: unknown,
): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID цели должен быть числом" } };
  }
  const parsed = showcaseGoalStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        message: "Некорректный статус цели",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }
  try {
    return { status: 200, body: await storage.updateShowcaseGoalStatus(id, parsed.data.status) };
  } catch (error) {
    if (error instanceof StorageError) {
      return { status: error.status, body: { message: error.message } };
    }
    return { status: 500, body: { message: "Не удалось обновить статус цели" } };
  }
}

export async function updateSalesTaskStatus(
  rawId: string,
  body: unknown,
): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID задачи должен быть числом" } };
  }
  const parsed = salesTaskStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        message: "Некорректный статус задачи",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }
  try {
    return { status: 200, body: await storage.updateSalesTaskStatus(id, parsed.data.status) };
  } catch (error) {
    if (error instanceof StorageError) {
      return { status: error.status, body: { message: error.message } };
    }
    return { status: 500, body: { message: "Не удалось обновить статус задачи" } };
  }
}

export async function createShowcaseGoalFromVisitDistributionReport(
  rawId: string,
): Promise<ApiResult> {
  const id = parseIdParam(rawId);
  if (id == null) {
    return { status: 400, body: { message: "ID визита должен быть числом" } };
  }
  try {
    return { status: 200, body: await storage.createShowcaseGoalFromDistributionReport(id) };
  } catch (error) {
    if (error instanceof StorageError) {
      return { status: error.status, body: { message: error.message } };
    }
    return { status: 500, body: { message: "Не удалось сформировать цель по витрине" } };
  }
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
  if (upperMethod === "GET" && normalized === "/api/regional-manager/routes") {
    return getRegionalRoutes();
  }
  if (upperMethod === "GET" && normalized === "/api/regional-manager/workspace") {
    return getRegionalManagerWorkspace();
  }
  const regionalRouteDetailMatch = /^\/api\/regional-manager\/routes\/(\d+)$/.exec(normalized);
  if (upperMethod === "GET" && regionalRouteDetailMatch) {
    return getRegionalRouteById(regionalRouteDetailMatch[1]);
  }
  const regionalVisitMatch = /^\/api\/regional-manager\/visits\/(\d+)$/.exec(normalized);
  if (upperMethod === "GET" && regionalVisitMatch) {
    return getRegionalVisitById(regionalVisitMatch[1]);
  }
  const regionalVisitReportMatch =
    /^\/api\/regional-manager\/visits\/(\d+)\/distribution-report$/.exec(normalized);
  if (upperMethod === "GET" && regionalVisitReportMatch) {
    return getRegionalVisitDistributionReport(regionalVisitReportMatch[1]);
  }
  const regionalVisitDraftMatch =
    /^\/api\/regional-manager\/visits\/(\d+)\/distribution-report\/draft$/.exec(normalized);
  if (upperMethod === "POST" && regionalVisitDraftMatch) {
    return saveRegionalVisitDistributionDraft(regionalVisitDraftMatch[1], body);
  }
  const regionalVisitSubmitMatch =
    /^\/api\/regional-manager\/visits\/(\d+)\/distribution-report\/submit$/.exec(normalized);
  if (upperMethod === "POST" && regionalVisitSubmitMatch) {
    return submitRegionalVisitDistributionReport(regionalVisitSubmitMatch[1], body);
  }
  const regionalVisitCreateGoalMatch =
    /^\/api\/regional-manager\/visits\/(\d+)\/distribution-report\/create-showcase-goal$/.exec(
      normalized,
    );
  if (upperMethod === "POST" && regionalVisitCreateGoalMatch) {
    return createShowcaseGoalFromVisitDistributionReport(regionalVisitCreateGoalMatch[1]);
  }
  if (upperMethod === "GET" && normalized === "/api/sales/showcase-goals") {
    return getSalesShowcaseGoals();
  }
  const salesShowcaseGoalDetailMatch = /^\/api\/sales\/showcase-goals\/(\d+)$/.exec(normalized);
  if (upperMethod === "GET" && salesShowcaseGoalDetailMatch) {
    return getSalesShowcaseGoalById(salesShowcaseGoalDetailMatch[1]);
  }
  const salesShowcaseGoalStatusMatch =
    /^\/api\/sales\/showcase-goals\/(\d+)\/status$/.exec(normalized);
  if (upperMethod === "POST" && salesShowcaseGoalStatusMatch) {
    return updateSalesShowcaseGoalStatus(salesShowcaseGoalStatusMatch[1], body);
  }
  if (upperMethod === "GET" && normalized === "/api/sales/tasks") {
    return getSalesTasks();
  }
  if (upperMethod === "GET" && normalized === "/api/sales/leadership-dashboard") {
    return getSalesLeadershipDashboard();
  }
  if (upperMethod === "GET" && normalized === "/api/sales/manager-workspace") {
    return getSalesManagerWorkspace();
  }
  if (upperMethod === "GET" && normalized === "/api/sales/client-import/template") {
    return getClientImportTemplate();
  }
  if (upperMethod === "GET" && normalized === "/api/sales/client-import/preview") {
    return getClientImportPreview();
  }
  if (upperMethod === "POST" && normalized === "/api/sales/client-import/validate") {
    return validateClientImport();
  }
  if (upperMethod === "POST" && normalized === "/api/sales/client-import/commit") {
    return commitClientImport();
  }
  const salesTaskDetailMatch = /^\/api\/sales\/tasks\/(\d+)$/.exec(normalized);
  if (upperMethod === "GET" && salesTaskDetailMatch) {
    return getSalesTaskById(salesTaskDetailMatch[1]);
  }
  const salesTaskStatusMatch = /^\/api\/sales\/tasks\/(\d+)\/status$/.exec(normalized);
  if (upperMethod === "POST" && salesTaskStatusMatch) {
    return updateSalesTaskStatus(salesTaskStatusMatch[1], body);
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
