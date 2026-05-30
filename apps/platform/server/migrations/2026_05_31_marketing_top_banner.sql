-- Prompt 112: category on briefs + view tracking for top carousel

ALTER TABLE marketing_briefs
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'brief'
  CHECK (category IN ('brief', 'promo', 'info'));

CREATE INDEX IF NOT EXISTS idx_marketing_briefs_category ON marketing_briefs (category);

CREATE TABLE IF NOT EXISTS user_brief_views (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brief_id UUID NOT NULL REFERENCES marketing_briefs(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, brief_id)
);

CREATE INDEX IF NOT EXISTS idx_user_brief_views_brief ON user_brief_views (brief_id);
CREATE INDEX IF NOT EXISTS idx_user_brief_views_user ON user_brief_views (user_id);
