import { chunk, logLine } from "./util.mjs";

const BATCH = Number(process.env.CATALOG_SYNC_BATCH ?? 500);

/**
 * @param {import('./db-target.mjs').NeonTarget | import('./db-target.mjs').YandexProxyTarget} db
 * @param {import('./xml-parser.mjs').ParsedCatalogXml} data
 */
export async function importCatalogToDb(db, data) {
  const stats = {
    categories: 0,
    groups: 0,
    warehouses: 0,
    priceTypes: 0,
    products: 0,
    properties: 0,
    productCategories: 0,
    images: 0,
    stocks: 0,
    expectedPatches: 0,
    prices: 0,
  };

  logLine(`[${db.label}] categories (${data.categories.length})`);
  stats.categories += await upsertCategories(db, data.categories);

  logLine(`[${db.label}] groups (${data.groups.length})`);
  stats.groups += await upsertGroups(db, data.groups);

  logLine(`[${db.label}] warehouses (${data.warehouseIds.size})`);
  stats.warehouses += await upsertWarehouses(db, data.warehouseIds);

  logLine(`[${db.label}] price types (${data.priceTypes.length})`);
  stats.priceTypes += await upsertPriceTypes(db, data.priceTypes);

  logLine(`[${db.label}] products (${data.products.length})`);
  const productStats = await upsertProductsWithChildren(db, data.products);
  Object.assign(stats, productStats);

  logLine(`[${db.label}] stocks (${data.stocks.length})`);
  stats.stocks += await upsertStocks(db, data.stocks);

  logLine(`[${db.label}] expected stocks (${data.expectedStocks.length})`);
  stats.expectedPatches += await patchExpectedStocks(db, data.expectedStocks);

  logLine(`[${db.label}] prices (${data.prices?.length ?? 0})`);
  stats.prices += await upsertPrices(db, data.prices ?? []);

  const rowsUpserted =
    stats.categories +
    stats.groups +
    stats.warehouses +
    stats.priceTypes +
    stats.products +
    stats.properties +
    stats.productCategories +
    stats.images +
    stats.stocks +
    stats.expectedPatches +
    stats.prices;

  return { stats, rowsUpserted };
}

async function upsertCategories(db, rows) {
  let n = 0;
  for (const batch of chunk(rows, BATCH)) {
    await db.transaction(async (q) => {
      const values = [];
      const params = [];
      let i = 1;
      for (const r of batch) {
        values.push(`($${i}::uuid, $${i + 1}, NULL, $${i + 2}::jsonb, NOW())`);
        params.push(r.id, r.name, JSON.stringify(r.raw ?? {}));
        i += 3;
      }
      await q.query(
        `INSERT INTO catalog_categories (id, name, parent_id, raw, synced_at)
         VALUES ${values.join(",")}
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           raw = EXCLUDED.raw,
           synced_at = NOW()`,
        params,
      );
    });
    n += batch.length;
  }

  for (const batch of chunk(
    rows.filter((r) => r.parentId),
    BATCH,
  )) {
    for (const r of batch) {
      await db.query(
        `UPDATE catalog_categories SET parent_id = $2::uuid, synced_at = NOW() WHERE id = $1::uuid`,
        [r.id, r.parentId],
      );
    }
    n += batch.length;
  }
  return n;
}

async function upsertGroups(db, rows) {
  let n = 0;
  for (const batch of chunk(rows, BATCH)) {
    await db.transaction(async (q) => {
      const values = [];
      const params = [];
      let i = 1;
      for (const r of batch) {
        values.push(`($${i}::uuid, NULL, NULL, NOW())`);
        params.push(r.id);
        i += 1;
      }
      await q.query(
        `INSERT INTO catalog_groups (id, parent_id, name, synced_at)
         VALUES ${values.join(",")}
         ON CONFLICT (id) DO UPDATE SET synced_at = NOW()`,
        params,
      );
    });
    n += batch.length;
  }
  for (const batch of chunk(
    rows.filter((r) => r.parentId),
    BATCH,
  )) {
    for (const r of batch) {
      await db.query(`UPDATE catalog_groups SET parent_id = $2::uuid, synced_at = NOW() WHERE id = $1::uuid`, [
        r.id,
        r.parentId,
      ]);
    }
  }
  return n;
}

async function upsertWarehouses(db, warehouseIds) {
  const ids = [...warehouseIds];
  let n = 0;
  for (const batch of chunk(ids, BATCH)) {
    const values = batch.map((_, idx) => `($${idx + 1}::uuid, NULL, NOW())`).join(",");
    await db.query(
      `INSERT INTO catalog_warehouses (id, name, synced_at)
       VALUES ${values}
       ON CONFLICT (id) DO UPDATE SET synced_at = NOW()`,
      batch,
    );
    n += batch.length;
  }
  return n;
}

async function upsertPriceTypes(db, rows) {
  let n = 0;
  for (const batch of chunk(rows, BATCH)) {
    const values = [];
    const params = [];
    let i = 1;
    for (const r of batch) {
      values.push(`($${i}::uuid, $${i + 1}, NOW())`);
      params.push(r.id, r.name);
      i += 2;
    }
    await db.query(
      `INSERT INTO catalog_price_types (id, name, synced_at)
       VALUES ${values.join(",")}
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, synced_at = NOW()`,
      params,
    );
    n += batch.length;
  }
  return n;
}

async function upsertProductsWithChildren(db, products) {
  const stats = {
    products: 0,
    properties: 0,
    productCategories: 0,
    images: 0,
  };

  for (const batch of chunk(products, Math.min(BATCH, 200))) {
    await db.transaction(async (q) => {
      const ids = batch.map((p) => p.id);
      await q.query(`DELETE FROM catalog_product_properties WHERE product_id = ANY($1::uuid[])`, [ids]);
      await q.query(`DELETE FROM catalog_product_categories WHERE product_id = ANY($1::uuid[])`, [ids]);
      await q.query(`DELETE FROM catalog_product_images WHERE product_id = ANY($1::uuid[])`, [ids]);

      const pValues = [];
      const pParams = [];
      let i = 1;
      for (const p of batch) {
        pValues.push(
          `($${i}::uuid, $${i + 1}::uuid, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, NOW())`,
        );
        pParams.push(
          p.id,
          p.groupId,
          p.name,
          p.active,
          p.brand,
          p.displayName,
          p.isOnSite,
        );
        i += 7;
      }
      await q.query(
        `INSERT INTO catalog_products (id, group_id, name, active, brand, display_name, is_on_site, synced_at)
         VALUES ${pValues.join(",")}
         ON CONFLICT (id) DO UPDATE SET
           group_id = EXCLUDED.group_id,
           name = EXCLUDED.name,
           active = EXCLUDED.active,
           brand = EXCLUDED.brand,
           display_name = EXCLUDED.display_name,
           is_on_site = EXCLUDED.is_on_site,
           synced_at = NOW()`,
        pParams,
      );
      stats.products += batch.length;

      await insertPropertyBatches(q, batch);
      stats.properties += batch.reduce((s, p) => s + p.properties.length, 0);

      await insertProductCategories(q, batch);
      stats.productCategories += batch.reduce((s, p) => s + p.categoryIds.length, 0);

      await insertProductImages(q, batch);
      stats.images += batch.reduce((s, p) => s + p.imagePaths.length, 0);
    });
  }
  return stats;
}

async function insertPropertyBatches(q, batch) {
  const rows = [];
  for (const p of batch) {
    for (const pr of p.properties) {
      rows.push([p.id, pr.code, pr.name, pr.value]);
    }
  }
  for (const sub of chunk(rows, BATCH * 5)) {
    const values = [];
    const params = [];
    let i = 1;
    for (const [productId, code, name, value] of sub) {
      values.push(`($${i}::uuid, $${i + 1}::uuid, $${i + 2}, $${i + 3})`);
      params.push(productId, code, name, value);
      i += 4;
    }
    await q.query(
      `INSERT INTO catalog_product_properties (product_id, property_code, name, value)
       VALUES ${values.join(",")}
       ON CONFLICT (product_id, property_code) DO UPDATE SET
         name = EXCLUDED.name,
         value = EXCLUDED.value`,
      params,
    );
  }
}

async function insertProductCategories(q, batch) {
  const rows = [];
  for (const p of batch) {
    for (const cid of p.categoryIds) {
      rows.push([p.id, cid]);
    }
  }
  for (const sub of chunk(rows, BATCH * 5)) {
    const values = [];
    const params = [];
    let i = 1;
    for (const [productId, categoryId] of sub) {
      values.push(`($${i}::uuid, $${i + 1}::uuid)`);
      params.push(productId, categoryId);
      i += 2;
    }
    await q.query(
      `INSERT INTO catalog_product_categories (product_id, category_id)
       VALUES ${values.join(",")}
       ON CONFLICT DO NOTHING`,
      params,
    );
  }
}

async function insertProductImages(q, batch) {
  const rows = [];
  for (const p of batch) {
    p.imagePaths.forEach((path, sortOrder) => {
      rows.push([p.id, path, sortOrder]);
    });
  }
  for (const sub of chunk(rows, BATCH * 5)) {
    const values = [];
    const params = [];
    let i = 1;
    for (const [productId, path, sortOrder] of sub) {
      values.push(`($${i}::uuid, $${i + 1}, $${i + 2})`);
      params.push(productId, path, sortOrder);
      i += 3;
    }
    await q.query(
      `INSERT INTO catalog_product_images (product_id, path, sort_order)
       VALUES ${values.join(",")}`,
      params,
    );
  }
}

async function upsertStocks(db, stocks) {
  const byProduct = new Map();
  for (const s of stocks) {
    if (!byProduct.has(s.productId)) byProduct.set(s.productId, []);
    byProduct.get(s.productId).push(s);
  }
  const productIds = [...byProduct.keys()];
  let n = 0;

  for (const batch of chunk(productIds, 200)) {
    await db.transaction(async (q) => {
      await q.query(`DELETE FROM catalog_stocks WHERE product_id = ANY($1::uuid[])`, [batch]);
      const rows = [];
      for (const pid of batch) {
        for (const s of byProduct.get(pid) ?? []) {
          rows.push([s.productId, s.warehouseId, s.qty, 0]);
        }
      }
      for (const sub of chunk(rows, BATCH * 3)) {
        const values = [];
        const params = [];
        let i = 1;
        for (const [productId, warehouseId, qty, expectedQty] of sub) {
          values.push(`($${i}::uuid, $${i + 1}::uuid, $${i + 2}, $${i + 3}, NOW())`);
          params.push(productId, warehouseId, qty, expectedQty);
          i += 4;
        }
        await q.query(
          `INSERT INTO catalog_stocks (product_id, warehouse_id, qty, expected_qty, synced_at)
           VALUES ${values.join(",")}
           ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
             qty = EXCLUDED.qty,
             synced_at = NOW()`,
          params,
        );
        n += sub.length;
      }
    });
  }
  return n;
}

async function upsertPrices(db, prices) {
  if (!prices || prices.length === 0) return 0;
  // дедуп по (productId, priceTypeId): оставляем последнюю встреченную цену
  const map = new Map();
  for (const p of prices) map.set(`${p.productId}|${p.priceTypeId}`, p);
  const deduped = [...map.values()];

  // в catalog_prices product_id ~ FK на catalog_products. Делаем выборку из реальных id и фильтруем
  // (в 1С бывают цены для неэкспортируемых товаров)
  let n = 0;
  for (const batch of chunk(deduped, BATCH)) {
    await db.transaction(async (q) => {
      const productIds = [...new Set(batch.map((p) => p.productId))];
      const existing = await q.query(
        `SELECT id FROM catalog_products WHERE id = ANY($1::uuid[])`,
        [productIds],
      );
      const existingSet = new Set(existing.rows.map((r) => r.id));

      const priceTypeIds = [...new Set(batch.map((p) => p.priceTypeId))];
      const existingTypes = await q.query(
        `SELECT id FROM catalog_price_types WHERE id = ANY($1::uuid[])`,
        [priceTypeIds],
      );
      const existingTypeSet = new Set(existingTypes.rows.map((r) => r.id));

      const rows = batch.filter((p) => existingSet.has(p.productId) && existingTypeSet.has(p.priceTypeId));
      if (rows.length === 0) return;

      const values = [];
      const params = [];
      let i = 1;
      for (const r of rows) {
        values.push(`($${i}::uuid, $${i + 1}::uuid, $${i + 2}::numeric, 'RUB', NOW())`);
        params.push(r.productId, r.priceTypeId, r.value);
        i += 3;
      }
      await q.query(
        `INSERT INTO catalog_prices (product_id, price_type_id, value, currency, synced_at)
         VALUES ${values.join(",")}
         ON CONFLICT (product_id, price_type_id) DO UPDATE SET
           value = EXCLUDED.value,
           currency = EXCLUDED.currency,
           synced_at = NOW()`,
        params,
      );
      n += rows.length;
    });
  }
  return n;
}

async function patchExpectedStocks(db, expected) {
  let n = 0;
  for (const batch of chunk(expected, BATCH)) {
    for (const r of batch) {
      const res = await db.query(
        `UPDATE catalog_stocks SET expected_qty = $3, synced_at = NOW()
         WHERE product_id = $1::uuid AND warehouse_id = $2::uuid`,
        [r.productId, r.warehouseId, r.expectedQty],
      );
      // если такой пары product/warehouse нет — товар отсутствует в catalog_products, пропускаем
      // (1С может слать expected stocks для несуществующих товаров)
      n += 1;
    }
  }
  return n;
}

/**
 * @param {import('./db-target.mjs').NeonTarget | import('./db-target.mjs').YandexProxyTarget} db
 */
export async function startSyncLog(db, sourceFile) {
  const r = await db.query(
    `INSERT INTO catalog_sync_log (source_file, status, started_at)
     VALUES ($1, 'running', NOW())
     RETURNING id`,
    [sourceFile],
  );
  return String(r.rows[0].id);
}

export async function finishSyncLog(db, logId, patch) {
  await db.query(
    `UPDATE catalog_sync_log SET
       finished_at = NOW(),
       status = $2,
       rows_total = COALESCE($3, rows_total),
       rows_upserted = COALESCE($4, rows_upserted),
       rows_skipped = COALESCE($5, rows_skipped),
       error = $6,
       details = COALESCE($7::jsonb, details)
     WHERE id = $1::bigint`,
    [
      logId,
      patch.status,
      patch.rowsTotal ?? null,
      patch.rowsUpserted ?? null,
      patch.rowsSkipped ?? null,
      patch.error ?? null,
      patch.details ? JSON.stringify(patch.details) : null,
    ],
  );
}
