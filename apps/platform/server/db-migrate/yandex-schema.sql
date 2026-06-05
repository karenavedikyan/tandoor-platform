-- Generated from drizzle auth-schema + platform migrations (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "auth_login_failures" (
	"email_lower" text PRIMARY KEY NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"password_hash" text,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"telegram_user_id" bigint,
	"onboarding_completed_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_telegram_user_id_unique" UNIQUE("telegram_user_id")
);
CREATE TABLE IF NOT EXISTS "client_assignment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_code" text NOT NULL,
	"from_user_id" uuid,
	"to_user_id" uuid NOT NULL,
	"from_team_id" uuid,
	"to_team_id" uuid,
	"actor_user_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "client_assignments" (
	"client_code" text PRIMARY KEY NOT NULL,
	"responsible_user_id" uuid NOT NULL,
	"team_id" uuid,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"team_id" uuid,
	"invited_by" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "password_reset_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_ip" text
);
CREATE TABLE IF NOT EXISTS "password_reset_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"approver_user_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"reset_link_id" uuid
);
CREATE TABLE IF NOT EXISTS "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"impersonator_user_id" uuid
);
CREATE TABLE IF NOT EXISTS "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rop_user_id" uuid
);
CREATE TABLE IF NOT EXISTS "telegram_link_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "user_region_scopes" (
	"user_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	CONSTRAINT "user_region_scopes_user_id_region_id_pk" PRIMARY KEY("user_id","region_id")
);
CREATE TABLE IF NOT EXISTS "user_team_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_team_id" uuid,
	"to_team_id" uuid,
	"role_in_team" text,
	"actor_user_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "user_team_memberships" (
	"user_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"role_in_team" text NOT NULL,
	CONSTRAINT "user_team_memberships_user_id_team_id_pk" PRIMARY KEY("user_id","team_id")
);
CREATE INDEX IF NOT EXISTS "idx_cah_client_code" ON "client_assignment_history" USING btree ("client_code");
CREATE INDEX IF NOT EXISTS "idx_cah_to_user" ON "client_assignment_history" USING btree ("to_user_id");
CREATE INDEX IF NOT EXISTS "idx_cah_created_at" ON "client_assignment_history" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "idx_client_assignments_user" ON "client_assignments" USING btree ("responsible_user_id");
CREATE INDEX IF NOT EXISTS "idx_client_assignments_team" ON "client_assignments" USING btree ("team_id");
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_links_token_hash_uq" ON "password_reset_links" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "idx_prl_user_active" ON "password_reset_links" USING btree ("user_id") WHERE "password_reset_links"."used_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_prr_approver_pending" ON "password_reset_requests" USING btree ("approver_user_id") WHERE "password_reset_requests"."status" = 'pending';
CREATE INDEX IF NOT EXISTS "idx_prr_requester" ON "password_reset_requests" USING btree ("requester_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "teams_name_unique" ON "teams" USING btree ("name");
CREATE INDEX IF NOT EXISTS "idx_uth_user" ON "user_team_history" USING btree ("user_id");

DO $$ BEGIN
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_assignment_history" ADD CONSTRAINT "client_assignment_history_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_assignment_history" ADD CONSTRAINT "client_assignment_history_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_assignment_history" ADD CONSTRAINT "client_assignment_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_responsible_user_id_users_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "client_assignments" ADD CONSTRAINT "client_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "password_reset_links" ADD CONSTRAINT "password_reset_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "password_reset_links" ADD CONSTRAINT "password_reset_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_reset_link_id_password_reset_links_id_fk" FOREIGN KEY ("reset_link_id") REFERENCES "public"."password_reset_links"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonator_user_id_users_id_fk" FOREIGN KEY ("impersonator_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "teams" ADD CONSTRAINT "teams_rop_user_id_users_id_fk" FOREIGN KEY ("rop_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_region_scopes" ADD CONSTRAINT "user_region_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_region_scopes" ADD CONSTRAINT "user_region_scopes_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_team_history" ADD CONSTRAINT "user_team_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_team_history" ADD CONSTRAINT "user_team_history_from_team_id_teams_id_fk" FOREIGN KEY ("from_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_team_history" ADD CONSTRAINT "user_team_history_to_team_id_teams_id_fk" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_team_history" ADD CONSTRAINT "user_team_history_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_team_memberships" ADD CONSTRAINT "user_team_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_team_memberships" ADD CONSTRAINT "user_team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_user_id_idx ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sessions_impersonator ON sessions(impersonator_user_id) WHERE impersonator_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uth_created_at ON user_team_history(created_at);

-- Application state & domain tables (migrations-run / docs/sql)
CREATE TABLE IF NOT EXISTS client_base_actualization_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  role TEXT,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cb_actualization_user_id ON client_base_actualization_state (user_id);
CREATE INDEX IF NOT EXISTS idx_cb_actualization_updated_at ON client_base_actualization_state (updated_at);

CREATE TABLE IF NOT EXISTS sales_plan_fact_state (
  scope_key TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_plan_fact_updated_at ON sales_plan_fact_state (updated_at);

CREATE TABLE IF NOT EXISTS legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  name TEXT,
  inn TEXT,
  kpp TEXT,
  ogrn TEXT,
  legal_address TEXT,
  payment_form TEXT,
  payment_delay_days INTEGER,
  credit_limit_rub NUMERIC(14, 2),
  edo_enabled BOOLEAN,
  edo_operator TEXT,
  internal_code TEXT,
  entity_type TEXT,
  actual_address TEXT,
  primary_contact TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'additional',
  comment TEXT,
  updated_by_user_id UUID,
  updated_by_name TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_legal_entities_client_id ON legal_entities(client_id);

CREATE TABLE IF NOT EXISTS trade_point_legal_entity_links (
  trade_point_id TEXT NOT NULL,
  legal_entity_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trade_point_id, legal_entity_id)
);
CREATE INDEX IF NOT EXISTS idx_tp_le_links_legal_entity ON trade_point_legal_entity_links(legal_entity_id);

CREATE TABLE IF NOT EXISTS client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('dealer','legal_entity','trade_point')),
  scope_ref TEXT,
  full_name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  whatsapp TEXT,
  telegram TEXT,
  email TEXT,
  comment TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_actual BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'manual',
  delete_requested_at TIMESTAMPTZ,
  delete_request_reason TEXT,
  created_by_user_id UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_client_contacts_client ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS ix_client_contacts_scope ON client_contacts(client_id, scope, scope_ref);

CREATE TABLE IF NOT EXISTS client_contact_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  scope TEXT,
  scope_ref TEXT,
  body TEXT NOT NULL,
  actor_user_id UUID,
  actor_name TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_client_contact_events_client_at ON client_contact_events(client_id, at DESC);
CREATE INDEX IF NOT EXISTS ix_client_contact_events_scope_at ON client_contact_events(client_id, scope, scope_ref, at DESC);

CREATE TABLE IF NOT EXISTS legal_entity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  legal_entity_id UUID,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meta TEXT,
  body TEXT NOT NULL,
  actor_user_id UUID,
  actor_name TEXT
);
CREATE INDEX IF NOT EXISTS ix_legal_entity_events_client ON legal_entity_events(client_id);
CREATE INDEX IF NOT EXISTS ix_legal_entity_events_le ON legal_entity_events(legal_entity_id);

CREATE TABLE IF NOT EXISTS dealer_work_plan (
  user_id UUID NOT NULL,
  dealer_id TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  scheduled_date DATE,
  scheduled_note TEXT,
  scheduled_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, dealer_id)
);
CREATE INDEX IF NOT EXISTS ix_dwp_user ON dealer_work_plan(user_id);
CREATE INDEX IF NOT EXISTS ix_dwp_scheduled ON dealer_work_plan(user_id, scheduled_date) WHERE scheduled_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS client_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('dealer','trade_point')),
  scope_ref TEXT,
  type TEXT NOT NULL DEFAULT 'general',
  body TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_client_comments_client ON client_comments(client_id);
CREATE INDEX IF NOT EXISTS ix_client_comments_scope ON client_comments(client_id, scope, scope_ref);
CREATE INDEX IF NOT EXISTS ix_client_comments_tp ON client_comments(scope_ref) WHERE scope = 'trade_point';

DO $$ BEGIN
  ALTER TABLE trade_point_legal_entity_links ADD CONSTRAINT trade_point_legal_entity_links_legal_entity_id_fkey
    FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Маркетинговые брифы (Промт 102 — фундамент).
CREATE TABLE IF NOT EXISTS marketing_briefs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label    text        NOT NULL,
  title           text        NOT NULL,
  status          text        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
  accent_color    text        NOT NULL DEFAULT '#9ACA3C',
  cover_text      text        NOT NULL DEFAULT '',
  created_by      uuid        NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz NULL,
  archived_at     timestamptz NULL
);
CREATE INDEX IF NOT EXISTS idx_marketing_briefs_status  ON marketing_briefs(status);
CREATE INDEX IF NOT EXISTS idx_marketing_briefs_period  ON marketing_briefs(period_label);

CREATE TABLE IF NOT EXISTS marketing_brief_revisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id        uuid        NOT NULL REFERENCES marketing_briefs(id) ON DELETE CASCADE,
  action          text        NOT NULL,
  actor_user_id   uuid        NULL REFERENCES users(id) ON DELETE SET NULL,
  payload         jsonb       NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_brief_revisions_brief ON marketing_brief_revisions(brief_id);

-- Маркетинговые брифы: блоки конструктора (Промт 104).
CREATE TABLE IF NOT EXISTS marketing_brief_blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id        uuid        NOT NULL REFERENCES marketing_briefs(id) ON DELETE CASCADE,
  order_index     integer     NOT NULL,
  type            text        NOT NULL,
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_brief_blocks_brief
  ON marketing_brief_blocks(brief_id, order_index);

-- ── Витрина / матрица моделей (showcase) ──
CREATE TABLE IF NOT EXISTS "showcase_matrix_defs" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_category text NOT NULL,
  scope_kind text NOT NULL,
  scope_region text, scope_city text,
  effective_from date, effective_to date,
  season_label text,
  status text NOT NULL DEFAULT 'draft',
  title text, comment text, client_op_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_by_name text
);
CREATE TABLE IF NOT EXISTS "showcase_matrix_def_models" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  def_id uuid NOT NULL,
  target_kind text NOT NULL, target_id text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  segment text NOT NULL,
  value_weight integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "showcase_matrix_entries" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id text NOT NULL, trade_point_id text NOT NULL,
  target_kind text NOT NULL, target_id text NOT NULL,
  status text NOT NULL,
  comment text, client_op_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, updated_by_name text,
  placement_type text, placement_segment text,
  placement_capacity integer, placement_actual integer,
  placement_ref text,
  placement_our_models jsonb, placement_competitors jsonb
);
CREATE TABLE IF NOT EXISTS "showcase_matrix_events" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid,
  dealer_id text NOT NULL, trade_point_id text NOT NULL,
  target_kind text NOT NULL, target_id text NOT NULL,
  old_status text, new_status text, comment text,
  changed_by uuid, changed_by_name text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  placement_type text, placement_segment text,
  placement_capacity integer, placement_actual integer,
  placement_ref text,
  placement_our_models jsonb, placement_competitors jsonb
);

