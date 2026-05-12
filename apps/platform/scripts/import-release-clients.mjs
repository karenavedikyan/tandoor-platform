#!/usr/bin/env node
/**
 * Импорт клиентов Release 1 из Excel (Spisok-klientov-dlia-Karena.xlsx) в TypeScript seed.
 *
 * Пути по умолчанию:
 *   apps/platform/data/Spisok-klientov-dlia-Karena.xlsx
 *   apps/platform/client/src/lib/release-client-seed.generated.ts
 *
 * Режим без файла (CI / демо объёма 2743 строки):
 *   node scripts/import-release-clients.mjs --synthetic
 *
 * Зависимость: xlsx (devDependency).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_XLSX = path.join(ROOT, "data", "Spisok-klientov-dlia-Karena.xlsx");
const OUT_TS = path.join(ROOT, "client", "src", "lib", "release-client-seed.generated.ts");

const SYNTHETIC_COUNT = 2743;

const ROP_DISPLAY = {
  "team-kupiansky": "Купянский Родион",
  "team-skalaban": "Скалабан Александр",
  "team-sapozhkov": "Сапожков Артем",
};

/** Порядок: id, teamId, подстроки для сопоставления «Ответственный менеджер тандор» (нормализованная строка). */
const MANAGER_RULES = [
  { id: "mgr-boyko-em", teamId: "team-kupiansky", needles: ["бойко", "екатерина"], alt: ["бойко", "катерина"] },
  { id: "mgr-yakubova-ys", teamId: "team-kupiansky", needles: ["якубова", "сергеевна"] },
  { id: "mgr-fedorov-dv", teamId: "team-kupiansky", needles: ["федоров", "данил"] },
  { id: "mgr-ponkratova-vv", teamId: "team-kupiansky", needles: ["понкратова", "василиса"] },
  { id: "mgr-avetisyan-rs", teamId: "team-kupiansky", needles: ["аветисян", "рачик"] },
  { id: "mgr-sklyarov-dv", teamId: "team-kupiansky", needles: ["скляров", "давид"] },
  { id: "mgr-orlov-dv", teamId: "team-kupiansky", needles: ["орлов", "денис", "валерьевич"] },
  { id: "mgr-agadzhanyan-rs", teamId: "team-skalaban", needles: ["агаджанян", "родион"] },
  { id: "mgr-doronina-iv", teamId: "team-skalaban", needles: ["доронина", "ирина"] },
  { id: "mgr-ilyuchenko-an", teamId: "team-skalaban", needles: ["илюченко", "александр"] },
  { id: "mgr-miroshnichenko-dn", teamId: "team-skalaban", needles: ["мирошниченко", "денис"] },
  { id: "mgr-lysenko-eg", teamId: "team-skalaban", needles: ["лысенко", "екатерина"] },
  { id: "mgr-kulakova-os", teamId: "team-skalaban", needles: ["кулакова", "олеся"] },
  { id: "mgr-yakubova-voronezh", teamId: "team-skalaban", needles: ["якубова", "воронеж"] },
  { id: "mgr-koteneva-a", teamId: "team-sapozhkov", needles: ["котенева", "анастасия"] },
  { id: "mgr-netkacheva-ia", teamId: "team-sapozhkov", needles: ["неткачева", "инна"] },
  { id: "mgr-petrichenko-ev", teamId: "team-sapozhkov", needles: ["петриченко", "елена"] },
  { id: "mgr-arutyunyan-oa", teamId: "team-sapozhkov", needles: ["арутюнян", "оганес"] },
  { id: "mgr-osmanov-fm", teamId: "team-sapozhkov", needles: ["османов", "фарид"] },
  { id: "mgr-chernousova-in", teamId: "team-sapozhkov", needles: ["черноусова", "ия"] },
  { id: "mgr-yarysh-si", teamId: "team-sapozhkov", needles: ["ярыш", "сергей"] },
];

const MANAGER_DISPLAY_NAME = {
  "mgr-boyko-em": "Бойко Екатерина Михайловна",
  "mgr-yakubova-ys": "Якубова Юлия Сергеевна",
  "mgr-fedorov-dv": "Федоров Данил Владимирович",
  "mgr-ponkratova-vv": "Понкратова Василиса Владимировна",
  "mgr-avetisyan-rs": "Аветисян Рачик Сергеевич",
  "mgr-sklyarov-dv": "Скляров Давид Владимирович",
  "mgr-orlov-dv": "Орлов Денис Валерьевич",
  "mgr-agadzhanyan-rs": "Агаджанян Родион Самвелович",
  "mgr-doronina-iv": "Доронина Ирина Васильевна (Опт)",
  "mgr-ilyuchenko-an": "Илюченко Александр Николаевич",
  "mgr-miroshnichenko-dn": "Мирошниченко Денис Николаевич",
  "mgr-lysenko-eg": "Лысенко Екатерина Геннадьевна",
  "mgr-kulakova-os": "Кулакова Олеся Сергеевна",
  "mgr-yakubova-voronezh": "Якубова Юлия (Воронеж)",
  "mgr-koteneva-a": "Котенева Анастасия",
  "mgr-netkacheva-ia": "Неткачева Инна Алексеевна",
  "mgr-petrichenko-ev": "Петриченко Елена Викторовна",
  "mgr-arutyunyan-oa": "Арутюнян Оганес Ашотович",
  "mgr-osmanov-fm": "Османов Фарид Магомедович",
  "mgr-chernousova-in": "Черноусова Ия Николаевна",
  "mgr-yarysh-si": "Ярыш Сергей Игоревич",
};

const MANAGERS_WITH_CLIENT_BASE = new Set([
  "mgr-boyko-em",
  "mgr-yakubova-ys",
  "mgr-fedorov-dv",
  "mgr-ponkratova-vv",
  "mgr-avetisyan-rs",
  "mgr-sklyarov-dv",
  "mgr-orlov-dv",
  "mgr-agadzhanyan-rs",
  "mgr-doronina-iv",
  "mgr-ilyuchenko-an",
  "mgr-miroshnichenko-dn",
  "mgr-lysenko-eg",
  "mgr-kulakova-os",
  "mgr-netkacheva-ia",
  "mgr-petrichenko-ev",
  "mgr-arutyunyan-oa",
  "mgr-osmanov-fm",
  "mgr-chernousova-in",
  "mgr-yarysh-si",
]);

const SYNTH_TEAM_ORDER = ["team-kupiansky", "team-skalaban", "team-sapozhkov"];

const SYNTH_MANAGERS_BY_TEAM = {
  "team-kupiansky": Array.from(MANAGERS_WITH_CLIENT_BASE).filter((id) => MANAGER_RULES.find((r) => r.id === id)?.teamId === "team-kupiansky"),
  "team-skalaban": Array.from(MANAGERS_WITH_CLIENT_BASE).filter((id) => MANAGER_RULES.find((r) => r.id === id)?.teamId === "team-skalaban"),
  "team-sapozhkov": Array.from(MANAGERS_WITH_CLIENT_BASE).filter((id) => MANAGER_RULES.find((r) => r.id === id)?.teamId === "team-sapozhkov"),
};

const CITIES = [
  "Москва",
  "Санкт-Петербург",
  "Ростов-на-Дону",
  "Воронеж",
  "Краснодар",
  "Самара",
  "Казань",
  "Нижний Новгород",
  "Екатеринбург",
  "Новосибирск",
  "Тула",
  "Рязань",
  "Липецк",
  "Белгород",
  "Ставрополь",
];

const TYPE_WEIGHTS = [
  { t: "Активный", w: 22 },
  { t: "ТОП 150", w: 6 },
  { t: "ТОП 350", w: 10 },
  { t: "ТОП 500", w: 14 },
  { t: "Объемообразующий", w: 8 },
  { t: "Потенциальный", w: 18 },
  { t: "Закрытый", w: 5 },
  { t: "", w: 12 },
  { t: "Нецелевой клиент", w: 5 },
];

function norm(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/ё/g, "е");
}

/** РОП из файла → teamId (совпадает с sales-control-data). */
function resolveTeamFromRop(ropRaw) {
  const k = norm(ropRaw);
  if (k.includes("купянск")) return "team-kupiansky";
  if (k.includes("скалабан")) return "team-skalaban";
  if (k.includes("сапожков")) return "team-sapozhkov";
  return "team-kupiansky";
}

function normalizeCodeForId(code) {
  const c = norm(code).replace(/[^a-z0-9а-яё-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return c || "";
}

/** Возвращает baseId, либо `${baseId}-dup-N` при коллизии (Excel допускает повторы кода). */
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

function resolveManagerId(managerRaw, teamId) {
  const m = norm(managerRaw);
  if (!m) return { id: "", matched: false };
  for (const rule of MANAGER_RULES) {
    if (rule.teamId !== teamId) continue;
    const ok =
      rule.alt != null
        ? rule.alt.every((x) => m.includes(x)) || rule.needles.every((x) => m.includes(x))
        : rule.needles.every((x) => m.includes(x));
    if (ok) return { id: rule.id, matched: true };
  }
  return { id: "", matched: false };
}

function buildSearchText(row) {
  return [row.name, row.city, row.code, row.ropName, row.managerName, row.address, row.clientType, row.id]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase())
    .join(" | ");
}

function pickSyntheticType(seed) {
  let t = 0;
  for (const x of TYPE_WEIGHTS) t += x.w;
  let r = seed % t;
  for (const x of TYPE_WEIGHTS) {
    if (r < x.w) return x.t;
    r -= x.w;
  }
  return "";
}

function hash32(i) {
  let h = i ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

function buildSyntheticRows() {
  const rows = [];
  const usedIds = new Set();
  for (let i = 0; i < SYNTHETIC_COUNT; i++) {
    const h = hash32(i + 1);
    const teamId = SYNTH_TEAM_ORDER[i % SYNTH_TEAM_ORDER.length];
    const mgrList = SYNTH_MANAGERS_BY_TEAM[teamId];
    const managerId = mgrList[(i + Math.floor(i / 3)) % mgrList.length];
    const managerName = MANAGER_DISPLAY_NAME[managerId] ?? managerId;
    const ropName = ROP_DISPLAY[teamId] ?? "";
    const code = String(100000 + i);
    const city = CITIES[h % CITIES.length];
    const name = `Клиент пилота №${i + 1}`;
    const address = `ул. Примерная, д. ${(h % 120) + 1}`;
    const clientTypeRaw = pickSyntheticType(h);
    const cls = classifyClientType(clientTypeRaw);
    const idSlug = normalizeCodeForId(code);
    const baseId = idSlug ? `client-${idSlug}` : `client-row-${i + 1}`;
    const id = uniqueId(baseId, usedIds);
    rows.push({
      id,
      code,
      name,
      city,
      address,
      ropName,
      managerName,
      teamId,
      managerId,
      clientType: cls.clientType,
      normalizedClientType: cls.normalizedClientType,
      isClosed: cls.isClosed,
      isPriority: cls.isPriority,
      isActive: cls.isActive,
      searchText: "",
    });
  }
  for (const r of rows) {
    r.searchText = buildSearchText(r);
  }
  return rows;
}

function readXlsxRows() {
  if (!fs.existsSync(DEFAULT_XLSX)) {
    throw new Error(`Файл не найден: ${DEFAULT_XLSX}. Положите Spisok-klientov-dlia-Karena.xlsx в apps/platform/data/ или запустите с --synthetic.`);
  }
  const buf = fs.readFileSync(DEFAULT_XLSX);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!matrix.length) return { rows: [], sheetName, unmappedManagers: 0 };

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

  if (cName < 0 || cRop < 0 || cMgr < 0) {
    throw new Error(`Не удалось сопоставить колонки. Заголовки: ${JSON.stringify(matrix[0])}`);
  }

  const rows = [];
  const usedIds = new Set();
  let unmappedManagers = 0;
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    const name = String(line[cName] ?? "").trim();
    if (!name) continue;
    const city = String(line[cCity >= 0 ? cCity : -1] ?? "").trim();
    const code = String(line[cCode >= 0 ? cCode : -1] ?? "").trim();
    const ropName = String(line[cRop] ?? "").trim();
    const managerName = String(line[cMgr] ?? "").trim();
    const address = String(line[cAddr >= 0 ? cAddr : -1] ?? "").trim();
    const clientTypeRaw = String(line[cType >= 0 ? cType : -1] ?? "").trim();
    const teamId = resolveTeamFromRop(ropName);
    let { id: managerId, matched } = resolveManagerId(managerName, teamId);
    if (!matched) {
      unmappedManagers += 1;
      managerId = `mgr-unmapped-${teamId}`;
    }
    const cls = classifyClientType(clientTypeRaw);
    const idSlug = normalizeCodeForId(code);
    const baseId = idSlug ? `client-${idSlug}` : `client-row-${rows.length + 1}`;
    const id = uniqueId(baseId, usedIds);
    const row = {
      id,
      code,
      name,
      city,
      address,
      ropName,
      managerName,
      teamId,
      managerId,
      clientType: cls.clientType,
      normalizedClientType: cls.normalizedClientType,
      isClosed: cls.isClosed,
      isPriority: cls.isPriority,
      isActive: cls.isActive,
      searchText: "",
    };
    row.searchText = buildSearchText(row);
    rows.push(row);
  }
  return { rows, sheetName, unmappedManagers };
}

function writeTs(rows, meta) {
  const payload = JSON.stringify(rows);
  const banner = `/**\n * Автогенерация: scripts/import-release-clients.mjs\n * Строк: ${rows.length}\n * Источник: ${meta.source}\n * Сгенерировано: ${meta.generatedAt}\n */\n\n`;
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

export type ReleaseClientSeedRow = {
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
};

export const RELEASE_CLIENT_SEED_META = ${JSON.stringify(meta)} as const;

export const RELEASE_CLIENT_ROWS: ReleaseClientSeedRow[] = ${payload} as ReleaseClientSeedRow[];
`;
  fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });
  const tmp = `${OUT_TS}.tmp`;
  fs.writeFileSync(tmp, banner + body, "utf8");
  fs.renameSync(tmp, OUT_TS);
}

const synthetic = process.argv.includes("--synthetic");
const generatedAt = new Date().toISOString();

if (synthetic) {
  const rows = buildSyntheticRows();
  writeTs(rows, {
    source: "synthetic-2743",
    generatedAt,
    rowCount: rows.length,
  });
  console.log(`Synthetic: wrote ${rows.length} rows → ${OUT_TS}`);
  process.exit(0);
}

try {
  const { rows, sheetName, unmappedManagers } = readXlsxRows();
  writeTs(rows, {
    source: `xlsx:${path.relative(ROOT, DEFAULT_XLSX)}`,
    sheetName,
    generatedAt,
    rowCount: rows.length,
    unmappedManagerRows: unmappedManagers,
  });
  console.log(`Excel: ${rows.length} rows (sheet "${sheetName}"), unmapped manager rows: ${unmappedManagers}`);
  console.log(`Wrote → ${OUT_TS}`);
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
