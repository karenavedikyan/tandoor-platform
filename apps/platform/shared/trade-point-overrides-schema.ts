/**
 * Drizzle-схема оверрайдов торговых точек (Postgres, prompt 113).
 */

import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth-schema.js";

export const tradePointOverrides = pgTable(
  "trade_point_overrides",
  {
    tpId: text("tp_id").primaryKey(),
    dealerId: text("dealer_id"),
    name: text("name"),
    city: text("city"),
    address: text("address"),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    comment: text("comment"),
    showcaseStatus: text("showcase_status"),
    shipmentDays: text("shipment_days"),
    isMainWarehouse: boolean("is_main_warehouse"),
    isHardwareWarehouse: boolean("is_hardware_warehouse"),
    trashedAt: timestamp("trashed_at", { withTimezone: true, mode: "string" }),
    trashedBy: uuid("trashed_by").references(() => authUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    updatedBy: uuid("updated_by").references(() => authUsers.id),
  },
  (t) => [index("idx_trade_point_overrides_dealer").on(t.dealerId)],
);

export const tradePointOverrideEvents = pgTable(
  "trade_point_override_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tpId: text("tp_id").notNull(),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedBy: uuid("changed_by").references(() => authUsers.id),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("idx_trade_point_override_events_tp").on(t.tpId, t.changedAt)],
);

export const tradePointTrainingState = pgTable("trade_point_training_state", {
  tpId: text("tp_id").primaryKey(),
  productTrainingDone: boolean("product_training_done").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
  updatedBy: uuid("updated_by").references(() => authUsers.id),
});
