/**
 * Drizzle-схема Postgres: дилеры и торговые точки (Промт 348).
 * Применение — `server/migrations/2026_06_05_dealers_trade_points.sql` или `auth:db-push` после подключения в drizzle config.
 */

import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers, teams } from "./auth-schema.js";

export const dealers = pgTable(
  "dealers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Стабильный ключ = `DealerRow.id` (напр. client-ma-ma085529). */
    externalKey: text("external_key").notNull().unique(),
    name: text("name").notNull(),
    releaseCode: text("release_code"),
    city: text("city"),
    /** РОП / регион (ropName из Release 1). */
    region: text("region"),
    /** normalizedClientType из seed. */
    clientType: text("client_type"),
    /** ClientCategoryId из deriveReleaseClientCategory. */
    clientCategory: text("client_category"),
    /** DealerStatus (активный / потенциальный / …). */
    status: text("status"),
    /** DealerFormat (сетевой / одиночный). */
    format: text("format"),
    isActive: boolean("is_active").notNull().default(true),
    isPriority: boolean("is_priority").notNull().default(false),
    isClosed: boolean("is_closed").notNull().default(false),
    legalEntity: text("legal_entity"),
    holding: text("holding"),
    comment: text("comment"),
    /** Имя менеджера из Excel (для DealerRow.manager). */
    managerName: text("manager_name"),
    /** Адрес из Excel Release 1. */
    releaseAddress: text("release_address"),
    /** Тип клиента как в Excel (clientTypeLabel). */
    clientTypeLabel: text("client_type_label"),
    /** teamId из sales seed (team-skalaban и т.п.) — для фильтров. */
    releaseTeamId: text("release_team_id"),
    /** managerId из sales seed (mgr-lysenko-eg и т.п.) — для фильтров. */
    releaseManagerId: text("release_manager_id"),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    managerId: uuid("manager_id").references(() => authUsers.id, { onDelete: "set null" }),
    source: text("source").notNull().default("release-seed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_dealers_release_team").on(t.releaseTeamId),
    index("idx_dealers_release_manager").on(t.releaseManagerId),
    index("idx_dealers_city").on(t.city),
  ],
);

export const tradePoints = pgTable(
  "trade_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Стабильный ключ = `DealerTradePoint.id` (напр. client-ma-ma129050-01). */
    externalKey: text("external_key").notNull().unique(),
    dealerId: uuid("dealer_id")
      .notNull()
      .references(() => dealers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    city: text("city"),
    address: text("address"),
    format: text("format"),
    isActive: boolean("is_active").notNull().default(true),
    isPrimary: boolean("is_primary").notNull().default(false),
    importanceTier: text("importance_tier"),
    source: text("source").notNull().default("release-seed"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_trade_points_dealer").on(t.dealerId),
    index("idx_trade_points_external_key").on(t.externalKey),
  ],
);
