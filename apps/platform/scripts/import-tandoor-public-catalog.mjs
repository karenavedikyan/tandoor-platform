/**
 * Полный импорт публичного каталога tandoor.ru: листинги (ВХ, МК, фурнитура),
 * карточки SKU, несколько фото на SKU, локальные WebP в `public/catalog-real/`.
 *
 * Запуск из `apps/platform`:
 *   npm run catalog:import
 *
 * Поведение при ошибках: существующий `tandoor-real-catalog-seed.generated.ts`
 * не перезаписывается, пока не собраны все записи и не сгенерированы файлы.
 * Логи summary в конце stdout (JSON).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_IMG = path.join(ROOT, "client/public/catalog-real");
const OUT_TS = path.join(ROOT, "client/src/lib/tandoor-real-catalog-seed.generated.ts");
const OUT_TS_TMP = OUT_TS + ".tmp";

let importCleanupHooksRegistered = false;

/** Удаляет временный seed и все `.tmp-*` в каталоге изображений (прерванный ffmpeg/загрузка). */
function cleanupImportArtifactTemps() {
  try {
    if (fs.existsSync(OUT_TS_TMP)) fs.unlinkSync(OUT_TS_TMP);
  } catch {
    /* ignore */
  }
  if (!fs.existsSync(OUT_IMG)) return;
  for (const f of fs.readdirSync(OUT_IMG)) {
    if (!f.startsWith(".tmp-")) continue;
    try {
      fs.unlinkSync(path.join(OUT_IMG, f));
    } catch {
      /* ignore */
    }
  }
}

function registerImportCleanupHooks() {
  if (importCleanupHooksRegistered) return;
  importCleanupHooksRegistered = true;
  process.on("SIGINT", () => {
    cleanupImportArtifactTemps();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanupImportArtifactTemps();
    process.exit(143);
  });
}

const BASE = "https://tandoor.ru";
const UA = "Mozilla/5.0 TandoorPlatformCatalogSeed/1.0 (educational; +https://tandoor.ru)";

/** Ограничитель на случай сетевых аномалий (0 = без лимита). */
const MAX_PRODUCTS = parseInt(process.env.CATALOG_IMPORT_MAX ?? "0", 10) || Infinity;

/** Максимум фото на одну карточку (включая главное). */
const MAX_IMAGES_PER_PRODUCT = 10;

const PINNED_PRODUCT_PATHS = [
  { productPath: "/catalog/product/era-grafit-belyy-matovyy-860kh2050-levaya/", kind: "vh" },
  { productPath: "/catalog/product/sk-2-belyy-matovyy-pet-dg-2000-800-90p/", kind: "mk" },
];

const stats = {
  listingRequests: 0,
  cardRequests: 0,
  urlsFound: 0,
  productsImported: 0,
  photosWritten: 0,
  dupSkipped: 0,
  cardErrors: 0,
  photoErrors: 0,
  byKind: { entrance: 0, interior: 0, hardware: 0 },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(rel) {
  const url = rel.startsWith("http") ? rel : `${BASE}${rel}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
  stats.listingRequests += 1;
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return await res.text();
}

async function fetchTextCard(rel) {
  const url = rel.startsWith("http") ? rel : `${BASE}${rel}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
  stats.cardRequests += 1;
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return await res.text();
}

function extractProductPaths(html) {
  const re = /href="(\/catalog\/product\/[^"/]+\/)"/g;
  const set = new Set();
  let m;
  while ((m = re.exec(html))) set.add(m[1]);
  return [...set];
}

function ensureTrailingSlash(p) {
  return p.endsWith("/") ? p : `${p}/`;
}

function extractListingPrefixes(html, rootPrefix) {
  const norm = ensureTrailingSlash(rootPrefix);
  const set = new Set([norm]);
  const esc = norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`href="(${esc}[^"]*)"`, "g");
  let m;
  while ((m = re.exec(html))) {
    let p = m[1];
    if (p.includes("filter/")) continue;
    if (p.includes("javascript:")) continue;
    p = ensureTrailingSlash(p);
    if (!p.startsWith(norm)) continue;
    set.add(p);
  }
  return [...set];
}

/**
 * Собирает product URLs с пагинации PAGEN_25 (Bitrix).
 */
async function collectProductsForListingPrefixes(prefixes) {
  const out = new Set();
  for (const rawPrefix of prefixes) {
    const prefix = ensureTrailingSlash(rawPrefix);
    let page = 1;
    let stagnant = 0;
    while (page <= 120 && stagnant < 4) {
      const rel = page === 1 ? prefix : `${prefix}?PAGEN_25=${page}`;
      let html;
      try {
        html = await fetchText(rel);
      } catch {
        stagnant += 1;
        page += 1;
        await sleep(150);
        continue;
      }
      const found = extractProductPaths(html);
      const before = out.size;
      for (const p of found) out.add(p);
      if (out.size === before) stagnant += 1;
      else stagnant = 0;
      page += 1;
      await sleep(100);
    }
  }
  return out;
}

function normalizeImageKey(u) {
  const base = path.basename(u.split("?")[0] ?? "");
  return base.toLowerCase();
}

function extractProductImageUrls(html) {
  const raw = [];
  const re1 = /itemprop="image"[^>]*src="(\/upload\/resize_cache\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
  let m;
  while ((m = re1.exec(html))) raw.push(m[1]);
  const re2 = /srcset="(\/upload\/resize_cache\/[^"]+\.webp)"/gi;
  while ((m = re2.exec(html))) raw.push(m[1]);
  const out = [];
  const seen = new Set();
  for (const u of raw) {
    if (!u.includes("/upload/resize_cache/")) continue;
    if (u.includes("100_100_")) continue;
    if (u.toLowerCase().endsWith(".svg")) continue;
    const k = normalizeImageKey(u);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(u);
    if (out.length >= MAX_IMAGES_PER_PRODUCT) break;
  }
  return out;
}

function parseDetail(html, productPath) {
  const slug = productPath.replace(/^\/catalog\/product\//, "").replace(/\/$/, "");
  const imageRels = extractProductImageUrls(html);
  const titleMatch = html.match(
    /Bread-crumbs__list-item Bread-crumbs__list-item--black[\s\S]*?itemprop="name">([^<]+)</,
  );
  const title = (titleMatch?.[1] ?? slug).trim().replace(/\s+/g, " ");
  const priceMatch = html.match(/itemprop="price"[\s\S]*?content="(\d+)"/);
  const priceRetail = priceMatch ? parseInt(priceMatch[1], 10) : undefined;
  const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  const shortDescription = descMatch?.[1]?.trim();
  return { slug, title, imageRels, priceRetail, shortDescription };
}

function makeId(kind, slug) {
  const safe = slug.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const base = `tc-${kind}-${safe}`;
  return base.length > 72 ? base.slice(0, 72) : base;
}

function buildTags(kind, title) {
  const t = title.toLowerCase();
  const tags = new Set();
  title
    .split(/[/\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .slice(0, 6)
    .forEach((s) => tags.add(s));
  if (kind === "vh") {
    tags.add("входные");
    tags.add("ВХ");
    tags.add("входная");
  } else if (kind === "mk") {
    tags.add("межкомнатные");
    tags.add("МК");
    tags.add("межкомнатная");
  } else {
    tags.add("фурнитура");
    tags.add("замок");
    tags.add("комплектующие");
  }
  if (t.includes("эмаль") || t.includes("emal")) tags.add("эмаль");
  if (t.includes("пэт") || t.includes("pet")) tags.add("ПЭТ");
  if (t.includes("mdf") || t.includes("мдф")) tags.add("МДФ");
  if (t.includes("hdf") || t.includes("хдф")) tags.add("HDF");
  if (t.includes("spc")) tags.add("SPC");
  if (t.includes("скрыт")) tags.add("скрытая");
  if (t.includes("термо")) tags.add("термо");
  if (kind === "vh" && t.includes("эра")) {
    tags.add("Эра");
    tags.add("белый матовый");
    tags.add("графит");
    tags.add("860x2050");
  }
  if (kind === "hw") {
    if (t.includes("петл")) tags.add("петля");
    if (t.includes("ручк")) tags.add("ручка");
    if (t.includes("цилиндр")) tags.add("цилиндр");
  }
  return [...tags].slice(0, 14);
}

function guessCollection(title) {
  const m = title.match(/^([^/]+?)\s+[А-Яа-яA-Za-z]/);
  if (m) return m[1].trim().slice(0, 48);
  const first = title.split(/\s+/)[0];
  return first?.length > 1 ? first : undefined;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function convertToWebp(srcBuf, ext, destWebp) {
  const tmp = path.join(OUT_IMG, `.tmp-conv-${path.basename(destWebp)}.${ext}`);
  try {
    fs.writeFileSync(tmp, srcBuf);
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        tmp,
        "-c:v",
        "libwebp",
        "-q:v",
        "80",
        "-preset",
        "picture",
        "-vf",
        "scale=min(iw\\,720):-2:flags=lanczos",
        destWebp,
      ],
      { stdio: "ignore" },
    );
  } finally {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function writeSeedFile(records) {
  const header = `/* eslint-disable */\n/**\n * Автогенерация: node scripts/import-tandoor-public-catalog.mjs\n * Публичные данные tandoor.ru; изображения — локальные WebP в /catalog-real/\n */\n\n`;

  const typeBlock = `export type TandoorRealCatalogImage = {
  src: string;
  alt: string;
  role: "primary" | "gallery";
};

export type TandoorRealCatalogSeedItem = {
  id: string;
  sourceUrl: string;
  title: string;
  category: "entrance" | "interior" | "hardware";
  categoryLabel: string;
  collection?: string;
  finish?: string;
  priceRetail?: number;
  pricePromo?: number;
  /** Главное фото (дублирует images[0].src). */
  imageSrc: string;
  imageAlt: string;
  images: TandoorRealCatalogImage[];
  shortDescription?: string;
  tags: string[];
  searchText: string;
};

`;

  const json = JSON.stringify(records, null, 2);
  const body = `${header}${typeBlock}export const TANDOOR_REAL_CATALOG_SEED: TandoorRealCatalogSeedItem[] = ${json};\n`;
  fs.writeFileSync(OUT_TS_TMP, body, "utf8");
  fs.renameSync(OUT_TS_TMP, OUT_TS);
}

function cleanupOrphanWebp(manifestBasenames) {
  const want = new Set(manifestBasenames);
  if (!fs.existsSync(OUT_IMG)) return;
  for (const f of fs.readdirSync(OUT_IMG)) {
    if (!f.endsWith(".webp")) continue;
    if (!f.startsWith("tc-")) continue;
    if (want.has(f)) continue;
    try {
      fs.unlinkSync(path.join(OUT_IMG, f));
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  registerImportCleanupHooks();
  cleanupImportArtifactTemps();
  fs.mkdirSync(OUT_IMG, { recursive: true });

  const productKind = new Map();

  const vhIndex = await fetchText("/catalog/vkhodnye-dveri/");
  const vhPrefixes = extractListingPrefixes(vhIndex, "/catalog/vkhodnye-dveri/");
  const vhSet = await collectProductsForListingPrefixes(vhPrefixes);
  for (const p of vhSet) productKind.set(p, "vh");

  const mkIndex = await fetchText("/catalog/mezhkomnatnye-dveri/");
  const mkPrefixes = extractListingPrefixes(mkIndex, "/catalog/mezhkomnatnye-dveri/");
  const mkSet = await collectProductsForListingPrefixes(mkPrefixes);
  for (const p of mkSet) {
    if (!productKind.has(p)) productKind.set(p, "mk");
  }

  const hwIndex = await fetchText("/catalog/furnitura/");
  const hwPrefixes = extractListingPrefixes(hwIndex, "/catalog/furnitura/");
  const hwSet = await collectProductsForListingPrefixes(hwPrefixes);
  for (const p of hwSet) {
    if (!productKind.has(p)) productKind.set(p, "hw");
  }

  for (const pin of PINNED_PRODUCT_PATHS) {
    productKind.set(pin.productPath, pin.kind);
  }

  const jobs = [];
  const seenJob = new Set();
  for (const pin of PINNED_PRODUCT_PATHS) {
    seenJob.add(pin.productPath);
    jobs.push({ productPath: pin.productPath, kind: pin.kind });
  }
  for (const [productPath, kind] of productKind) {
    if (seenJob.has(productPath)) {
      stats.dupSkipped += 1;
      continue;
    }
    seenJob.add(productPath);
    jobs.push({ productPath, kind });
    if (jobs.length >= MAX_PRODUCTS) break;
  }

  stats.urlsFound = jobs.length;
  console.log("discovered product URLs:", stats.urlsFound);

  const records = [];
  const manifestFiles = new Set();

  for (const { productPath, kind } of jobs) {
    let html;
    try {
      html = await fetchTextCard(productPath);
    } catch (e) {
      stats.cardErrors += 1;
      console.warn("card error", productPath, e?.message ?? e);
      await sleep(80);
      continue;
    }
    const d = parseDetail(html, productPath);
    if (!d.imageRels.length) {
      stats.cardErrors += 1;
      console.warn("skip (no images):", productPath);
      await sleep(80);
      continue;
    }
    const id = makeId(kind, d.slug);
    const images = [];
    let idx = 0;
    for (const rel of d.imageRels) {
      idx += 1;
      const webpName = `${id}-${pad2(idx)}.webp`;
      const outWebp = path.join(OUT_IMG, webpName);
      const ext = (rel.match(/\.([a-z0-9]+)$/i)?.[1] ?? "jpg").toLowerCase();
      try {
        const buf = Buffer.from(await (await fetch(`${BASE}${rel}`, { headers: { "User-Agent": UA } })).arrayBuffer());
        convertToWebp(buf, ext, outWebp);
        manifestFiles.add(webpName);
        stats.photosWritten += 1;
      } catch (e) {
        stats.photoErrors += 1;
        console.warn("photo error", id, rel, e?.message ?? e);
        if (idx === 1) break;
        continue;
      }
      images.push({
        src: `/catalog-real/${webpName}`,
        alt: idx === 1 ? d.title : `${d.title} — фото ${idx}`,
        role: idx === 1 ? "primary" : "gallery",
      });
      if (images.length >= d.imageRels.length) break;
    }
    if (!images.length) {
      stats.cardErrors += 1;
      continue;
    }
    const primary = images[0];
    const category = kind === "vh" ? "entrance" : kind === "mk" ? "interior" : "hardware";
    const categoryLabel =
      kind === "vh" ? "Входные двери" : kind === "mk" ? "Межкомнатные двери" : "Фурнитура";
    const tags = buildTags(kind, d.title);
    const searchText = [d.title, categoryLabel, ...tags, ...images.map((im) => im.alt)].join(" ").toLowerCase();

    records.push({
      id,
      sourceUrl: `${BASE}${productPath}`,
      title: d.title,
      category,
      categoryLabel,
      collection: guessCollection(d.title),
      finish: undefined,
      priceRetail: d.priceRetail,
      pricePromo: undefined,
      imageSrc: primary.src,
      imageAlt: d.title,
      images,
      shortDescription: d.shortDescription,
      tags,
      searchText,
    });
    stats.productsImported += 1;
    stats.byKind[category] += 1;
    if (stats.productsImported % 50 === 0) {
      console.log("progress", stats.productsImported, id);
    }
    await sleep(90);
  }

  if (records.length === 0) {
    throw new Error("import produced zero records; seed file not updated");
  }

  writeSeedFile(records);
  cleanupOrphanWebp(manifestFiles);

  let n0 = 0;
  let n1 = 0;
  let n2 = 0;
  for (const r of records) {
    const c = r.images.length;
    if (c === 0) n0 += 1;
    else if (c === 1) n1 += 1;
    else n2 += 1;
  }
  let totalBytes = 0;
  let maxBytes = 0;
  let nFiles = 0;
  for (const f of manifestFiles) {
    const st = fs.statSync(path.join(OUT_IMG, f));
    totalBytes += st.size;
    maxBytes = Math.max(maxBytes, st.size);
    nFiles += 1;
  }
  const multiSample = records
    .filter((r) => r.images.length >= 2)
    .slice(0, 12)
    .map((r) => ({ id: r.id, photos: r.images.length, title: r.title.slice(0, 48) }));

  console.log(
    "SUMMARY",
    JSON.stringify(
      {
        ...stats,
        photosPerProductAvg: Math.round((stats.photosWritten / stats.productsImported) * 100) / 100,
        productsNoPhoto: n0,
        productsOnePhoto: n1,
        productsMultiPhoto: n2,
        webpFiles: nFiles,
        webpTotalBytes: totalBytes,
        webpMaxBytes: maxBytes,
        webpAvgBytes: nFiles ? Math.round(totalBytes / nFiles) : 0,
        multiPhotoSample: multiSample,
      },
      null,
      0,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  cleanupImportArtifactTemps();
  process.exit(1);
});
