-- Shadow-таблица: сырые торговые точки из 1С. Боевые таблицы не трогаем.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS exchange_stores_raw (
  id_1c UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  legal_entity_1c UUID,
  manager_1c UUID,
  manager_name TEXT,
  manager_phone TEXT,
  source_file TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'linked', 'ignored', 'created')),
  linked_trade_point_id UUID REFERENCES trade_points(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ,
  linked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exch_stores_status ON exchange_stores_raw (status);
CREATE INDEX IF NOT EXISTS idx_exch_stores_legal ON exchange_stores_raw (legal_entity_1c);
CREATE INDEX IF NOT EXISTS idx_exch_stores_manager ON exchange_stores_raw (manager_1c);
CREATE INDEX IF NOT EXISTS idx_exch_stores_linked_tp ON exchange_stores_raw (linked_trade_point_id);
CREATE INDEX IF NOT EXISTS idx_exch_stores_name_trgm ON exchange_stores_raw USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_exch_stores_address_trgm ON exchange_stores_raw USING gin (address gin_trgm_ops);
