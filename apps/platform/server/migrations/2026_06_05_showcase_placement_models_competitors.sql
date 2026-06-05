-- Промт 190: блоки размещения — наши модели (список) + конкуренты (список).
-- JSONB-поля на placement-entry. Обратносовместимо: старые блоки = NULL.

ALTER TABLE showcase_matrix_entries
  ADD COLUMN IF NOT EXISTS placement_our_models JSONB,
  ADD COLUMN IF NOT EXISTS placement_competitors JSONB;

ALTER TABLE showcase_matrix_events
  ADD COLUMN IF NOT EXISTS placement_our_models JSONB,
  ADD COLUMN IF NOT EXISTS placement_competitors JSONB;

-- Структура (валидируется на уровне приложения, не БД):
--   placement_our_models:  [{ "modelId": "<catalog-id>", "count": <int>=1> }, ...]
--   placement_competitors: [{ "brand": "<text>", "count": <int>=1> }, ...]
