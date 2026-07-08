-- Bitrix orders from wto1c_orders.xml (orders11.xml) — snapshot tables + sync log

CREATE TABLE IF NOT EXISTS bitrix_orders_snapshot (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bitrix_order_id     TEXT NOT NULL,
  order_number        TEXT NOT NULL,
  site_id             TEXT,
  client_uuid         TEXT,
  client_number_1c    TEXT,
  store_uuid          UUID,
  legal_uuid          UUID,
  manager_uuid        UUID,
  status              TEXT NOT NULL,
  delivery_type       TEXT,
  delivery_address    TEXT,
  payment_method      TEXT,
  payment_percent     NUMERIC(6, 2),
  total_with_discount NUMERIC(14, 2),
  total_discount      NUMERIC(14, 2),
  created_at_bitrix   TIMESTAMPTZ,
  raw_payload         JSONB NOT NULL,
  source_file         TEXT,
  imported_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bitrix_orders_snapshot_bitrix_order_id_key UNIQUE (bitrix_order_id),
  CONSTRAINT bitrix_orders_snapshot_store_uuid_fkey
    FOREIGN KEY (store_uuid) REFERENCES exchange_stores_raw(id_1c) ON DELETE SET NULL,
  CONSTRAINT bitrix_orders_snapshot_legal_uuid_fkey
    FOREIGN KEY (legal_uuid) REFERENCES exchange_legals_raw(id_1c) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS bitrix_orders_snapshot_client_number_1c_idx
  ON bitrix_orders_snapshot (client_number_1c);
CREATE INDEX IF NOT EXISTS bitrix_orders_snapshot_store_uuid_idx
  ON bitrix_orders_snapshot (store_uuid);
CREATE INDEX IF NOT EXISTS bitrix_orders_snapshot_legal_uuid_idx
  ON bitrix_orders_snapshot (legal_uuid);
CREATE INDEX IF NOT EXISTS bitrix_orders_snapshot_manager_uuid_idx
  ON bitrix_orders_snapshot (manager_uuid);
CREATE INDEX IF NOT EXISTS bitrix_orders_snapshot_status_idx
  ON bitrix_orders_snapshot (status);
CREATE INDEX IF NOT EXISTS bitrix_orders_snapshot_created_at_bitrix_idx
  ON bitrix_orders_snapshot (created_at_bitrix DESC);

CREATE TABLE IF NOT EXISTS bitrix_order_items_snapshot (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL,
  line_no                 INTEGER NOT NULL,
  product_xml_id          TEXT NOT NULL,
  product_id              UUID,
  product_name_1c         TEXT,
  quantity                NUMERIC(14, 3) NOT NULL,
  discount_per_item       NUMERIC(14, 2),
  price_no_discount       NUMERIC(14, 2),
  discount_id             TEXT,
  product_id_1c_internal  TEXT,
  price_type_uuid         TEXT,
  supply_variant          TEXT,
  supply_date             TIMESTAMPTZ,
  CONSTRAINT bitrix_order_items_snapshot_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES bitrix_orders_snapshot(id) ON DELETE CASCADE,
  CONSTRAINT bitrix_order_items_snapshot_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS bitrix_order_items_snapshot_order_id_idx
  ON bitrix_order_items_snapshot (order_id);
CREATE INDEX IF NOT EXISTS bitrix_order_items_snapshot_product_id_idx
  ON bitrix_order_items_snapshot (product_id);
CREATE INDEX IF NOT EXISTS bitrix_order_items_snapshot_product_xml_id_idx
  ON bitrix_order_items_snapshot (product_xml_id);

CREATE TABLE IF NOT EXISTS bitrix_orders_sync_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at          TIMESTAMPTZ,
  source               TEXT NOT NULL,
  source_file          TEXT,
  orders_seen          INTEGER NOT NULL DEFAULT 0,
  orders_upserted      INTEGER NOT NULL DEFAULT 0,
  orders_matched_store INTEGER NOT NULL DEFAULT 0,
  orders_unmatched     INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'ok',
  message              TEXT,
  duration_ms          INTEGER
);

CREATE INDEX IF NOT EXISTS bitrix_orders_sync_log_started_at_idx
  ON bitrix_orders_sync_log (started_at DESC);
