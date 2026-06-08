-- Промт 228: Задания на отгрузку моделей на витрину.
-- Регионал формирует задание из выбранных моделей (need_install) для ТТ → менеджер выполняет
-- по ссылке (с логином) → отмечает галочками отгруженные позиции → регионал подтверждает «на витрине».

-- Задание (шапка).
CREATE TABLE IF NOT EXISTS showcase_install_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id TEXT NOT NULL,
  trade_point_id TEXT NOT NULL,
  -- open: создано регионалом; in_progress: менеджер начал отмечать; submitted: менеджер завершил;
  -- verified: регионал подтвердил «на витрине»; closed: закрыто без подтверждения / архив.
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','submitted','verified','closed')),
  title TEXT NOT NULL DEFAULT '',
  comment TEXT,
  due_date DATE NULL,
  created_by UUID REFERENCES users(id),
  created_by_name TEXT,
  assignee_user_id UUID REFERENCES users(id),
  assignee_name TEXT,
  submitted_at TIMESTAMPTZ NULL,
  verified_at TIMESTAMPTZ NULL,
  verified_by UUID REFERENCES users(id),
  verified_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_install_assignments_tp
  ON showcase_install_assignments (trade_point_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_install_assignments_dealer
  ON showcase_install_assignments (dealer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_install_assignments_assignee
  ON showcase_install_assignments (assignee_user_id, status) WHERE assignee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_install_assignments_creator
  ON showcase_install_assignments (created_by, status) WHERE created_by IS NOT NULL;

-- Позиции задания (модели). target_kind/target_id согласованы с showcase_matrix_entries.
CREATE TABLE IF NOT EXISTS showcase_install_assignment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES showcase_install_assignments(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('model','variant')),
  target_id TEXT NOT NULL,
  model_name TEXT NOT NULL DEFAULT '',
  -- Менеджер отметил позицию как отгруженную.
  done BOOLEAN NOT NULL DEFAULT FALSE,
  done_at TIMESTAMPTZ NULL,
  done_by UUID REFERENCES users(id),
  done_by_name TEXT,
  -- Регионал подтвердил, что позиция реально стоит на витрине (переводит в installed в матрице).
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Одна позиция (цель) на задание.
CREATE UNIQUE INDEX IF NOT EXISTS uq_install_assignment_item
  ON showcase_install_assignment_items (assignment_id, target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_install_assignment_items_assignment
  ON showcase_install_assignment_items (assignment_id);

-- История событий задания (аудит для регионала/РОПа/директора).
CREATE TABLE IF NOT EXISTS showcase_install_assignment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL,
  kind TEXT NOT NULL,            -- created | item_done | item_undone | submitted | verified | reopened | followup | closed
  target_id TEXT NULL,          -- для item_* событий
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES users(id),
  actor_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_install_assignment_events_assignment
  ON showcase_install_assignment_events (assignment_id, created_at DESC);
