-- Prevent duplicate active legal_entities per client + normalized name (Prompt 270).
-- Relies on 2026_06_10_dedup_legal_entities.sql having collapsed existing dup rows.

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_entities_client_normname_active
ON legal_entities (client_id, lower(btrim(name)))
WHERE is_archived = false;
