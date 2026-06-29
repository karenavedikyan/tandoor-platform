-- Неактуальные (снятые с производства) наши витрины — счётчик на placement-блок.
-- Источник потенциала под ротацию. Обратносовместимо: старые блоки = NULL (=0).
ALTER TABLE showcase_matrix_entries
  ADD COLUMN IF NOT EXISTS placement_legacy_ours INTEGER;

ALTER TABLE showcase_matrix_events
  ADD COLUMN IF NOT EXISTS placement_legacy_ours INTEGER;
