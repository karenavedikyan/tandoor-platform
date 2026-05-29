-- Маркетинговые брифы (Промт 102 — фундамент).
-- Таблицы блоков добавим в Промте 103, но id-бриф уже готов как FK.

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
