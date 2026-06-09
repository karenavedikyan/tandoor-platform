-- Промт 230a: доказательства выполнения по позициям задания + система уведомлений.
--
-- 1) Позиции задания (showcase_install_assignment_items): статус позиции, причина проблемы,
--    фото-доказательство (к конкретной модели), дата отгрузки.
-- 2) Задание (showcase_install_assignments): общая дата отгрузки (комбинированный уровень —
--    фото к модели, дата/комментарий к заданию).
-- 3) Таблица уведомлений (app_notifications) — полноценный «колокольчик» со счётчиком непрочитанных.

-- ── Позиции: статус, проблема, фото, дата ────────────────────────────────────
ALTER TABLE showcase_install_assignment_items
  ADD COLUMN IF NOT EXISTS item_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (item_status IN ('pending','shipped','installed','problem')),
  ADD COLUMN IF NOT EXISTS problem_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS photo_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS photo_thumb_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS shipped_date DATE NULL;

-- Бэкофилл из существующих булевых флагов (done/verified), чтобы старые задания согласовались.
UPDATE showcase_install_assignment_items
  SET item_status = CASE
    WHEN verified THEN 'installed'
    WHEN done THEN 'shipped'
    ELSE 'pending'
  END
  WHERE item_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_install_assignment_items_status
  ON showcase_install_assignment_items (assignment_id, item_status);

-- ── Задание: общая дата отгрузки (комбинированный уровень доказательств) ──────
ALTER TABLE showcase_install_assignments
  ADD COLUMN IF NOT EXISTS shipped_date DATE NULL;

-- ── Уведомления (полноценный колокольчик) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- assignment_created | assignment_submitted | assignment_verified | assignment_problem | assignment_followup
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NULL,
  -- Куда вести при клике, например #/assignment/<id>.
  link TEXT NULL,
  entity_kind TEXT NULL,   -- 'assignment'
  entity_id TEXT NULL,     -- id задания
  actor_id UUID REFERENCES users(id),
  actor_name TEXT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_unread
  ON app_notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
  ON app_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_entity
  ON app_notifications (entity_kind, entity_id);
