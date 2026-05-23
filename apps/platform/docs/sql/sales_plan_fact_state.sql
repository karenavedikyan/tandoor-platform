-- Таблица для серверного хранения план-факта продаж (организационный документ).
-- Выполнить вручную при включённом Postgres:
--   psql "$DATABASE_URL" -f apps/platform/docs/sql/sales_plan_fact_state.sql

CREATE TABLE IF NOT EXISTS sales_plan_fact_state (
  scope_key text PRIMARY KEY,
  state jsonb NOT NULL,
  version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_plan_fact_updated_at ON sales_plan_fact_state (updated_at);
