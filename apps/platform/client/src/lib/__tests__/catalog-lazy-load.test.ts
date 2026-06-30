/**
 * Запуск: `npm run test:catalog-lazy-load` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFeatureFlags } from "../../../../server/api/feature-flags-api.js";
import {
  isCatalogLazyLoadEnabled,
  resetCatalogLazyLoadFlagCache,
  seedCatalogLazyLoadFromBootstrap,
} from "../catalog-lazy-load-flag.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogDataPath = path.resolve(here, "../catalog-data.ts");
const catalogDataSrc = fs.readFileSync(catalogDataPath, "utf8");

{
  assert.ok(
    !catalogDataSrc.includes('from "./tandoor-real-catalog-seed.generated"'),
    "catalog-data.ts must not statically import tandoor-real-catalog-seed.generated",
  );
  const seedImporterPath = path.resolve(here, "../catalog-products-from-seed.ts");
  const seedImporterSrc = fs.readFileSync(seedImporterPath, "utf8");
  assert.ok(
    seedImporterSrc.includes('from "./tandoor-real-catalog-seed.generated"'),
    "catalog-products-from-seed.ts must be the static seed importer",
  );
}

{
  const prev = process.env.CATALOG_LAZY_LOAD;
  try {
    process.env.CATALOG_LAZY_LOAD = "true";
    const flags = getFeatureFlags();
    assert.equal(flags.flags.CATALOG_LAZY_LOAD, true);
  } finally {
    if (prev === undefined) delete process.env.CATALOG_LAZY_LOAD;
    else process.env.CATALOG_LAZY_LOAD = prev;
  }
}

{
  resetCatalogLazyLoadFlagCache();
  seedCatalogLazyLoadFromBootstrap({ flags: { CATALOG_LAZY_LOAD: false } });
  const mod = await import("../catalog-data.js");
  assert.ok(mod.getCatalogProducts().length > 100);
  assert.ok(mod.CATALOG_PRODUCTS.length > 100);
  assert.equal(isCatalogLazyLoadEnabled(), false);
}

{
  const mod = await import("../catalog-data.js");
  mod.resetCatalogDataCacheForTests();
  resetCatalogLazyLoadFlagCache();
  seedCatalogLazyLoadFromBootstrap({ flags: { CATALOG_LAZY_LOAD: true } });
  assert.equal(mod.getCatalogProducts().length, 0);
  const first = mod.ensureCatalogLoaded();
  const second = mod.ensureCatalogLoaded();
  assert.equal(first, second, "ensureCatalogLoaded must reuse one in-flight promise");
  const products = await first;
  assert.ok(products.length > 100);
  assert.ok(mod.getCatalogProducts().length > 100);
  assert.ok(mod.CATALOG_PRODUCTS.length > 100);
  const third = await mod.ensureCatalogLoaded();
  assert.equal(third, products);
}

console.log("catalog-lazy-load: ok");
