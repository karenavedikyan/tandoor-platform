-- Защита blob_url от затирания старым importer'ом (DELETE+INSERT).
-- Полностью на уровне БД, обратимо. Таблица catalog_product_images НЕ в ТАБУ-списке.
-- Идемпотентно: можно применять повторно.

-- 1. Теневое хранилище blob-значений по ключу (product_id, path).
CREATE TABLE IF NOT EXISTS catalog_product_images_blob_keep (
  product_id        uuid NOT NULL,
  path              text NOT NULL,
  blob_url          text,
  blob_size         bigint,
  blob_uploaded_at  timestamptz,
  source_size       bigint,
  source_mtime      timestamptz,
  PRIMARY KEY (product_id, path)
);

-- 2. Наполнить keep текущими непустыми blob_url (снимок на момент установки защиты).
INSERT INTO catalog_product_images_blob_keep
  (product_id, path, blob_url, blob_size, blob_uploaded_at, source_size, source_mtime)
SELECT product_id, path, blob_url, blob_size, blob_uploaded_at, source_size, source_mtime
FROM catalog_product_images
WHERE blob_url IS NOT NULL
ON CONFLICT (product_id, path) DO UPDATE SET
  blob_url         = EXCLUDED.blob_url,
  blob_size        = EXCLUDED.blob_size,
  blob_uploaded_at = EXCLUDED.blob_uploaded_at,
  source_size      = EXCLUDED.source_size,
  source_mtime     = EXCLUDED.source_mtime;

-- 3a. BEFORE INSERT: если importer вставляет строку без blob_url, а в keep есть значение — восстановить.
CREATE OR REPLACE FUNCTION trg_cpi_restore_blob() RETURNS trigger AS $$
DECLARE k catalog_product_images_blob_keep%ROWTYPE;
BEGIN
  IF NEW.blob_url IS NULL THEN
    SELECT * INTO k FROM catalog_product_images_blob_keep
      WHERE product_id = NEW.product_id AND path = NEW.path;
    IF FOUND AND k.blob_url IS NOT NULL THEN
      NEW.blob_url         := k.blob_url;
      NEW.blob_size        := k.blob_size;
      NEW.blob_uploaded_at := k.blob_uploaded_at;
      NEW.source_size      := COALESCE(NEW.source_size, k.source_size);
      NEW.source_mtime     := COALESCE(NEW.source_mtime, k.source_mtime);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cpi_restore_blob ON catalog_product_images;
CREATE TRIGGER cpi_restore_blob
  BEFORE INSERT ON catalog_product_images
  FOR EACH ROW EXECUTE FUNCTION trg_cpi_restore_blob();

-- 3b. AFTER INSERT OR UPDATE: когда blob_url проставлен (фото-синком) — синхронизировать keep.
CREATE OR REPLACE FUNCTION trg_cpi_keep_blob() RETURNS trigger AS $$
BEGIN
  IF NEW.blob_url IS NOT NULL THEN
    INSERT INTO catalog_product_images_blob_keep
      (product_id, path, blob_url, blob_size, blob_uploaded_at, source_size, source_mtime)
    VALUES
      (NEW.product_id, NEW.path, NEW.blob_url, NEW.blob_size, NEW.blob_uploaded_at, NEW.source_size, NEW.source_mtime)
    ON CONFLICT (product_id, path) DO UPDATE SET
      blob_url         = EXCLUDED.blob_url,
      blob_size        = EXCLUDED.blob_size,
      blob_uploaded_at = EXCLUDED.blob_uploaded_at,
      source_size      = EXCLUDED.source_size,
      source_mtime     = EXCLUDED.source_mtime;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cpi_keep_blob ON catalog_product_images;
CREATE TRIGGER cpi_keep_blob
  AFTER INSERT OR UPDATE OF blob_url ON catalog_product_images
  FOR EACH ROW EXECUTE FUNCTION trg_cpi_keep_blob();
