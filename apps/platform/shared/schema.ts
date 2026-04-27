import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type DealerType = "network" | "single";
export type DealerPotentialLevel = "high" | "medium" | "low";
export type TradePointFormat = "showroom" | "retail_store" | "warehouse" | "mixed";
export type TradePointStatus = "active" | "inactive";
export type DealerTaskType =
  | "sales_follow_up"
  | "showcase_goal"
  | "distribution_gap"
  | "visit_follow_up"
  | "document"
  | "other";
export type DealerTaskStatus = "new" | "in_progress" | "done" | "rejected";
export type DealerTaskPriority = "high" | "medium" | "low";
export type DealerTaskSource = "manual" | "distribution_report" | "visit" | "order";
export type DealerInteractionRoleContext =
  | "sales_manager"
  | "regional_manager"
  | "sales_assistant"
  | "sales_head"
  | "system";
export type DealerInteractionType = "call" | "meeting" | "visit" | "report" | "task_created" | "order" | "claim";
export type RegionalRouteStatus = "planned" | "in_progress" | "completed";
export type RouteVisitStatus = "planned" | "in_progress" | "completed" | "skipped";
export type RouteVisitPurpose =
  | "distribution_check"
  | "showcase_check"
  | "training"
  | "order_follow_up"
  | "claim_follow_up";
export type RouteVisitPriority = "low" | "medium" | "high";
export type DistributionReportStatus = "draft" | "submitted" | "reviewed";
export type DistributionDisplayQuality = "excellent" | "good" | "average" | "poor";
export type DistributionCompetitorPresence = "none" | "low" | "medium" | "high";
export type DistributionStockStatus = "in_stock" | "low_stock" | "out_of_stock" | "unknown";
export type ShowcaseGoalStatus =
  | "new"
  | "in_progress"
  | "agreed"
  | "completed"
  | "rejected"
  | "overdue";
export type ShowcaseGoalPriority = "low" | "medium" | "high";
export type ShowcaseGoalSource =
  | "distribution_report"
  | "sales_head"
  | "regional_manager"
  | "manual";
export type ShowcaseGoalItemCurrentState =
  | "missing"
  | "in_stock_not_showcase"
  | "on_showcase"
  | "unknown";
export type ShowcaseGoalItemTargetState = "on_showcase" | "in_stock" | "ordered";
export type ShowcaseGoalItemStatus = "new" | "agreed" | "ordered" | "completed" | "rejected";
export type SalesTaskType =
  | "showcase_goal"
  | "call_dealer"
  | "prepare_offer"
  | "coordinate_delivery"
  | "update_documents"
  | "follow_up"
  | "other";
export type SalesTaskStatus =
  | "new"
  | "in_progress"
  | "waiting_dealer"
  | "done"
  | "overdue"
  | "cancelled";
export type SalesTaskPriority = "low" | "medium" | "high";

export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  orgType: text("org_type").notNull(),
  taxId: text("tax_id"),
  city: text("city"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
});

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
});

export const userRoles = sqliteTable("user_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id),
  assignedAt: text("assigned_at").notNull(),
});

export const dealers = sqliteTable("dealers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  dealerType: text("dealer_type").notNull().default("single"),
  segment: text("segment").notNull(),
  region: text("region"),
  city: text("city"),
  salesManagerId: integer("sales_manager_id").references(() => users.id),
  regionalManagerId: integer("regional_manager_id").references(() => users.id),
  // Deprecated compatibility fields (kept for older payloads/views).
  managerUserId: integer("manager_user_id").references(() => users.id),
  tier: text("tier"),
  potentialLevel: text("potential_level").notNull().default("medium"),
  status: text("status").notNull().default("active"),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
});

export const tradePoints = sqliteTable("trade_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  name: text("name").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  storeFormat: text("store_format").notNull(),
  areaSqm: integer("area_sqm"),
  assortmentProfile: text("assortment_profile").notNull(),
  status: text("status").notNull().default("active"),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
});

export const dealerTasks = sqliteTable("dealer_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  tradePointId: integer("trade_point_id").references(() => tradePoints.id),
  assignedToUserId: integer("assigned_to_user_id")
    .notNull()
    .references(() => users.id),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(),
  priority: text("priority").notNull().default("medium"),
  dueDate: text("due_date").notNull(),
  source: text("source").notNull(),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const dealerInteractions = sqliteTable("dealer_interactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  tradePointId: integer("trade_point_id").references(() => tradePoints.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  roleContext: text("role_context").notNull(),
  type: text("type").notNull(),
  summary: text("summary").notNull(),
  createdAt: text("created_at").notNull(),
});

export const regionalRoutes = sqliteTable("regional_routes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  regionalManagerId: integer("regional_manager_id")
    .notNull()
    .references(() => users.id),
  routeDate: text("route_date").notNull(),
  title: text("title").notNull(),
  region: text("region").notNull(),
  status: text("status").notNull().default("planned"),
  plannedVisitsCount: integer("planned_visits_count").notNull().default(0),
  completedVisitsCount: integer("completed_visits_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const routeVisits = sqliteTable("route_visits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  routeId: integer("route_id")
    .notNull()
    .references(() => regionalRoutes.id),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  tradePointId: integer("trade_point_id")
    .notNull()
    .references(() => tradePoints.id),
  plannedTime: text("planned_time").notNull(),
  visitStatus: text("visit_status").notNull().default("planned"),
  visitPurpose: text("visit_purpose").notNull(),
  priority: text("priority").notNull().default("medium"),
  comment: text("comment"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
});

export const distributionReports = sqliteTable("distribution_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitId: integer("visit_id")
    .notNull()
    .references(() => routeVisits.id),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  tradePointId: integer("trade_point_id")
    .notNull()
    .references(() => tradePoints.id),
  regionalManagerId: integer("regional_manager_id")
    .notNull()
    .references(() => users.id),
  reportStatus: text("report_status").notNull().default("draft"),
  hasShowcase: integer("has_showcase").notNull().default(0),
  showcaseDoorsCount: integer("showcase_doors_count").notNull().default(0),
  totalModelsChecked: integer("total_models_checked").notNull().default(0),
  presentModelsCount: integer("present_models_count").notNull().default(0),
  missingModelsCount: integer("missing_models_count").notNull().default(0),
  displayQuality: text("display_quality").notNull().default("average"),
  competitorPresence: text("competitor_presence").notNull().default("none"),
  recommendation: text("recommendation").notNull(),
  nextAction: text("next_action").notNull(),
  createdAt: text("created_at").notNull(),
  submittedAt: text("submitted_at"),
});

export const distributionReportItems = sqliteTable("distribution_report_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportId: integer("report_id")
    .notNull()
    .references(() => distributionReports.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  modelName: text("model_name").notNull(),
  sku: text("sku").notNull(),
  category: text("category").notNull(),
  isPresent: integer("is_present").notNull().default(0),
  isOnShowcase: integer("is_on_showcase").notNull().default(0),
  stockStatus: text("stock_status").notNull().default("unknown"),
  comment: text("comment"),
});

export const showcaseGoals = sqliteTable("showcase_goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  tradePointId: integer("trade_point_id")
    .notNull()
    .references(() => tradePoints.id),
  distributionReportId: integer("distribution_report_id").references(() => distributionReports.id),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => users.id),
  assignedToUserId: integer("assigned_to_user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  goalStatus: text("goal_status").notNull().default("new"),
  priority: text("priority").notNull().default("medium"),
  dueDate: text("due_date").notNull(),
  source: text("source").notNull().default("manual"),
  targetModelsCount: integer("target_models_count").notNull().default(0),
  completedModelsCount: integer("completed_models_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const showcaseGoalItems = sqliteTable("showcase_goal_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  goalId: integer("goal_id")
    .notNull()
    .references(() => showcaseGoals.id),
  productId: integer("product_id").references(() => products.id),
  modelName: text("model_name").notNull(),
  sku: text("sku").notNull(),
  category: text("category").notNull(),
  currentState: text("current_state").notNull().default("unknown"),
  targetState: text("target_state").notNull().default("on_showcase"),
  itemStatus: text("item_status").notNull().default("new"),
  comment: text("comment"),
});

export const salesTasks = sqliteTable("sales_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  tradePointId: integer("trade_point_id").references(() => tradePoints.id),
  showcaseGoalId: integer("showcase_goal_id").references(() => showcaseGoals.id),
  assignedToUserId: integer("assigned_to_user_id")
    .notNull()
    .references(() => users.id),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => users.id),
  taskType: text("task_type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  taskStatus: text("task_status").notNull().default("new"),
  priority: text("priority").notNull().default("medium"),
  dueDate: text("due_date").notNull(),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  finishColor: text("finish_color").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("RUB"),
  availabilityStatus: text("availability_status").notNull(),
  stockQty: integer("stock_qty").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderNumber: text("order_number").notNull().unique(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => users.id),
  status: text("status").notNull(),
  totalCents: integer("total_cents").notNull(),
  currency: text("currency").notNull().default("RUB"),
  requestedDeliveryDate: text("requested_delivery_date"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  totalPriceCents: integer("total_price_cents").notNull(),
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  orderId: integer("order_id").references(() => orders.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  fileUrl: text("file_url"),
  status: text("status").notNull().default("published"),
  createdAt: text("created_at").notNull(),
});

export const claims = sqliteTable("claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  claimNumber: text("claim_number").notNull().unique(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  dealerId: integer("dealer_id")
    .notNull()
    .references(() => dealers.id),
  orderId: integer("order_id").references(() => orders.id),
  status: text("status").notNull(),
  reason: text("reason").notNull(),
  description: text("description"),
  resolutionNote: text("resolution_note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const activityEvents = sqliteTable("activity_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  orderId: integer("order_id").references(() => orders.id),
  claimId: integer("claim_id").references(() => claims.id),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
});
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
});
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
});
export const insertDealerSchema = createInsertSchema(dealers).omit({
  id: true,
});
export const insertTradePointSchema = createInsertSchema(tradePoints).omit({
  id: true,
});
export const insertDealerTaskSchema = createInsertSchema(dealerTasks).omit({
  id: true,
});
export const insertDealerInteractionSchema = createInsertSchema(dealerInteractions).omit({
  id: true,
});
export const insertRegionalRouteSchema = createInsertSchema(regionalRoutes).omit({
  id: true,
});
export const insertRouteVisitSchema = createInsertSchema(routeVisits).omit({
  id: true,
});
export const insertDistributionReportSchema = createInsertSchema(distributionReports).omit({
  id: true,
});
export const insertDistributionReportItemSchema = createInsertSchema(distributionReportItems).omit({
  id: true,
});
export const insertShowcaseGoalSchema = createInsertSchema(showcaseGoals).omit({
  id: true,
});
export const insertShowcaseGoalItemSchema = createInsertSchema(showcaseGoalItems).omit({
  id: true,
});
export const insertSalesTaskSchema = createInsertSchema(salesTasks).omit({
  id: true,
});
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});
export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});
export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
});
export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true,
});
export const insertActivityEventSchema = createInsertSchema(activityEvents).omit({
  id: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;
export type InsertDealer = z.infer<typeof insertDealerSchema>;
export type Dealer = typeof dealers.$inferSelect;
export type InsertTradePoint = z.infer<typeof insertTradePointSchema>;
export type TradePoint = typeof tradePoints.$inferSelect;
export type InsertDealerTask = z.infer<typeof insertDealerTaskSchema>;
export type DealerTask = typeof dealerTasks.$inferSelect;
export type InsertDealerInteraction = z.infer<typeof insertDealerInteractionSchema>;
export type DealerInteraction = typeof dealerInteractions.$inferSelect;
export type InsertRegionalRoute = z.infer<typeof insertRegionalRouteSchema>;
export type RegionalRoute = typeof regionalRoutes.$inferSelect;
export type InsertRouteVisit = z.infer<typeof insertRouteVisitSchema>;
export type RouteVisit = typeof routeVisits.$inferSelect;
export type InsertDistributionReport = z.infer<typeof insertDistributionReportSchema>;
export type DistributionReport = typeof distributionReports.$inferSelect;
export type InsertDistributionReportItem = z.infer<typeof insertDistributionReportItemSchema>;
export type DistributionReportItem = typeof distributionReportItems.$inferSelect;
export type InsertShowcaseGoal = z.infer<typeof insertShowcaseGoalSchema>;
export type ShowcaseGoal = typeof showcaseGoals.$inferSelect;
export type InsertShowcaseGoalItem = z.infer<typeof insertShowcaseGoalItemSchema>;
export type ShowcaseGoalItem = typeof showcaseGoalItems.$inferSelect;
export type InsertSalesTask = z.infer<typeof insertSalesTaskSchema>;
export type SalesTask = typeof salesTasks.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claims.$inferSelect;
export type InsertActivityEvent = z.infer<typeof insertActivityEventSchema>;
export type ActivityEvent = typeof activityEvents.$inferSelect;
