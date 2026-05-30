-- Prompt 113: dealer & trade-point overrides (single source of truth over Bitrix)

CREATE TABLE IF NOT EXISTS dealer_overrides (
  dealer_id TEXT PRIMARY KEY,
  name TEXT,
  city TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  general_comment TEXT,
  client_category TEXT,
  trashed_at TIMESTAMPTZ,
  trashed_by UUID REFERENCES users(id),
  unloading_order TEXT,
  regional_manager_id UUID REFERENCES users(id),
  regional_manager_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS dealer_override_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dealer_override_events_dealer ON dealer_override_events (dealer_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS dealer_training_state (
  dealer_id TEXT PRIMARY KEY,
  product_training_done BOOLEAN NOT NULL DEFAULT FALSE,
  needs_new_employees_training BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS manual_dealers (
  dealer_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trade_point_overrides (
  tp_id TEXT PRIMARY KEY,
  dealer_id TEXT,
  name TEXT,
  city TEXT,
  address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  comment TEXT,
  showcase_status TEXT,
  shipment_days TEXT,
  is_main_warehouse BOOLEAN,
  is_hardware_warehouse BOOLEAN,
  trashed_at TIMESTAMPTZ,
  trashed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_trade_point_overrides_dealer ON trade_point_overrides (dealer_id);

CREATE TABLE IF NOT EXISTS trade_point_override_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tp_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trade_point_override_events_tp ON trade_point_override_events (tp_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS trade_point_training_state (
  tp_id TEXT PRIMARY KEY,
  product_training_done BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);
