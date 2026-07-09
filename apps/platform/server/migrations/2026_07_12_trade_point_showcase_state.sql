CREATE TABLE IF NOT EXISTS trade_point_showcase_state (
  trade_point_id text PRIMARY KEY,
  dealer_id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL,
  updated_by_name text
);
CREATE INDEX IF NOT EXISTS idx_tp_showcase_state_dealer ON trade_point_showcase_state (dealer_id);
CREATE INDEX IF NOT EXISTS idx_tp_showcase_state_updated_at ON trade_point_showcase_state (updated_at);
