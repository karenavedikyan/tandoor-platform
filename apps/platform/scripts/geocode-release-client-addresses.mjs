#!/usr/bin/env node
/**
 * Офлайн-подготовка координат для карты клиентов (не вызывается из браузера).
 *
 * Режимы:
 *   node scripts/geocode-release-client-addresses.mjs --dry-run
 *   node scripts/geocode-release-client-addresses.mjs --cities-photon
 *   node scripts/geocode-release-client-addresses.mjs --import-address-csv [path]
 *   node scripts/geocode-release-client-addresses.mjs --import-city-csv [path]
 *
 * CSV адресов (по умолчанию data/release-client-address-coordinates.csv):
 *   clientId,lat,lng
 *
 * CSV городов (по умолчанию data/release-city-fallback-coordinates.csv):
 *   city,lat,lng
 *
 * Кэш Photon для городов: data/geocode-city-cache.json
 * Кэш геокодинга адресов (TODO провайдер): data/geocode-cache.json
 */

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const CLIENT_SRC = path.join(ROOT, "client", "src", "lib");
const SEED = path.join(CLIENT_SRC, "release-client-seed.generated.ts");

const DEFAULT_ADDR_CSV = path.join(DATA, "release-client-address-coordinates.csv");
const DEFAULT_CITY_CSV = path.join(DATA, "release-city-fallback-coordinates.csv");
const CITY_CACHE = path.join(DATA, "geocode-city-cache.json");
const GEOCODE_CACHE = path.join(DATA, "geocode-cache.json");

const OUT_ADDR = path.join(CLIENT_SRC, "release-client-address-coordinates.generated.ts");
const OUT_CITY = path.join(CLIENT_SRC, "russian-city-centers.generated.ts");

function readJsonSafe(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function extractUniqueCitiesFromSeed() {
  const text = fs.readFileSync(SEED, "utf8");
  const cities = new Set();
  const re = /"city":"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    const c = JSON.parse(`"${raw}"`);
    if (c && String(c).trim()) cities.add(String(c).trim());
  }
  return Array.from(cities).sort((a, b) => a.localeCompare(b, "ru"));
}

function extractClientRowsFromSeed() {
  const text = fs.readFileSync(SEED, "utf8");
  const marker = "export const RELEASE_CLIENT_ROWS: ReleaseClientSeedRow[] = ";
  const start = text.indexOf(marker);
  if (start < 0) throw new Error("RELEASE_CLIENT_ROWS not found");
  const bodyStart = start + marker.length;
  const bodyEnd = text.indexOf("] as ReleaseClientSeedRow[]", bodyStart);
  if (bodyEnd < 0) throw new Error("RELEASE_CLIENT_ROWS tail not found");
  return JSON.parse(text.slice(bodyStart, bodyEnd + 1));
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "tandoor-platform-geocode-script/1.0" } }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeAddressForPhoton(row) {
  const city = String(row.city || "").trim();
  const raw = String(row.address || "").trim();
  if (!city || !raw) return "";
  const cleaned = raw
    .replace(/\b\d{6}\b,?\s*/g, "")
    .replace(/\b(Россия|РФ|Российская Федерация)\b,?\s*/gi, "")
    .replace(/\b(Респ|Республика|край|обл|область|р-н|район)\b\.?,?\s*/gi, " ")
    .replace(/\bг\.?\s*/gi, " ")
    .replace(/\bдом\s*№?\s*/gi, " ")
    .replace(/\bд\.?\s*/gi, " ")
    .replace(/\bквартира\s*\d+\b/gi, " ")
    .replace(/\bкв\.?\s*\d+\b/gi, " ")
    .replace(/\bкорпус\b/gi, "к")
    .replace(/\bстроение\b/gi, "стр")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
  return `${city}, ${cleaned}`;
}

async function photonCityCenter(city, cache) {
  if (cache[city]) return cache[city];
  const q = encodeURIComponent(`${city}, Россия`);
  const url = `https://photon.komoot.io/api/?q=${q}&limit=1`;
  const j = await httpGetJson(url);
  const f = j?.features?.[0];
  const coords = f?.geometry?.coordinates;
  if (!coords || coords.length < 2) {
    cache[city] = null;
    return null;
  }
  const [lng, lat] = coords;
  const out = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
  cache[city] = out;
  return out;
}

async function photonAddress(row, cache) {
  const q = normalizeAddressForPhoton(row);
  if (!q) return null;
  const key = `photon-v2|${row.id}|${q}`;
  if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`;
  const j = await httpGetJson(url);
  const f = j?.features?.[0];
  const coords = f?.geometry?.coordinates;
  if (!coords || coords.length < 2) {
    cache[key] = null;
    return null;
  }
  const [lng, lat] = coords;
  const out = { lat: +lat.toFixed(7), lng: +lng.toFixed(7), q };
  cache[key] = out;
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cmdCitiesPhoton() {
  const cities = extractUniqueCitiesFromSeed();
  const cache = readJsonSafe(CITY_CACHE, {});
  let ok = 0;
  let fail = 0;
  for (const city of cities) {
    try {
      if (cache[city] === undefined) {
        const r = await photonCityCenter(city, cache);
        if (r) ok += 1;
        else fail += 1;
        writeJson(CITY_CACHE, cache);
        await sleep(180);
      } else if (cache[city]) ok += 1;
      else fail += 1;
    } catch (e) {
      console.error(city, e.message);
      cache[city] = null;
      writeJson(CITY_CACHE, cache);
      fail += 1;
      await sleep(400);
    }
  }
  const entries = Object.entries(cache).filter(([, v]) => v && typeof v.lat === "number");
  const body = entries
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([k, v]) => `  ${JSON.stringify(k)}: { lat: ${v.lat}, lng: ${v.lng} },`)
    .join("\n");
  const ts = `/**\n * Центры населённых пунктов (Photon komoot.io, offline build).\n * Не редактировать вручную — пересборка: node scripts/geocode-release-client-addresses.mjs --cities-photon\n */\nexport const RUSSIAN_CITY_CENTERS: Record<string, { lat: number; lng: number }> = {\n${body}\n};\n`;
  fs.writeFileSync(OUT_CITY, ts, "utf8");
  console.log("Wrote", OUT_CITY, "entries", entries.length, "resolved ok~", ok, "fail", fail);
}

function cmdDryRun() {
  const cities = extractUniqueCitiesFromSeed();
  const clientRows = extractClientRowsFromSeed();
  const addressRows = clientRows.filter((r) => String(r.city || "").trim() && String(r.address || "").trim());
  console.log("Seed cities:", cities.length);
  console.log("Rows with city+address:", addressRows.length);
  console.log("Photon city cache entries:", Object.keys(readJsonSafe(CITY_CACHE, {})).length);
  console.log("Address geocode cache keys:", Object.keys(readJsonSafe(GEOCODE_CACHE, {})).length);
  if (fs.existsSync(DEFAULT_ADDR_CSV)) {
    const lines = fs.readFileSync(DEFAULT_ADDR_CSV, "utf8").trim().split("\n").filter(Boolean);
    console.log("Address CSV lines:", lines.length - 1);
  } else console.log("No address CSV at", DEFAULT_ADDR_CSV);
  console.log("\nИмпорт адресов: --import-address-csv (см. data/release-client-address-coordinates.csv).");
  console.log("Города (Photon): --cities-photon. Адреса (Photon, offline cache): --geocode-addresses.");
}

async function cmdGeocodeAddresses() {
  const rows = extractClientRowsFromSeed().filter((r) => String(r.city || "").trim() && String(r.address || "").trim());
  const cityCentersText = fs.readFileSync(OUT_CITY, "utf8");
  const cityCenters = {};
  const re = /"((?:[^"\\]|\\.)*)": \{ lat: ([\d.-]+), lng: ([\d.-]+) \}/g;
  let m;
  while ((m = re.exec(cityCentersText))) {
    cityCenters[JSON.parse(`"${m[1]}"`)] = { lat: Number(m[2]), lng: Number(m[3]) };
  }
  const cache = readJsonSafe(GEOCODE_CACHE, {});
  const accepted = [];
  let missingCity = 0;
  let notFound = 0;
  let tooFar = 0;
  let requested = 0;
  for (const row of rows) {
    const city = String(row.city || "").trim();
    const center = cityCenters[city];
    if (!center) {
      missingCity += 1;
      continue;
    }
    try {
      const hit = await photonAddress(row, cache);
      if (!hit) {
        notFound += 1;
      } else {
        const d = haversineKm(center.lat, center.lng, hit.lat, hit.lng);
        if (d <= 80) accepted.push({ id: row.id, lat: hit.lat, lng: hit.lng });
        else tooFar += 1;
      }
      requested += 1;
      if (requested % 50 === 0) {
        writeJson(GEOCODE_CACHE, cache);
        console.log("processed", requested, "accepted", accepted.length, "notFound", notFound, "tooFar", tooFar);
      }
      await sleep(220);
    } catch (e) {
      notFound += 1;
      console.error(row.id, e.message);
      await sleep(500);
    }
  }
  writeJson(GEOCODE_CACHE, cache);
  const csv = ["clientId,lat,lng", ...accepted.map((r) => `${r.id},${r.lat},${r.lng}`)].join("\n") + "\n";
  fs.writeFileSync(DEFAULT_ADDR_CSV, csv, "utf8");
  cmdImportAddressCsv(DEFAULT_ADDR_CSV);
  console.log("Address geocode done:", { rows: rows.length, accepted: accepted.length, notFound, tooFar, missingCity });
}

function parseCsvLine(line) {
  const parts = line.split(",").map((s) => s.trim());
  return parts;
}

function cmdImportAddressCsv(csvPath = DEFAULT_ADDR_CSV) {
  if (!fs.existsSync(csvPath)) {
    console.error("CSV not found:", csvPath);
    process.exit(1);
  }
  const lines = fs.readFileSync(csvPath, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  const header = lines[0].toLowerCase();
  if (!header.includes("clientid") || !header.includes("lat")) {
    console.error("Expected header: clientId,lat,lng");
    process.exit(1);
  }
  const rec = {};
  for (let i = 1; i < lines.length; i++) {
    const [id, la, ln] = parseCsvLine(lines[i]);
    if (!id) continue;
    const lat = Number(la);
    const lng = Number(ln);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    rec[id] = { lat, lng, source: "address" };
  }
  const body = Object.entries(rec)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${JSON.stringify(k)}: { lat: ${v.lat}, lng: ${v.lng}, source: "address" as const },`)
    .join("\n");
  const ts = `/**\n * Координаты по адресу клиента (импорт CSV).\n * Генерация: node scripts/geocode-release-client-addresses.mjs --import-address-csv\n */\nexport type ReleaseClientAddressCoordinateEntry = { lat: number; lng: number; source: "address" };\n\nexport const RELEASE_CLIENT_ADDRESS_COORDINATES: Record<string, ReleaseClientAddressCoordinateEntry> = {\n${body}\n};\n`;
  fs.writeFileSync(OUT_ADDR, ts, "utf8");
  console.log("Wrote", OUT_ADDR, "count", Object.keys(rec).length);
}

function cmdImportCityCsv(csvPath = DEFAULT_CITY_CSV) {
  if (!fs.existsSync(csvPath)) {
    console.error("City CSV not found:", csvPath);
    process.exit(1);
  }
  const lines = fs.readFileSync(csvPath, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  const header = lines[0].toLowerCase();
  if (!header.includes("city") || !header.includes("lat")) {
    console.error("Expected header: city,lat,lng");
    process.exit(1);
  }
  const rec = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((s) => s.trim());
    if (parts.length < 3) continue;
    const lat = Number(parts[parts.length - 2]);
    const lng = Number(parts[parts.length - 1]);
    const city = parts.slice(0, -2).join(",").replace(/^"|"$/g, "");
    if (!city || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    rec[city] = { lat, lng };
  }
  const body = Object.entries(rec)
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([k, v]) => `  ${JSON.stringify(k)}: { lat: ${v.lat}, lng: ${v.lng} },`)
    .join("\n");
  const ts = `/**\n * Проверенные координаты центра города (импорт CSV).\n * Генерация: node scripts/geocode-release-client-addresses.mjs --import-city-csv\n */\nexport const RUSSIAN_CITY_CENTERS: Record<string, { lat: number; lng: number }> = {\n${body}\n};\n`;
  fs.writeFileSync(OUT_CITY, ts, "utf8");
  console.log("Wrote", OUT_CITY, "count", Object.keys(rec).length);
}

function ensureEmptyAddressOut() {
  if (!fs.existsSync(OUT_ADDR)) {
    const ts = `/**\n * Координаты по адресу клиента. Пусто до импорта CSV или геокодинга.\n * Генерация: node scripts/geocode-release-client-addresses.mjs --import-address-csv\n */\nexport type ReleaseClientAddressCoordinateEntry = { lat: number; lng: number; source: "address" };\n\nexport const RELEASE_CLIENT_ADDRESS_COORDINATES: Record<string, ReleaseClientAddressCoordinateEntry> = {};\n`;
    fs.writeFileSync(OUT_ADDR, ts, "utf8");
  }
}

const argv = process.argv.slice(2);
const cmd = argv[0];

if (cmd === "--dry-run") {
  cmdDryRun();
} else if (cmd === "--cities-photon") {
  ensureEmptyAddressOut();
  await cmdCitiesPhoton();
} else if (cmd === "--import-address-csv") {
  cmdImportAddressCsv(argv[1] || DEFAULT_ADDR_CSV);
} else if (cmd === "--import-city-csv") {
  cmdImportCityCsv(argv[1] || DEFAULT_CITY_CSV);
} else if (cmd === "--geocode-addresses") {
  await cmdGeocodeAddresses();
} else {
  console.log(`Usage:
  node scripts/geocode-release-client-addresses.mjs --dry-run
  node scripts/geocode-release-client-addresses.mjs --cities-photon
  node scripts/geocode-release-client-addresses.mjs --import-address-csv [csv]
  node scripts/geocode-release-client-addresses.mjs --import-city-csv [csv]
  node scripts/geocode-release-client-addresses.mjs --geocode-addresses
`);
  process.exit(cmd ? 1 : 0);
}
