-- Prompt 116: каталог 1С (catalog1.xml) — схема таблиц

-- Разделы (категории) из 1С — древовидная структура через parent_id
CREATE TABLE IF NOT EXISTS catalog_categories (
  id            UUID PRIMARY KEY,
  name          TEXT NOT NULL,
  parent_id     UUID NULL,
  sort_order    INTEGER DEFAULT 0,
  raw           JSONB,
  synced_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT catalog_categories_parent_fk FOREIGN KEY (parent_id)
    REFERENCES catalog_categories(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS catalog_categories_parent_idx ON catalog_categories(parent_id);

-- Группы (товарные группы — отдельная иерархия)
CREATE TABLE IF NOT EXISTS catalog_groups (
  id         UUID PRIMARY KEY,
  parent_id  UUID NULL,
  name       TEXT,
  synced_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS catalog_groups_parent_idx ON catalog_groups(parent_id);

-- Товары
CREATE TABLE IF NOT EXISTS catalog_products (
  id           UUID PRIMARY KEY,
  group_id     UUID NULL,
  name         TEXT NOT NULL,
  active       BOOLEAN DEFAULT TRUE,
  brand        TEXT,
  display_name TEXT,
  is_on_site   BOOLEAN DEFAULT FALSE,
  synced_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS catalog_products_group_idx ON catalog_products(group_id);
CREATE INDEX IF NOT EXISTS catalog_products_active_idx ON catalog_products(active);

-- Свойства товара (key/value)
CREATE TABLE IF NOT EXISTS catalog_product_properties (
  product_id     UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  property_code  UUID NOT NULL,
  name           TEXT NOT NULL,
  value          TEXT,
  PRIMARY KEY (product_id, property_code)
);
CREATE INDEX IF NOT EXISTS catalog_product_properties_name_idx ON catalog_product_properties(name);

-- Связка товара с разделами (many-to-many)
CREATE TABLE IF NOT EXISTS catalog_product_categories (
  product_id   UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL,
  PRIMARY KEY (product_id, category_id)
);
CREATE INDEX IF NOT EXISTS catalog_product_categories_cat_idx ON catalog_product_categories(category_id);

-- Картинки товара
CREATE TABLE IF NOT EXISTS catalog_product_images (
  id          BIGSERIAL PRIMARY KEY,
  product_id  UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  path        TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS catalog_product_images_product_idx ON catalog_product_images(product_id);

-- Склады
CREATE TABLE IF NOT EXISTS catalog_warehouses (
  id        UUID PRIMARY KEY,
  name      TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Остатки на складах
CREATE TABLE IF NOT EXISTS catalog_stocks (
  product_id    UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  warehouse_id  UUID NOT NULL,
  qty           NUMERIC(18,3) DEFAULT 0,
  expected_qty  NUMERIC(18,3) DEFAULT 0,
  synced_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, warehouse_id)
);

-- Типы цен
CREATE TABLE IF NOT EXISTS catalog_price_types (
  id        UUID PRIMARY KEY,
  name      TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Цены (import_prices — промт 117)
CREATE TABLE IF NOT EXISTS catalog_prices (
  product_id     UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  price_type_id  UUID NOT NULL REFERENCES catalog_price_types(id) ON DELETE CASCADE,
  value          NUMERIC(18,2),
  currency       TEXT DEFAULT 'RUB',
  synced_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, price_type_id)
);

-- Журнал синков
CREATE TABLE IF NOT EXISTS catalog_sync_log (
  id            BIGSERIAL PRIMARY KEY,
  source_file   TEXT NOT NULL,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  status        TEXT DEFAULT 'running',
  rows_total    INTEGER DEFAULT 0,
  rows_upserted INTEGER DEFAULT 0,
  rows_skipped  INTEGER DEFAULT 0,
  error         TEXT,
  details       JSONB
);
CREATE INDEX IF NOT EXISTS catalog_sync_log_started_idx ON catalog_sync_log(started_at DESC);
