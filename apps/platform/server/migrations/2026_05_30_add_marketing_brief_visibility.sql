-- Промт 110.1: уровень доступа брифа (private / public)
ALTER TABLE marketing_briefs
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'public'));
