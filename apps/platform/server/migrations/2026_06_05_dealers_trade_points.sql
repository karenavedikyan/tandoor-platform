-- Промт 348: База дилеров и торговых точек (server P1, без переключения UI).

CREATE TABLE IF NOT EXISTS dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  release_code TEXT,
  city TEXT,
  region TEXT,
  client_type TEXT,
  client_category TEXT,
  status TEXT,
  format TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_priority BOOLEAN NOT NULL DEFAULT FALSE,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  legal_entity TEXT,
  holding TEXT,
  comment TEXT,
  manager_name TEXT,
  release_address TEXT,
  client_type_label TEXT,
  release_team_id TEXT,
  release_manager_id TEXT,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'release-seed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dealers_release_team ON dealers (release_team_id);
CREATE INDEX IF NOT EXISTS idx_dealers_release_manager ON dealers (release_manager_id);
CREATE INDEX IF NOT EXISTS idx_dealers_city ON dealers (city);

CREATE TABLE IF NOT EXISTS trade_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key TEXT NOT NULL UNIQUE,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  address TEXT,
  format TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  importance_tier TEXT,
  source TEXT NOT NULL DEFAULT 'release-seed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_points_dealer ON trade_points (dealer_id);
CREATE INDEX IF NOT EXISTS idx_trade_points_external_key ON trade_points (external_key);
