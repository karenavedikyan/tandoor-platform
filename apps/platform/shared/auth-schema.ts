/**
 * Drizzle-схема Postgres (Neon) для серверной авторизации.
 * Применение к базе — вручную: `npm run auth:db-push` (см. `docs/auth-access-foundation.md`), не из CI.
 */

import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  date,
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

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ropUserId: uuid("rop_user_id").references(() => authUsers.id),
  },
  (t) => [uniqueIndex("teams_name_unique").on(t.name)],
);

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

/** Актуальный ответственный по коду клиента (отдельно от per-user JSON в client_base_actualization_state). */
export const clientAssignments = pgTable(
  "client_assignments",
  {
    clientCode: text("client_code").primaryKey(),
    responsibleUserId: uuid("responsible_user_id")
      .notNull()
      .references(() => authUsers.id),
    teamId: uuid("team_id").references(() => teams.id),
    since: timestamp("since", { withTimezone: true, mode: "string" }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().default(sql`now()`),
  },
  (t) => [
    index("idx_client_assignments_user").on(t.responsibleUserId),
    index("idx_client_assignments_team").on(t.teamId),
  ],
);

export const clientAssignmentHistory = pgTable(
  "client_assignment_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientCode: text("client_code").notNull(),
    fromUserId: uuid("from_user_id").references(() => authUsers.id),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => authUsers.id),
    fromTeamId: uuid("from_team_id"),
    toTeamId: uuid("to_team_id"),
    actorUserId: uuid("actor_user_id").references(() => authUsers.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().default(sql`now()`),
  },
  (t) => [
    index("idx_cah_client_code").on(t.clientCode),
    index("idx_cah_to_user").on(t.toUserId),
    index("idx_cah_created_at").on(t.createdAt),
  ],
);

export const userTeamHistory = pgTable(
  "user_team_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    fromTeamId: uuid("from_team_id").references(() => teams.id),
    toTeamId: uuid("to_team_id").references(() => teams.id),
    roleInTeam: text("role_in_team"),
    actorUserId: uuid("actor_user_id").references(() => authUsers.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().default(sql`now()`),
  },
  (t) => [index("idx_uth_user").on(t.userId)],
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
  impersonatorUserId: uuid("impersonator_user_id").references(() => authUsers.id, { onDelete: "set null" }),
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

/** Промт 150: витринная матрица позиций по торговым точкам (дистрибуция). */
export const showcaseMatrixEntries = pgTable(
  "showcase_matrix_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealerId: text("dealer_id").notNull(),
    tradePointId: text("trade_point_id").notNull(),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    status: text("status").notNull(),
    comment: text("comment"),
    clientOpId: text("client_op_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    updatedBy: uuid("updated_by").references(() => authUsers.id),
    updatedByName: text("updated_by_name"),
    placementType: text("placement_type"),
    placementSegment: text("placement_segment"),
    placementCapacity: integer("placement_capacity"),
    placementActual: integer("placement_actual"),
    placementRef: text("placement_ref"),
    placementOurModels: jsonb("placement_our_models"),
    placementCompetitors: jsonb("placement_competitors"),
  },
  (t) => [
    uniqueIndex("uq_showcase_matrix_entry").on(t.tradePointId, t.targetKind, t.targetId),
    index("idx_showcase_matrix_tp").on(t.tradePointId),
    index("idx_showcase_matrix_dealer").on(t.dealerId),
    uniqueIndex("uq_showcase_matrix_client_op")
      .on(t.clientOpId)
      .where(sql`${t.clientOpId} IS NOT NULL`),
    index("idx_showcase_matrix_placement")
      .on(t.tradePointId, t.placementSegment)
      .where(sql`${t.targetKind} = 'placement'`),
    index("idx_showcase_matrix_placement_ref")
      .on(t.placementRef)
      .where(sql`${t.placementRef} IS NOT NULL`),
  ],
);

export const showcaseMatrixEvents = pgTable(
  "showcase_matrix_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id"),
    dealerId: text("dealer_id").notNull(),
    tradePointId: text("trade_point_id").notNull(),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    oldStatus: text("old_status"),
    newStatus: text("new_status"),
    comment: text("comment"),
    changedBy: uuid("changed_by").references(() => authUsers.id),
    changedByName: text("changed_by_name"),
    changedAt: timestamp("changed_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    placementType: text("placement_type"),
    placementSegment: text("placement_segment"),
    placementCapacity: integer("placement_capacity"),
    placementActual: integer("placement_actual"),
    placementRef: text("placement_ref"),
    placementOurModels: jsonb("placement_our_models"),
    placementCompetitors: jsonb("placement_competitors"),
  },
  (t) => [
    index("idx_showcase_matrix_events_tp").on(t.tradePointId, t.changedAt),
    index("idx_showcase_matrix_events_dealer").on(t.dealerId, t.changedAt),
  ],
);

/** Промт 159: справочник управляемых матриц моделей на витрину (заголовок версии). */
export const showcaseMatrixDefs = pgTable(
  "showcase_matrix_defs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Синхронизировать с `ClientCategoryId` в `client/src/lib/client-category.ts`. */
    clientCategory: text("client_category").notNull(),
    scopeKind: text("scope_kind").notNull(),
    scopeRegion: text("scope_region"),
    scopeCity: text("scope_city"),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    seasonLabel: text("season_label"),
    status: text("status").notNull().default("draft"),
    title: text("title"),
    comment: text("comment"),
    clientOpId: text("client_op_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    updatedBy: uuid("updated_by").references(() => authUsers.id),
    updatedByName: text("updated_by_name"),
  },
  (t) => [
    uniqueIndex("uq_showcase_matrix_defs_client_op")
      .on(t.clientOpId)
      .where(sql`${t.clientOpId} IS NOT NULL`),
    index("idx_showcase_matrix_defs_resolve").on(
      t.clientCategory,
      t.scopeKind,
      t.scopeRegion,
      t.scopeCity,
      t.status,
    ),
    index("idx_showcase_matrix_defs_period").on(t.effectiveFrom, t.effectiveTo),
  ],
);

/** Промт 159: позиции справочника матрицы (состав моделей). */
export const showcaseMatrixDefModels = pgTable(
  "showcase_matrix_def_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    defId: uuid("def_id")
      .notNull()
      .references(() => showcaseMatrixDefs.id, { onDelete: "cascade" }),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    priority: text("priority").notNull().default("medium"),
    segment: text("segment").notNull(),
    valueWeight: integer("value_weight"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_smdm_def").on(t.defId),
    uniqueIndex("uq_smdm_def_target").on(t.defId, t.targetKind, t.targetId),
  ],
);
