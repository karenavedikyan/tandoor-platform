/**
 * Drizzle-схема оверрайдов дилера (Postgres, prompt 113).
 */

import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth-schema.js";

export const dealerOverrides = pgTable("dealer_overrides", {
  dealerId: text("dealer_id").primaryKey(),
  name: text("name"),
  city: text("city"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  generalComment: text("general_comment"),
  clientCategory: text("client_category"),
  trashedAt: timestamp("trashed_at", { withTimezone: true, mode: "string" }),
  trashedBy: uuid("trashed_by").references(() => authUsers.id),
  unloadingOrder: text("unloading_order"),
  regionalManagerId: uuid("regional_manager_id").references(() => authUsers.id),
  regionalManagerName: text("regional_manager_name"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
  updatedBy: uuid("updated_by").references(() => authUsers.id),
});

export const dealerOverrideEvents = pgTable(
  "dealer_override_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: text("dealer_id").notNull(),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedBy: uuid("changed_by").references(() => authUsers.id),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("idx_dealer_override_events_dealer").on(t.dealerId, t.changedAt)],
);

export const dealerTrainingState = pgTable("dealer_training_state", {
  dealerId: text("dealer_id").primaryKey(),
  productTrainingDone: boolean("product_training_done").notNull().default(false),
  needsNewEmployeesTraining: boolean("needs_new_employees_training").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
  updatedBy: uuid("updated_by").references(() => authUsers.id),
});

export const manualDealers = pgTable("manual_dealers", {
  dealerId: text("dealer_id").primaryKey(),
  payload: jsonb("payload").notNull(),
  createdBy: uuid("created_by").references(() => authUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
});
