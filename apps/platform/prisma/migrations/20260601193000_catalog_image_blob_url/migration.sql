-- Промт 120: храним загруженные в Vercel Blob фото
ALTER TABLE catalog_product_images
  ADD COLUMN IF NOT EXISTS blob_url TEXT,
  ADD COLUMN IF NOT EXISTS blob_size BIGINT,
  ADD COLUMN IF NOT EXISTS blob_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_size BIGINT,
  ADD COLUMN IF NOT EXISTS source_mtime TIMESTAMPTZ;

-- Уникальность пути по товару — чтобы не плодить дубликаты при повторных импортах
CREATE UNIQUE INDEX IF NOT EXISTS catalog_product_images_product_path_uq
  ON catalog_product_images (product_id, path);

CREATE INDEX IF NOT EXISTS catalog_product_images_blob_url_idx
  ON catalog_product_images (blob_url)
  WHERE blob_url IS NOT NULL;
