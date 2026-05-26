/**
 * Drizzle-схема Postgres (Neon) для серверной авторизации.
 * Применение к базе — вручную: `npm run auth:db-push` (см. `docs/auth-access-foundation.md`), не из CI.
 */

import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const authUsers = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  fullName: text("full_name").notNull(),
  /** Значения из `UserRole` (`shared/auth.ts`). */
  role: text("role").notNull(),
  /** Значения из `UserStatus`. */
  status: text("status").notNull(),
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  createdBy: uuid("created_by").references((): AnyPgColumn => authUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "string" }),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true, mode: "string" }),
  /** Telegram user id для аварийного бота восстановления (только admin). */
  telegramUserId: bigint("telegram_user_id", { mode: "number" }).unique(),
  /** Первичный онбординг (смена пароля, профиль, Telegram) завершён. */
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, mode: "string" }),
});

/** Одноразовые токены deep-link привязки Telegram из ЛК (см. migrations-run). */
export const telegramLinkTokens = pgTable("telegram_link_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true, mode: "string" }),
});

export const passwordResetLinks = pgTable(
  "password_reset_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => authUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "string" }),
    usedIp: text("used_ip"),
  },
  (t) => [
    uniqueIndex("password_reset_links_token_hash_uq").on(t.tokenHash),
    index("idx_prl_user_active").on(t.userId).where(sql`${t.usedAt} IS NULL`),
  ],
);

/** Счётчик неудачных логинов и блокировка по email (см. migrations-run в admin API). */
export const authLoginFailures = pgTable("auth_login_failures", {
  emailLower: text("email_lower").primaryKey(),
  failCount: integer("fail_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
});

export const passwordResetRequests = pgTable(
  "password_reset_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    approverUserId: uuid("approver_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "string" }),
    resetLinkId: uuid("reset_link_id").references(() => passwordResetLinks.id, { onDelete: "set null" }),
  },
  (t) => [
    index("idx_prr_approver_pending").on(t.approverUserId).where(sql`${t.status} = 'pending'`),
    index("idx_prr_requester").on(t.requesterUserId),
  ],
);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ropUserId: uuid("rop_user_id").references(() => authUsers.id),
});

export const userTeamMemberships = pgTable(
  "user_team_memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    roleInTeam: text("role_in_team").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.teamId] })],
);

export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

export const userRegionScopes = pgTable(
  "user_region_scopes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.regionId] })],
);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  teamId: uuid("team_id").references(() => teams.id),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => authUsers.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  userAgent: text("user_agent"),
  ip: text("ip"),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => authUsers.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
});
