-- Промт 417: единая модель статуса записи (active / in_trash / pending_admin / purged)

DO $$ BEGIN
  CREATE TYPE record_status AS ENUM ('active', 'in_trash', 'pending_admin', 'purged');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE dealer_overrides
  ADD COLUMN IF NOT EXISTS status record_status NOT NULL DEFAULT 'active';

ALTER TABLE trade_point_overrides
  ADD COLUMN IF NOT EXISTS status record_status NOT NULL DEFAULT 'active';

UPDATE dealer_overrides SET status =
  CASE
    WHEN purged_at IS NOT NULL          THEN 'purged'::record_status
    WHEN purge_requested_at IS NOT NULL THEN 'pending_admin'::record_status
    WHEN trashed_at IS NOT NULL         THEN 'in_trash'::record_status
    ELSE 'active'::record_status
  END;

UPDATE trade_point_overrides SET status =
  CASE
    WHEN purged_at IS NOT NULL          THEN 'purged'::record_status
    WHEN purge_requested_at IS NOT NULL THEN 'pending_admin'::record_status
    WHEN trashed_at IS NOT NULL         THEN 'in_trash'::record_status
    ELSE 'active'::record_status
  END;

CREATE INDEX IF NOT EXISTS dealer_overrides_status_idx ON dealer_overrides(status);
CREATE INDEX IF NOT EXISTS trade_point_overrides_status_idx ON trade_point_overrides(status);
