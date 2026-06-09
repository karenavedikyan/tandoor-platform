-- Промт 246: Экран «Задачи» — мягкий архив заданий + тред комментариев (создатель и исполнитель).
-- Идемпотентно (IF NOT EXISTS), безопасно к повторному запуску.

-- 1) Мягкий архив заданий на отгрузку/витрину.
ALTER TABLE showcase_install_assignments
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE showcase_install_assignments
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

-- Частичный индекс: быстрый выбор неархивных заданий (обычный режим списка).
CREATE INDEX IF NOT EXISTS idx_install_assignments_active
  ON showcase_install_assignments (created_at DESC)
  WHERE is_archived = false;

-- 2) Комментарии к заданию (тред обсуждения; пишут и создатель, и исполнитель).
CREATE TABLE IF NOT EXISTS showcase_install_assignment_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL
    REFERENCES showcase_install_assignments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  author_name TEXT,
  author_role TEXT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_install_assignment_comments_assignment
  ON showcase_install_assignment_comments (assignment_id, created_at ASC);
