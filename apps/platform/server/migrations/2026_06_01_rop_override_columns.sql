-- Prompt 115: ROP columns on dealer/trade-point overrides; RM columns on trade_point_overrides

ALTER TABLE dealer_overrides
  ADD COLUMN IF NOT EXISTS rop_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rop_name TEXT;

ALTER TABLE trade_point_overrides
  ADD COLUMN IF NOT EXISTS rop_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rop_name TEXT,
  ADD COLUMN IF NOT EXISTS regional_manager_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS regional_manager_name TEXT;
