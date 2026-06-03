-- Промт 155: Дистрибуция — типы размещения на витрине (блоки) + сегменты.

-- Новые nullable-поля для блоков размещения. Старые записи (model/variant) не затрагиваются.
ALTER TABLE showcase_matrix_entries
  ADD COLUMN IF NOT EXISTS placement_type TEXT,
  ADD COLUMN IF NOT EXISTS placement_segment TEXT,
  ADD COLUMN IF NOT EXISTS placement_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS placement_actual INTEGER,
  ADD COLUMN IF NOT EXISTS placement_ref TEXT;

-- Снять старый CHECK на target_kind и завести новый, включающий 'placement'.
ALTER TABLE showcase_matrix_entries
  DROP CONSTRAINT IF EXISTS showcase_matrix_entries_target_kind_check;
ALTER TABLE showcase_matrix_entries
  ADD CONSTRAINT showcase_matrix_entries_target_kind_check
  CHECK (target_kind IN ('model','variant','placement'));

-- Валидация типов размещения и сегментов (только когда поля заданы).
ALTER TABLE showcase_matrix_entries
  DROP CONSTRAINT IF EXISTS showcase_matrix_placement_type_check;
ALTER TABLE showcase_matrix_entries
  ADD CONSTRAINT showcase_matrix_placement_type_check
  CHECK (placement_type IS NULL OR placement_type IN
    ('portal','cube','book','hoof','unmounted','branded_stand','stream_sku'));

ALTER TABLE showcase_matrix_entries
  DROP CONSTRAINT IF EXISTS showcase_matrix_placement_segment_check;
ALTER TABLE showcase_matrix_entries
  ADD CONSTRAINT showcase_matrix_placement_segment_check
  CHECK (placement_segment IS NULL OR placement_segment IN ('vh','mk','hardware'));

ALTER TABLE showcase_matrix_entries
  DROP CONSTRAINT IF EXISTS showcase_matrix_placement_counts_check;
ALTER TABLE showcase_matrix_entries
  ADD CONSTRAINT showcase_matrix_placement_counts_check
  CHECK (
    (placement_capacity IS NULL OR placement_capacity >= 0) AND
    (placement_actual IS NULL OR placement_actual >= 0)
  );

-- Поиск блоков по точке (target_kind='placement') и поиск моделей по блоку (placement_ref).
CREATE INDEX IF NOT EXISTS idx_showcase_matrix_placement
  ON showcase_matrix_entries (trade_point_id, placement_segment)
  WHERE target_kind = 'placement';

CREATE INDEX IF NOT EXISTS idx_showcase_matrix_placement_ref
  ON showcase_matrix_entries (placement_ref)
  WHERE placement_ref IS NOT NULL;

-- Те же поля в историю изменений (для аудита блоков).
ALTER TABLE showcase_matrix_events
  ADD COLUMN IF NOT EXISTS placement_type TEXT,
  ADD COLUMN IF NOT EXISTS placement_segment TEXT,
  ADD COLUMN IF NOT EXISTS placement_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS placement_actual INTEGER,
  ADD COLUMN IF NOT EXISTS placement_ref TEXT;
