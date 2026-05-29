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
