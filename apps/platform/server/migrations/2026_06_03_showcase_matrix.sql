-- Промт 150: Дистрибуция — витринная матрица позиций по торговым точкам.

CREATE TABLE IF NOT EXISTS showcase_matrix_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id TEXT NOT NULL,
  trade_point_id TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('model','variant')),
  target_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('need_install','installed','postponed','not_relevant')),
  comment TEXT,
  client_op_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  updated_by_name TEXT
);

-- Одна актуальная запись на (точка, цель). Используется для UPSERT по уникальному ключу.
CREATE UNIQUE INDEX IF NOT EXISTS uq_showcase_matrix_entry
  ON showcase_matrix_entries (trade_point_id, target_kind, target_id);

-- Чтение матрицы по точке и по клиенту.
CREATE INDEX IF NOT EXISTS idx_showcase_matrix_tp
  ON showcase_matrix_entries (trade_point_id);
CREATE INDEX IF NOT EXISTS idx_showcase_matrix_dealer
  ON showcase_matrix_entries (dealer_id);

-- Идемпотентность оффлайн-операций (защита от дублей при batch-sync).
CREATE UNIQUE INDEX IF NOT EXISTS uq_showcase_matrix_client_op
  ON showcase_matrix_entries (client_op_id) WHERE client_op_id IS NOT NULL;

-- История изменений (аудит для РОП/директора).
CREATE TABLE IF NOT EXISTS showcase_matrix_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID,
  dealer_id TEXT NOT NULL,
  trade_point_id TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  comment TEXT,
  changed_by UUID REFERENCES users(id),
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_showcase_matrix_events_tp
  ON showcase_matrix_events (trade_point_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_showcase_matrix_events_dealer
  ON showcase_matrix_events (dealer_id, changed_at DESC);
