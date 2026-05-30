/**
 * Drizzle-схема маркетинговых брифов (Postgres).
 */

import { sql } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth-schema.js";

export const marketingBriefs = pgTable(
  "marketing_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    periodLabel: text("period_label").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("draft"),
    visibility: text("visibility").notNull().default("private"),
    category: text("category").notNull().default("brief"),
    accentColor: text("accent_color").notNull().default("#9ACA3C"),
    coverText: text("cover_text").notNull().default(""),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    index("idx_marketing_briefs_status").on(t.status),
    index("idx_marketing_briefs_period").on(t.periodLabel),
    index("idx_marketing_briefs_category").on(t.category),
  ],
);

export const userBriefViews = pgTable(
  "user_brief_views",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    briefId: uuid("brief_id")
      .notNull()
      .references(() => marketingBriefs.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.briefId] }),
    briefIdx: index("idx_user_brief_views_brief").on(t.briefId),
    userIdx: index("idx_user_brief_views_user").on(t.userId),
  }),
);
