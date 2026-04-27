import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  /** @deprecated use salesManagerId; kept for backwards compatibility with older API payloads */
  managerUserId: integer("manager_user_id").references(() => users.id),
  name: text("name").notNull(),
  dealerType: text("dealer_type").notNull().default("single"),
  segment: text("segment"),
  region: text("region"),
  city: text("city"),
  salesManagerId: integer("sales_manager_id").references(() => users.id),
  regionalManagerId: integer("regional_manager_id").references(() => users.id),
  potentialLevel: text("potential_level"),
  status: text("status").notNull().default("active"),
  /** Legacy display field; prefer segment in new UI */
  tier: text("tier"),
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
  areaSqm: integer("area_sqm").notNull(),
  assortmentProfile: text("assortment_profile").notNull(),
  status: text("status").notNull().default("active"),
  comment: text("comment"),
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
