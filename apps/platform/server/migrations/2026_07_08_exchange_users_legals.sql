-- Shadow: сотрудники 1С (employers1.xml).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS exchange_users_raw (
  id_1c UUID PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  source_file TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exch_users_name_trgm
  ON exchange_users_raw USING gin (name gin_trgm_ops);

-- Shadow: юрлица/контрагенты 1С (users1.xml).
CREATE TABLE IF NOT EXISTS exchange_legals_raw (
  id_1c UUID PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  inn TEXT,
  kpp TEXT,
  ogrn TEXT,
  ma_number TEXT,
  payment_form TEXT,
  region TEXT,
  city TEXT,
  client_type TEXT,
  phone TEXT,
  email TEXT,
  discount_code TEXT,
  discount_percent NUMERIC,
  regional_manager_1c UUID,
  regional_manager_name TEXT,
  responsible_manager_1c UUID,
  responsible_manager_name TEXT,
  furniture_manager_1c UUID,
  furniture_manager_name TEXT,
  furniture_manager_phone TEXT,
  parent_1c UUID,
  plan_retro_bonus TEXT,
  plan_sum NUMERIC,
  source_file TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exch_legals_inn ON exchange_legals_raw (inn);
CREATE INDEX IF NOT EXISTS idx_exch_legals_parent ON exchange_legals_raw (parent_1c);
CREATE INDEX IF NOT EXISTS idx_exch_legals_region ON exchange_legals_raw (region);
CREATE INDEX IF NOT EXISTS idx_exch_legals_type ON exchange_legals_raw (client_type);
CREATE INDEX IF NOT EXISTS idx_exch_legals_regional_mgr ON exchange_legals_raw (regional_manager_1c);
CREATE INDEX IF NOT EXISTS idx_exch_legals_responsible_mgr ON exchange_legals_raw (responsible_manager_1c);
CREATE INDEX IF NOT EXISTS idx_exch_legals_name_trgm ON exchange_legals_raw USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_exch_legals_legal_name_trgm ON exchange_legals_raw USING gin (legal_name gin_trgm_ops);
