/**
 * Admin: применить DDL маркетинговых брифов к Neon и Yandex (Промт 104.1).
 * POST /api/admin/migrate-marketing-briefs
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  isDualMigrateSuccess,
  runOnNeon,
  runOnYandex,
} from "../../shared/dual-db-migrate.js";

const STMTS: string[] = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  `CREATE TABLE IF NOT EXISTS marketing_briefs (
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
   )`,
  `CREATE INDEX IF NOT EXISTS idx_marketing_briefs_status ON marketing_briefs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_marketing_briefs_period ON marketing_briefs(period_label)`,

  `CREATE TABLE IF NOT EXISTS marketing_brief_revisions (
     id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     brief_id        uuid        NOT NULL REFERENCES marketing_briefs(id) ON DELETE CASCADE,
     action          text        NOT NULL,
     actor_user_id   uuid        NULL REFERENCES users(id) ON DELETE SET NULL,
     payload         jsonb       NULL,
     created_at      timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_marketing_brief_revisions_brief ON marketing_brief_revisions(brief_id)`,

  `CREATE TABLE IF NOT EXISTS marketing_brief_blocks (
     id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     brief_id        uuid        NOT NULL REFERENCES marketing_briefs(id) ON DELETE CASCADE,
     order_index     integer     NOT NULL,
     type            text        NOT NULL,
     payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
     created_at      timestamptz NOT NULL DEFAULT now(),
     updated_at      timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_marketing_brief_blocks_brief ON marketing_brief_blocks(brief_id, order_index)`,
];

const EXPECTED_TABLES = ["marketing_briefs", "marketing_brief_revisions", "marketing_brief_blocks"];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
      return;
    }
    if (!enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (me.role !== "admin") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для администратора." });
      return;
    }

    const neonRes = await runOnNeon(STMTS, EXPECTED_TABLES);
    const yandexRes = await runOnYandex(STMTS, EXPECTED_TABLES);

    const ok = isDualMigrateSuccess(neonRes, yandexRes, EXPECTED_TABLES);

    sendJson(res, 200, {
      success: ok,
      neon: neonRes,
      yandex: yandexRes,
      expected_tables: EXPECTED_TABLES,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[migrate-marketing-briefs]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
