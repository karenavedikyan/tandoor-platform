-- Промт 114: маршруты отгрузки (города по дню недели), per-user.

CREATE TABLE IF NOT EXISTS dealer_shipment_routes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  day_id TEXT NOT NULL CHECK (day_id IN ('monday','tuesday','wednesday','thursday','friday','saturday')),
  name TEXT NOT NULL DEFAULT '',
  cities JSONB NOT NULL DEFAULT '[]'::jsonb,
  trashed_at TIMESTAMPTZ NULL,
  trashed_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NULL
);

CREATE INDEX IF NOT EXISTS dealer_shipment_routes_user_day_idx
  ON dealer_shipment_routes(user_id, day_id) WHERE trashed_at IS NULL;
