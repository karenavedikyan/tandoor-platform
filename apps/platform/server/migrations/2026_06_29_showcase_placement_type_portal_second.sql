-- Фича «2-й план» для МК-порталов: добавляем тип размещения 'portal_second'.
-- Расширяем CHECK на placement_type (значение хранится в существующей колонке, новых колонок нет).
ALTER TABLE showcase_matrix_entries
  DROP CONSTRAINT IF EXISTS showcase_matrix_placement_type_check;
ALTER TABLE showcase_matrix_entries
  ADD CONSTRAINT showcase_matrix_placement_type_check
  CHECK (placement_type IS NULL OR placement_type IN
    ('portal','cube','book','hoof','unmounted','branded_stand','stream_sku','portal_second'));
