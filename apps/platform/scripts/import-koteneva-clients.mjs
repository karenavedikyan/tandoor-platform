#!/usr/bin/env node
/**
 * Импорт клиентов менеджера Котеневой А.В. из Excel (Лист2) → release-client-seed-koteneva.generated.ts
 *
 * Файл по умолчанию: apps/platform/data/Spisok-klientov_Koteneva-A.xlsx
 * Запуск без файла (CI / до добавления xlsx): --synthetic-koteneva
 *
 * Импортный отчёт (ожидаемые цифры для реального файла; для synthetic — совпадают по построению):
 * - всего 117
 * - закрытых 21
 * - без адреса 39
 * - без типа 24
 * - дублей по коду 0
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_XLSX = path.join(ROOT, "data", "Spisok-klientov_Koteneva-A.xlsx");
const OUT_TS = path.join(ROOT, "client", "src", "lib", "release-client-seed-koteneva.generated.ts");

const MANAGER_ID = "mgr-koteneva-av";
const MANAGER_NAME = "Котенева Анастасия Валерьевна";
const ROP_NAME = "Сапожков Артем";
const TEAM_ID = "team-sapozhkov";

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
function splitAddressSegments(raw, fallbackCity) {
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
  const segs = splitAddressSegments(addressRaw, cityFallback);
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
  const cRop = col(["роп"]);
  const cMgr = col(["ответственный менеджер тандор", "менеджер тандор", "ответственный менеджер"]);
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
    const ropName = cRop >= 0 ? String(line[cRop] ?? "").trim() || ROP_NAME : ROP_NAME;
    const managerName = cMgr >= 0 ? String(line[cMgr] ?? "").trim() || MANAGER_NAME : MANAGER_NAME;
    const address = String(line[cAddr >= 0 ? cAddr : -1] ?? "").trim();
    const clientTypeRaw = String(line[cType >= 0 ? cType : -1] ?? "").trim();
    if (code && usedCodes.has(code)) dupCodes += 1;
    if (code) usedCodes.add(code);

    const cls = classifyClientType(clientTypeRaw);
    const idSlug = normalizeCodeForId(code);
    const baseId = idSlug ? `client-${idSlug}` : `client-kv-row-${rows.length + 1}`;
    const id = uniqueId(baseId, usedIds);
    const parsedTradePoints = buildParsedTradePoints(address, city || "—");

    const row = {
      id,
      code,
      name,
      city: city || "—",
      address,
      ropName,
      managerName,
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
    rows.push(row);
  }

  const closed = rows.filter((x) => x.isClosed).length;
  const noAddr = rows.filter((x) => !String(x.address ?? "").trim()).length;
  const noType = rows.filter((x) => !String(x.clientType ?? "").trim()).length;
  const report = { total: rows.length, closed, noAddr, noType, dupCodes, sheetName };
  return { rows, sheetName, report };
}

function buildSyntheticKoteneva117() {
  const rows = [];
  const usedIds = new Set();
  const types = [
    "ТОП 150",
    "ТОП 350",
    "ТОП 500",
    "Активный",
    "Потенциальный",
    "Объемообразующий",
    "ТОП 150",
  ];

  for (let i = 0; i < 117; i++) {
    const isClosedSlot = i < 21;
    const noAddr = !isClosedSlot && i >= 21 && i < 60;
    const noType = i >= 60 && i < 84;
    const clientTypeRaw = isClosedSlot ? "Закрытый" : noType ? "" : types[i % types.length];
    const cls = classifyClientType(clientTypeRaw);
    const code = `KV${String(10001 + i).slice(-5)}`;
    const idSlug = normalizeCodeForId(code);
    const id = uniqueId(`client-${idSlug}`, usedIds);
    const city = noAddr ? "Краснодар" : ["Краснодар", "Ростов-на-Дону", "Сочи", "Ставрополь"][i % 4];
    let address = "";
    let parsedTradePoints = undefined;
    if (!noAddr) {
      if (i % 17 === 0) {
        address = `350020, Краснодарский край, г. Краснодар, ул. Примерная, д. ${i}; 350051, Краснодарский край, г. Краснодар, ул. Вторая, д. ${i + 1}`;
        parsedTradePoints = buildParsedTradePoints(address, city);
      } else {
        address = `3500${(10 + (i % 80)).toString().padStart(2, "0")}, ${city}, ул. Импортная, д. ${i + 1}`;
      }
    }
    const name = `Клиент импорта Котеневой №${i + 1}`;
    const row = {
      id,
      code,
      name,
      city,
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
    rows.push(row);
  }

  const closed = rows.filter((x) => x.isClosed).length;
  const noAddr = rows.filter((x) => !String(x.address ?? "").trim()).length;
  const noType = rows.filter((x) => !String(x.clientType ?? "").trim()).length;
  const report = { total: rows.length, closed, noAddr, noType, dupCodes: 0, sheetName: "synthetic" };
  return { rows, report };
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

const synthetic = process.argv.includes("--synthetic-koteneva");
const generatedAt = new Date().toISOString();

if (synthetic) {
  const { rows, report } = buildSyntheticKoteneva117();
  writeTs(rows, {
    source: "synthetic-koteneva-117",
    sheetName: report.sheetName,
    generatedAt,
    dupCodes: report.dupCodes,
  });
  console.log("Synthetic Koteneva:", report);
  console.log(`Wrote ${rows.length} rows → ${OUT_TS}`);
  process.exit(0);
}

try {
  const { rows, sheetName, report } = readXlsxRows();
  writeTs(rows, {
    source: `xlsx:${path.relative(ROOT, DEFAULT_XLSX)}`,
    sheetName,
    generatedAt,
    dupCodes: report?.dupCodes ?? 0,
  });
  console.log("Excel Koteneva:", report);
  console.log(`Wrote ${rows.length} rows → ${OUT_TS}`);
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
