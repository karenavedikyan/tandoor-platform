-- Промт 386: двухуровневая корзина (employee trash → admin queue → soft purge)

ALTER TABLE dealer_overrides
  ADD COLUMN IF NOT EXISTS purge_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_requested_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purged_by UUID REFERENCES users(id);

ALTER TABLE trade_point_overrides
  ADD COLUMN IF NOT EXISTS purge_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_requested_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purged_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_dealer_overrides_purge_requested_at
  ON dealer_overrides(purge_requested_at)
  WHERE purge_requested_at IS NOT NULL AND purged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dealer_overrides_purged_at
  ON dealer_overrides(purged_at)
  WHERE purged_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trade_point_overrides_purge_requested_at
  ON trade_point_overrides(purge_requested_at)
  WHERE purge_requested_at IS NOT NULL AND purged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trade_point_overrides_purged_at
  ON trade_point_overrides(purged_at)
  WHERE purged_at IS NOT NULL;

ALTER TABLE dealer_override_events
  ADD COLUMN IF NOT EXISTS event_kind TEXT NOT NULL DEFAULT 'field_change',
  ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE trade_point_override_events
  ADD COLUMN IF NOT EXISTS event_kind TEXT NOT NULL DEFAULT 'field_change',
  ADD COLUMN IF NOT EXISTS payload JSONB;
