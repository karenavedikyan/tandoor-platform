#!/usr/bin/env node
/**
 * Импорт клиентов менеджера Котеневой А.В. → release-client-seed-koteneva.generated.ts
 *
 * Источники (по приоритету, если указан --from-master-slice — он первый):
 * 1) --from-master-slice=N — 117 подряд строк из release-client-seed.generated.ts (только dev/CI без Excel)
 * 2) apps/platform/data/Spisok-klientov_Koteneva-A.xlsx (лист «Лист2»)
 * 3) apps/platform/data/koteneva-clients.source.json — массив или { "rows": [...] } с полями как в Excel
 *
 * Импортный отчёт (целевые значения для файла Котеневой):
 * - всего 117; закрытых 21; без адреса 39; дублей по коду 0
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_XLSX = path.join(ROOT, "data", "Spisok-klientov_Koteneva-A.xlsx");
const DEFAULT_JSON = path.join(ROOT, "data", "koteneva-clients.source.json");
const MASTER_SEED_TS = path.join(ROOT, "client", "src", "lib", "release-client-seed.generated.ts");
const OUT_TS = path.join(ROOT, "client", "src", "lib", "release-client-seed-koteneva.generated.ts");

const MANAGER_ID = "mgr-koteneva-av";
const MANAGER_NAME = "Котенева Анастасия Валерьевна";
const ROP_NAME = "Сапожков Артем";
const TEAM_ID = "team-sapozhkov";
const KOTENEVA_COUNT = 117;

function norm(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/ё/g, "е");
}

function normalizeCodeForId(code) {
  const c = norm(code).replace(/[^a-z0-9а-яё-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return c || "";
}

function uniqueId(baseId, usedIds) {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }
  let n = 2;
  while (usedIds.has(`${baseId}-dup-${n}`)) n += 1;
  const id = `${baseId}-dup-${n}`;
  usedIds.add(id);
  return id;
}

function classifyClientType(raw) {
  const s = String(raw ?? "").trim();
  const n = norm(s);
  let normalizedClientType = "unknown";
  let isClosed = false;
  let isPriority = false;
  let isActive = true;

  if (!n) {
    normalizedClientType = "unknown";
    isActive = true;
  } else if (n.includes("закрыт")) {
    normalizedClientType = "closed";
    isClosed = true;
    isActive = false;
  } else if (n.includes("объемообраз")) {
    normalizedClientType = "volume";
    isPriority = true;
  } else if (n.includes("топ") && n.includes("150")) {
    normalizedClientType = "top150";
    isPriority = true;
  } else if (n.includes("топ") && n.includes("350")) {
    normalizedClientType = "top350";
    isPriority = true;
  } else if (n.includes("топ") && n.includes("500")) {
    normalizedClientType = "top500";
    isPriority = true;
  } else if (n.includes("активн")) {
    normalizedClientType = "active";
  } else if (n.includes("потенциал")) {
    normalizedClientType = "potential";
  } else if (n.includes("нецелев")) {
    normalizedClientType = "nonTarget";
    isActive = false;
  } else {
    normalizedClientType = "unknown";
  }

  return { clientType: s || "", normalizedClientType, isClosed, isPriority, isActive };
}

/** Несколько адресов: ; | перевод строки | повтор индекса 6 цифр. */
function splitAddressSegments(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return [];
  const byDelim = t
    .split(/\s*(?:;|\||\n{2,})\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (byDelim.length > 1) return byDelim;
  const idxMatches = [...t.matchAll(/\b\d{6}\b/g)];
  if (idxMatches.length >= 2) {
    const parts = [];
    for (let i = 0; i < idxMatches.length; i++) {
      const start = idxMatches[i].index;
      const end = i + 1 < idxMatches.length ? idxMatches[i + 1].index : t.length;
      parts.push(t.slice(start, end).trim());
    }
    return parts.filter(Boolean);
  }
  return [t];
}

function guessCityFromAddressSegment(seg, fallbackCity) {
  const m = seg.match(/г\.\s*([^,]+)/i);
  if (m) return m[1].trim();
  const parts = seg.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^ул\.|^пр\.|^просп\.|^д\.|^дом/i.test(last)) return parts[parts.length - 2] ?? fallbackCity;
  }
  return fallbackCity;
}

function buildParsedTradePoints(addressRaw, cityFallback) {
  const segs = splitAddressSegments(addressRaw);
  if (segs.length <= 1) return undefined;
  return segs.map((address, i) => ({
    name: `Торговая точка ${i + 1}`,
    city: guessCityFromAddressSegment(address, cityFallback),
    address,
  }));
}

function buildSearchText(row) {
  return [row.name, row.city, row.code, row.ropName, row.managerName, row.address, row.clientType, row.id]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase())
    .join(" | ");
}

function buildRowFromFields(fields, usedIds, opts = {}) {
  const name = String(fields.name ?? "").trim();
  const city = String(fields.city ?? "").trim();
  const code = String(fields.code ?? "").trim();
  const address = String(fields.address ?? "").trim();
  const clientTypeRaw = String(fields.clientType ?? "").trim();
  const cls = classifyClientType(clientTypeRaw);
  const parsedTradePoints = buildParsedTradePoints(address, city || "—");

  let id = opts.preferredId ? String(opts.preferredId).trim() : "";
  if (id) {
    if (usedIds.has(id)) {
      const idSlug = normalizeCodeForId(code);
      const baseId = idSlug ? `client-${idSlug}` : `client-kv-row-${usedIds.size + 1}`;
      id = uniqueId(baseId, usedIds);
    } else {
      usedIds.add(id);
    }
  } else {
    const idSlug = normalizeCodeForId(code);
    const baseId = idSlug ? `client-${idSlug}` : `client-kv-row-${usedIds.size + 1}`;
    id = uniqueId(baseId, usedIds);
  }

  const row = {
    id,
    code,
    name,
    city: city || "—",
    address,
    ropName: ROP_NAME,
    managerName: MANAGER_NAME,
    teamId: TEAM_ID,
    managerId: MANAGER_ID,
    clientType: cls.clientType,
    normalizedClientType: cls.normalizedClientType,
    isClosed: cls.isClosed,
    isPriority: cls.isPriority,
    isActive: cls.isActive,
    searchText: "",
    parsedTradePoints,
  };
  row.searchText = buildSearchText(row);
  return row;
}

function readXlsxRows() {
  if (!fs.existsSync(DEFAULT_XLSX)) {
    throw new Error(`Файл не найден: ${DEFAULT_XLSX}`);
  }
  const buf = fs.readFileSync(DEFAULT_XLSX);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames.includes("Лист2") ? "Лист2" : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!matrix.length) return { rows: [], sheetName, report: null };

  const header = matrix[0].map((c) => norm(c));
  const col = (labels) => {
    for (const lab of labels) {
      const idx = header.findIndex((h) => h === norm(lab) || h.includes(norm(lab)));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const cName = col(["наименование"]);
  const cCity = col(["населенный пункт", "город"]);
  const cCode = col(["код"]);
  const cAddr = col(["адрес"]);
  const cType = col(["тип клиента"]);

  if (cName < 0) {
    throw new Error(`Не удалось сопоставить колонку «Наименование». Заголовки: ${JSON.stringify(matrix[0])}`);
  }

  const rows = [];
  const usedIds = new Set();
  const usedCodes = new Set();
  let dupCodes = 0;

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    const name = String(line[cName] ?? "").trim();
    if (!name) continue;
    const city = String(line[cCity >= 0 ? cCity : -1] ?? "").trim();
    const code = String(line[cCode >= 0 ? cCode : -1] ?? "").trim();
    const address = String(line[cAddr >= 0 ? cAddr : -1] ?? "").trim();
    const clientTypeRaw = String(line[cType >= 0 ? cType : -1] ?? "").trim();
    if (code && usedCodes.has(code)) dupCodes += 1;
    if (code) usedCodes.add(code);

    const row = buildRowFromFields(
      { name, city, code, address, clientType: clientTypeRaw },
      usedIds,
    );
    rows.push(row);
  }

  const closed = rows.filter((x) => x.isClosed).length;
  const noAddr = rows.filter((x) => !String(x.address ?? "").trim()).length;
  const noType = rows.filter((x) => !String(x.clientType ?? "").trim()).length;
  const report = { total: rows.length, closed, noAddr, noType, dupCodes, sheetName };
  return { rows, sheetName, report };
}

function readJsonRows(jsonPath) {
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.rows;
  if (!Array.isArray(list)) {
    throw new Error(`JSON ${jsonPath}: ожидается массив или { "rows": [...] }`);
  }
  const rows = [];
  const usedIds = new Set();
  const usedCodes = new Set();
  let dupCodes = 0;
  for (const item of list) {
    const name = String(item.name ?? "").trim();
    if (!name) continue;
    const code = String(item.code ?? "").trim();
    if (code && usedCodes.has(code)) dupCodes += 1;
    if (code) usedCodes.add(code);
    const row = buildRowFromFields(
      {
        name,
        city: item.city,
        code,
        address: item.address,
        clientType: item.clientType ?? item["Тип клиента"],
      },
      usedIds,
      item.id ? { preferredId: item.id } : {},
    );
    rows.push(row);
  }
  const closed = rows.filter((x) => x.isClosed).length;
  const noAddr = rows.filter((x) => !String(x.address ?? "").trim()).length;
  const noType = rows.filter((x) => !String(x.clientType ?? "").trim()).length;
  const report = { total: rows.length, closed, noAddr, noType, dupCodes, sheetName: path.basename(jsonPath) };
  return { rows, sheetName: path.basename(jsonPath), report };
}

function parseMasterReleaseRows() {
  const s = fs.readFileSync(MASTER_SEED_TS, "utf8");
  const m = s.match(/export const RELEASE_CLIENT_ROWS: ReleaseClientSeedRow\[\] = (\[[\s\S]*?\]) as ReleaseClientSeedRow\[\]/);
  if (!m) throw new Error("Не удалось извлечь JSON из release-client-seed.generated.ts");
  return JSON.parse(m[1]);
}

function readMasterSlice(startIndex) {
  const all = parseMasterReleaseRows();
  const slice = all.slice(startIndex, startIndex + KOTENEVA_COUNT);
  if (slice.length !== KOTENEVA_COUNT) {
    throw new Error(`Ожидалось ${KOTENEVA_COUNT} строк, получено ${slice.length} (start=${startIndex})`);
  }
  const rows = [];
  const usedIds = new Set();
  const usedCodes = new Set();
  let dupCodes = 0;
  for (const src of slice) {
    const code = String(src.code ?? "").trim();
    if (code && usedCodes.has(code)) dupCodes += 1;
    if (code) usedCodes.add(code);
    const row = buildRowFromFields(
      {
        name: src.name,
        city: src.city,
        code,
        address: src.address,
        clientType: src.clientType,
      },
      usedIds,
      { preferredId: src.id },
    );
    rows.push(row);
  }
  const closed = rows.filter((x) => x.isClosed).length;
  const noAddr = rows.filter((x) => !String(x.address ?? "").trim()).length;
  const noType = rows.filter((x) => !String(x.clientType ?? "").trim()).length;
  const report = { total: rows.length, closed, noAddr, noType, dupCodes, sheetName: `master-slice@${startIndex}` };
  return { rows, sheetName: `master-slice@${startIndex}`, report };
}

function writeTs(rows, meta) {
  const closed = rows.filter((x) => x.isClosed).length;
  const noAddr = rows.filter((x) => !String(x.address ?? "").trim()).length;
  const noType = rows.filter((x) => !String(x.clientType ?? "").trim()).length;
  const multiTp = rows.filter((x) => x.parsedTradePoints && x.parsedTradePoints.length > 1).length;

  const banner = `/**
 * Автогенерация: scripts/import-koteneva-clients.mjs
 * Менеджер: ${MANAGER_NAME} (${MANAGER_ID}), команда: ${TEAM_ID}, РОП: ${ROP_NAME}
 *
 * Импортный отчёт:
 * - всего импортировано: ${rows.length}
 * - закрытых: ${closed}
 * - без адреса: ${noAddr}
 * - без типа: ${noType}
 * - дублей по коду: ${meta.dupCodes ?? 0}
 * - строк с несколькими торговыми точками (parsedTradePoints): ${multiTp}
 *
 * Источник: ${meta.source}
 * Лист: ${meta.sheetName ?? "—"}
 * Сгенерировано: ${meta.generatedAt}
 */

`;

  const payload = JSON.stringify(rows);
  const body = `export type ReleaseClientNormalizedType =
  | "volume"
  | "top150"
  | "top350"
  | "top500"
  | "active"
  | "potential"
  | "closed"
  | "unknown"
  | "nonTarget";

export type KotenevaTradePointStop = {
  name: string;
  city: string;
  address: string;
};

export type ReleaseClientKotenevaSeedRow = {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  ropName: string;
  managerName: string;
  teamId: string;
  managerId: string;
  clientType: string;
  normalizedClientType: ReleaseClientNormalizedType;
  isClosed: boolean;
  isPriority: boolean;
  isActive: boolean;
  searchText: string;
  parsedTradePoints?: KotenevaTradePointStop[];
};

export const RELEASE_CLIENT_KOTENEVA_SEED_META = ${JSON.stringify({
    ...meta,
    importReport: { total: rows.length, closed, noAddr, noType, dupCodes: meta.dupCodes ?? 0, multiTradePoints: multiTp },
  })} as const;

export const RELEASE_CLIENT_ROWS_KOTENEVA: ReleaseClientKotenevaSeedRow[] = ${payload} as ReleaseClientKotenevaSeedRow[];
`;

  fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });
  const tmp = `${OUT_TS}.tmp`;
  fs.writeFileSync(tmp, banner + body, "utf8");
  fs.renameSync(tmp, OUT_TS);
}

const argv = process.argv.slice(2);
const sliceArg = argv.find((a) => a.startsWith("--from-master-slice="));
const sliceStart = sliceArg ? Number.parseInt(sliceArg.split("=")[1], 10) : NaN;
const generatedAt = new Date().toISOString();

try {
  let pack;
  let meta;

  if (!Number.isNaN(sliceStart)) {
    pack = readMasterSlice(sliceStart);
    meta = {
      source: `seed-slice:release-client-seed.generated.ts#${sliceStart}`,
      sheetName: pack.sheetName,
      generatedAt,
      dupCodes: pack.report.dupCodes,
    };
  } else if (fs.existsSync(DEFAULT_XLSX)) {
    pack = readXlsxRows();
    meta = {
      source: `xlsx:${path.relative(ROOT, DEFAULT_XLSX)}`,
      sheetName: pack.sheetName,
      generatedAt,
      dupCodes: pack.report?.dupCodes ?? 0,
    };
  } else if (fs.existsSync(DEFAULT_JSON)) {
    pack = readJsonRows(DEFAULT_JSON);
    meta = {
      source: `json:${path.relative(ROOT, DEFAULT_JSON)}`,
      sheetName: pack.sheetName,
      generatedAt,
      dupCodes: pack.report.dupCodes,
    };
  } else {
    console.error(`Нет источника данных для импорта Котеневой. Укажите один из вариантов:
  • Положите Excel: ${DEFAULT_XLSX}
  • Или JSON (экспорт из Excel): ${DEFAULT_JSON}
  • Или только для окружения без файла: node scripts/import-koteneva-clients.mjs --from-master-slice=1981
    (это НЕ список из файла Котеневой — см. README-koteneva-import.md)`);
    process.exit(1);
  }

  writeTs(pack.rows, meta);
  const multiTp = pack.rows.filter((x) => x.parsedTradePoints && x.parsedTradePoints.length > 1).length;
  const tradePointsTotal = pack.rows.reduce((acc, r) => acc + (r.parsedTradePoints?.length ?? (r.address?.trim() ? 1 : 0)), 0);
  console.log("Koteneva import report:", pack.report);
  console.log(`Торговых точек (сумма по клиентам): ${tradePointsTotal}; сегментов с 2+ ТТ: ${multiTp}`);
  console.log(`Wrote ${pack.rows.length} rows → ${OUT_TS}`);
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
