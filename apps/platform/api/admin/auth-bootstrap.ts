/**
 * ОДНОРАЗОВАЯ Vercel-функция: применить auth-schema и создать первого admin.
 *
 * Self-contained: импорты только `@vercel/node`, `@neondatabase/serverless`, `bcryptjs`, `node:crypto`
 * (см. `docs/auth-access-foundation.md`, paттерн `api/auth/[action].ts`).
 *
 * УДАЛИТЬ из репозитория сразу после успешного запуска (отдельный revert-PR).
 * Защита: заголовок `X-Bootstrap-Token` обязан совпадать с `process.env.BOOTSTRAP_TOKEN`
 * (timing-safe compare). Без этой env-переменной endpoint всегда возвращает 503.
 *
 * Контракт:
 *   POST /api/admin/auth-bootstrap?op=db-push
 *     headers: X-Bootstrap-Token: <token>
 *     → 200 { success:true, applied:[...], skipped:[...] }
 *
 *   POST /api/admin/auth-bootstrap?op=seed-admin
 *     headers: X-Bootstrap-Token: <token>
 *     body: { email, password, fullName }
 *     → 200 { success:true, user: { id, email, role, status } }
 *
 *   GET /api/admin/auth-bootstrap → 200 { ready:true, hasToken:boolean } (без secret)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";

const JSON_CT = "application/json; charset=utf-8";

type SqlExec = ReturnType<typeof neon>;

let cachedSql: SqlExec | null = null;
function getSql(): SqlExec | null {
  if (cachedSql) return cachedSql;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  cachedSql = neon(url);
  return cachedSql;
}

/**
 * Run a raw SQL string (no params).
 *
 * `neon(url)` returns a callable: when invoked as an ordinary function with a string + params array,
 * it executes that SQL over HTTPS (see `NeonQueryFunction` overload in @neondatabase/serverless).
 */
async function runRaw(sql: SqlExec, statement: string): Promise<unknown> {
  return await (sql as unknown as (s: string, p?: unknown[]) => Promise<unknown>)(statement);
}

/** Run a parametrised SQL — returns row array (default `fullResults: false`). */
async function runParams<T = Record<string, unknown>>(sql: SqlExec, statement: string, params: unknown[]): Promise<T[]> {
  const res = await (sql as unknown as (s: string, p: unknown[]) => Promise<unknown>)(statement, params);
  return res as T[];
}

function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.setHeader("Content-Type", JSON_CT);
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function constantTimeStringEq(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function checkAuth(req: VercelRequest): { ok: true } | { ok: false; status: number; code: string; message: string } {
  const expected = process.env.BOOTSTRAP_TOKEN?.trim();
  if (!expected) {
    return { ok: false, status: 503, code: "BOOTSTRAP_DISABLED", message: "BOOTSTRAP_TOKEN env not set" };
  }
  const provided = req.headers["x-bootstrap-token"];
  const token = typeof provided === "string" ? provided.trim() : "";
  if (!token || !constantTimeStringEq(expected, token)) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Invalid bootstrap token" };
  }
  return { ok: true };
}

/**
 * DDL statements (idempotent via IF NOT EXISTS).
 * Generated from drizzle-kit on `shared/auth-schema.ts` (commit 65a9a16),
 * adapted to IF NOT EXISTS so the endpoint is safely re-runnable.
 */
const DDL_STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "table:audit_log",
    sql: `CREATE TABLE IF NOT EXISTS "audit_log" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "actor_user_id" uuid,
      "action" text NOT NULL,
      "entity_type" text NOT NULL,
      "entity_id" text NOT NULL,
      "metadata" jsonb,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "table:users",
    sql: `CREATE TABLE IF NOT EXISTS "users" (
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
      CONSTRAINT "users_email_unique" UNIQUE("email")
    )`,
  },
  {
    name: "table:invitations",
    sql: `CREATE TABLE IF NOT EXISTS "invitations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "email" text NOT NULL,
      "role" text NOT NULL,
      "team_id" uuid,
      "invited_by" uuid NOT NULL,
      "token_hash" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "accepted_at" timestamp with time zone
    )`,
  },
  {
    name: "table:regions",
    sql: `CREATE TABLE IF NOT EXISTS "regions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL
    )`,
  },
  {
    name: "table:sessions",
    sql: `CREATE TABLE IF NOT EXISTS "sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL,
      "refresh_token_hash" text NOT NULL,
      "user_agent" text,
      "ip" text,
      "expires_at" timestamp with time zone NOT NULL,
      "revoked_at" timestamp with time zone
    )`,
  },
  {
    name: "table:teams",
    sql: `CREATE TABLE IF NOT EXISTS "teams" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "rop_user_id" uuid
    )`,
  },
  {
    name: "table:user_region_scopes",
    sql: `CREATE TABLE IF NOT EXISTS "user_region_scopes" (
      "user_id" uuid NOT NULL,
      "region_id" uuid NOT NULL,
      CONSTRAINT "user_region_scopes_user_id_region_id_pk" PRIMARY KEY("user_id","region_id")
    )`,
  },
  {
    name: "table:user_team_memberships",
    sql: `CREATE TABLE IF NOT EXISTS "user_team_memberships" (
      "user_id" uuid NOT NULL,
      "team_id" uuid NOT NULL,
      "role_in_team" text NOT NULL,
      CONSTRAINT "user_team_memberships_user_id_team_id_pk" PRIMARY KEY("user_id","team_id")
    )`,
  },
  // Foreign keys (use DO block to add only if missing — Postgres has no IF NOT EXISTS for ADD CONSTRAINT)
  {
    name: "fk:audit_log.actor_user_id",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'audit_log_actor_user_id_users_id_fk') THEN
        ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
      END IF;
    END $$`,
  },
  {
    name: "fk:users.created_by",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_created_by_users_id_fk') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
      END IF;
    END $$`,
  },
  {
    name: "fk:invitations.team_id",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'invitations_team_id_teams_id_fk') THEN
        ALTER TABLE "invitations" ADD CONSTRAINT "invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
      END IF;
    END $$`,
  },
  {
    name: "fk:invitations.invited_by",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'invitations_invited_by_users_id_fk') THEN
        ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
      END IF;
    END $$`,
  },
  {
    name: "fk:sessions.user_id",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sessions_user_id_users_id_fk') THEN
        ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$`,
  },
  {
    name: "fk:teams.rop_user_id",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'teams_rop_user_id_users_id_fk') THEN
        ALTER TABLE "teams" ADD CONSTRAINT "teams_rop_user_id_users_id_fk" FOREIGN KEY ("rop_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
      END IF;
    END $$`,
  },
  {
    name: "fk:user_region_scopes.user_id",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_region_scopes_user_id_users_id_fk') THEN
        ALTER TABLE "user_region_scopes" ADD CONSTRAINT "user_region_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$`,
  },
  {
    name: "fk:user_region_scopes.region_id",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_region_scopes_region_id_regions_id_fk') THEN
        ALTER TABLE "user_region_scopes" ADD CONSTRAINT "user_region_scopes_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$`,
  },
  {
    name: "fk:user_team_memberships.user_id",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_team_memberships_user_id_users_id_fk') THEN
        ALTER TABLE "user_team_memberships" ADD CONSTRAINT "user_team_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$`,
  },
  {
    name: "fk:user_team_memberships.team_id",
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_team_memberships_team_id_teams_id_fk') THEN
        ALTER TABLE "user_team_memberships" ADD CONSTRAINT "user_team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$`,
  },
];

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleDbPush(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const sql = getSql();
  if (!sql) {
    sendJson(res, 500, { success: false, code: "NO_DB", message: "DATABASE_URL is not set" });
    return;
  }
  const applied: string[] = [];
  const errors: { name: string; error: string }[] = [];
  for (const stmt of DDL_STATEMENTS) {
    try {
      await runRaw(sql, stmt.sql);
      applied.push(stmt.name);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push({ name: stmt.name, error: m.slice(0, 300) });
    }
  }
  // Verify final state — list all tables that exist
  let tablesPresent: string[] = [];
  try {
    const rows = await runParams<{ table_name: string }>(
      sql,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users','sessions','audit_log','invitations','teams','regions','user_team_memberships','user_region_scopes') ORDER BY table_name`,
      [],
    );
    tablesPresent = rows.map((r) => r.table_name);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    errors.push({ name: "verify", error: m.slice(0, 300) });
  }
  sendJson(res, errors.length === 0 ? 200 : 207, {
    success: errors.length === 0,
    applied,
    errors,
    tablesPresent,
  });
}

async function handleSeedAdmin(req: VercelRequest, res: VercelResponse): Promise<void> {
  const sql = getSql();
  if (!sql) {
    sendJson(res, 500, { success: false, code: "NO_DB", message: "DATABASE_URL is not set" });
    return;
  }
  const body = (req.body ?? {}) as { email?: unknown; password?: unknown; fullName?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" && body.fullName.trim() ? body.fullName.trim() : "Администратор";

  if (!email || !SIMPLE_EMAIL_RE.test(email)) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Invalid email" });
    return;
  }
  if (!password || password.length < 8) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Password must be >= 8 chars" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const rows = await runParams<{ id: string; email: string; role: string; status: string }>(
    sql,
    `INSERT INTO users (email, full_name, role, status, password_hash, must_change_password, created_by)
     VALUES ($1, $2, 'admin', 'active', $3, false, NULL)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = 'admin',
       status = 'active',
       must_change_password = false,
       full_name = EXCLUDED.full_name,
       updated_at = NOW()
     RETURNING id, email, role, status`,
    [email, fullName, passwordHash],
  );
  sendJson(res, 200, { success: true, user: rows[0] });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method === "GET") {
      sendJson(res, 200, {
        ready: true,
        hasToken: Boolean(process.env.BOOTSTRAP_TOKEN?.trim()),
        hasDb: Boolean(process.env.DATABASE_URL?.trim()),
      });
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }

    const auth = checkAuth(req);
    if (!auth.ok) {
      sendJson(res, auth.status, { success: false, code: auth.code, message: auth.message });
      return;
    }

    const op = typeof req.query?.op === "string" ? req.query.op : Array.isArray(req.query?.op) ? req.query.op[0] : "";

    if (op === "db-push") {
      await handleDbPush(req, res);
      return;
    }
    if (op === "seed-admin") {
      await handleSeedAdmin(req, res);
      return;
    }

    sendJson(res, 400, { success: false, code: "UNKNOWN_OP", message: "op must be db-push or seed-admin" });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[auth-bootstrap]", m.slice(0, 300));
    if (!res.headersSent) {
      sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m.slice(0, 300) });
    }
  }
}
