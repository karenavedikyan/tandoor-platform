/**
 * Сбор стартовой выборки товаров с публичного сайта tandoor.ru и подготовка локального seed.
 *
 * Запуск из каталога apps/platform:
 *   node scripts/import-tandoor-public-catalog.mjs
 *
 * Результат:
 *   - client/public/catalog-real/*.webp — изображения (WebP, сжатие);
 *   - client/src/lib/tandoor-real-catalog-seed.generated.ts — данные для приложения.
 *
 * Скрипт обращается только к публичным URL, не использует авторизацию.
 * Обновление выборки: массивы LISTING_URLS_* и PINNED_PRODUCT_PATHS в этом файле, затем снова `npm run catalog:import`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_IMG = path.join(ROOT, "client/public/catalog-real");
const OUT_TS = path.join(ROOT, "client/src/lib/tandoor-real-catalog-seed.generated.ts");

const BASE = "https://tandoor.ru";
const UA = "Mozilla/5.0 TandoorPlatformCatalogSeed/1.0 (educational; +https://tandoor.ru)";

const VH_PAGES = [
  "/catalog/vkhodnye-dveri/po-naznacheniyu/dlya-kvartiry/",
  "/catalog/vkhodnye-dveri/po-naznacheniyu/dlya-kvartiry/?PAGEN_25=2",
  "/catalog/vkhodnye-dveri/po-naznacheniyu/dlya-doma/",
  "/catalog/vkhodnye-dveri/po-naznacheniyu/dlya-doma/?PAGEN_25=2",
  "/catalog/vkhodnye-dveri/po-materialu/mdf-mdf/",
  "/catalog/vkhodnye-dveri/po-materialu/mdf-mdf/?PAGEN_25=2",
];

const MK_PAGES = [
  "/catalog/mezhkomnatnye-dveri/po-pokrytiyu/emalevye-dveri/",
  "/catalog/mezhkomnatnye-dveri/po-pokrytiyu/emalevye-dveri/?PAGEN_25=2",
  "/catalog/mezhkomnatnye-dveri/po-pokrytiyu/emalevye-dveri/?PAGEN_25=3",
  "/catalog/mezhkomnatnye-dveri/po-pokrytiyu/emalevye-dveri/?PAGEN_25=4",
  "/catalog/mezhkomnatnye-dveri/po-tipu/skrytye/",
  "/catalog/mezhkomnatnye-dveri/po-pokrytiyu/sovremennye-pokrytiya/pet/",
  "/catalog/mezhkomnatnye-dveri/po-pokrytiyu/sovremennye-pokrytiya/pet/?PAGEN_25=2",
  "/catalog/mezhkomnatnye-dveri/po-pokrytiyu/laminirovannye-dveri/",
  "/catalog/mezhkomnatnye-dveri/po-pokrytiyu/laminirovannye-dveri/?PAGEN_25=2",
];

const HW_PAGES = ["/catalog/furnitura/dvernye-zamki-i-zashchelki/dvernye-zamki/"];

const TARGET_VH = 22;
const TARGET_MK = 22;
const TARGET_HW = 12;

/**
 * Карточки, которые должны стабильно попадать в seed независимо от порядка
 * на листингах (пилот обучения, частые запросы в каталоге).
 */
const PINNED_PRODUCT_PATHS = [
  { productPath: "/catalog/product/era-grafit-belyy-matovyy-860kh2050-levaya/", kind: "vh" },
  { productPath: "/catalog/product/sk-2-belyy-matovyy-pet-dg-2000-800-90p/", kind: "mk" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(rel) {
  const url = rel.startsWith("http") ? rel : `${BASE}${rel}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
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

function parseDetail(html, productPath) {
  const slug = productPath.replace(/^\/catalog\/product\//, "").replace(/\/$/, "");
  const imgs = [
    ...html.matchAll(
      /itemprop="image"[^>]*src="(\/upload\/resize_cache\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi,
    ),
  ].map((x) => x[1]);
  const uniq = [];
  const seen = new Set();
  for (const u of imgs) {
    if (!seen.has(u)) {
      seen.add(u);
      uniq.push(u);
    }
  }
  const imageRel = uniq[0] ?? null;
  const titleMatch = html.match(
    /Bread-crumbs__list-item Bread-crumbs__list-item--black[\s\S]*?itemprop="name">([^<]+)</,
  );
  const title = (titleMatch?.[1] ?? slug).trim().replace(/\s+/g, " ");
  const priceMatch = html.match(/itemprop="price"[\s\S]*?content="(\d+)"/);
  const priceRetail = priceMatch ? parseInt(priceMatch[1], 10) : undefined;
  const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  const shortDescription = descMatch?.[1]?.trim();
  return { slug, title, imageRel, priceRetail, shortDescription };
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
  if (kind === "vh" && t.includes("эра")) {
    tags.add("Эра");
    tags.add("МДФ");
    tags.add("белый матовый");
    tags.add("графит");
    tags.add("860x2050");
  }
  return [...tags].slice(0, 12);
}

function guessCollection(title) {
  const m = title.match(/^([^/]+?)\s+[А-Яа-яA-Za-z]/);
  if (m) return m[1].trim().slice(0, 48);
  const first = title.split(/\s+/)[0];
  return first?.length > 1 ? first : undefined;
}

async function collectPaths(pages, target) {
  const paths = [];
  const seen = new Set();
  for (const rel of pages) {
    if (paths.length >= target) break;
    const html = await fetchText(rel);
    for (const p of extractProductPaths(html)) {
      if (seen.has(p)) continue;
      seen.add(p);
      paths.push(p);
      if (paths.length >= target) break;
    }
    await sleep(200);
  }
  return paths;
}

async function main() {
  fs.mkdirSync(OUT_IMG, { recursive: true });

  const vhPaths = await collectPaths(VH_PAGES, TARGET_VH);
  const mkPaths = await collectPaths(MK_PAGES, TARGET_MK);
  const hwPaths = await collectPaths(HW_PAGES, TARGET_HW);

  const jobs = [
    ...PINNED_PRODUCT_PATHS,
    ...vhPaths.map((productPath) => ({ productPath, kind: "vh" })),
    ...mkPaths.map((productPath) => ({ productPath, kind: "mk" })),
    ...hwPaths.map((productPath) => ({ productPath, kind: "hw" })),
  ];

  const seenJob = new Set();
  const deduped = [];
  for (const j of jobs) {
    if (seenJob.has(j.productPath)) continue;
    seenJob.add(j.productPath);
    deduped.push(j);
  }

  const records = [];

  for (const { productPath, kind } of deduped) {
    const html = await fetchText(productPath);
    const d = parseDetail(html, productPath);
    if (!d.imageRel) {
      console.warn("skip (no image):", productPath);
      await sleep(150);
      continue;
    }
    const id = makeId(kind, d.slug);
    const webpName = `${id}.webp`;
    const ext = (d.imageRel.match(/\.([a-z0-9]+)$/i)?.[1] ?? "jpg").toLowerCase();
    const tmpIn = path.join(OUT_IMG, `.tmp-${id}.${ext}`);
    const outWebp = path.join(OUT_IMG, webpName);
    const imgUrl = `${BASE}${d.imageRel}`;

    const buf = Buffer.from(await (await fetch(imgUrl, { headers: { "User-Agent": UA } })).arrayBuffer());
    fs.writeFileSync(tmpIn, buf);
    execFileSync("ffmpeg", ["-y", "-i", tmpIn, "-c:v", "libwebp", "-q:v", "78", "-preset", "picture", "-vf", "scale=640:-1:flags=lanczos", outWebp], {
      stdio: "inherit",
    });
    try {
      fs.unlinkSync(tmpIn);
    } catch {
      /* ignore */
    }

    const category =
      kind === "vh" ? "entrance" : kind === "mk" ? "interior" : ("hardware");
    const categoryLabel =
      kind === "vh" ? "Входные двери" : kind === "mk" ? "Межкомнатные двери" : "Фурнитура";

    const tags = buildTags(kind, d.title);
    const searchText = [d.title, categoryLabel, ...tags].join(" ").toLowerCase();

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
      imageSrc: `/catalog-real/${webpName}`,
      imageAlt: d.title,
      shortDescription: d.shortDescription,
      tags,
      searchText,
    });

    console.log("ok", id, d.title.slice(0, 50));
    await sleep(250);
  }

  const header = `/* eslint-disable */\n/**\n * Автогенерация: node scripts/import-tandoor-public-catalog.mjs\n * Публичные данные tandoor.ru; изображения — локальные WebP в /catalog-real/\n */\n\n`;

  const json = JSON.stringify(records, null, 2);
  const body = `${header}export type TandoorRealCatalogSeedItem = {\n  id: string;\n  sourceUrl: string;\n  title: string;\n  category: "entrance" | "interior" | "hardware";\n  categoryLabel: string;\n  collection?: string;\n  finish?: string;\n  priceRetail?: number;\n  pricePromo?: number;\n  imageSrc: string;\n  imageAlt: string;\n  shortDescription?: string;\n  tags: string[];\n  searchText: string;\n};\n\nexport const TANDOOR_REAL_CATALOG_SEED: TandoorRealCatalogSeedItem[] = ${json};\n`;

  fs.writeFileSync(OUT_TS, body, "utf8");
  console.log("written", OUT_TS, "count", records.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
