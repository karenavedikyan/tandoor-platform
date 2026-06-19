#!/usr/bin/env node
/**
 * check-db-source-invariant.mjs
 *
 * Архитектурный lint: БД = единственный источник правды.
 *
 * Сейчас работает в режиме WARN — печатает нарушения и завершается с exit 0.
 * После реализации промта 423 (rop-team-from-db-source-of-truth) переключим
 * на FAIL отдельным PR.
 *
 * См. ../../docs/architecture/db-single-source-of-truth.md (относительно apps/platform)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const MODE = process.env.DB_SOURCE_INVARIANT_MODE ?? "warn"; // warn | fail

// Сканируем относительно cwd — скрипт запускается из apps/platform через pnpm/npm run.
// Если запустят из корня монорепы — поддерживаем оба варианта.
const SCAN_DIRS = [
  "client/src",
  "server",
  "shared",
  "api",
  // fallback для запуска из корня монорепы:
  "apps/platform/client/src",
  "apps/platform/server",
  "apps/platform/shared",
  "apps/platform/api",
];

// Что игнорируем
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  ".git",
  "__tests__",
  "__mocks__",
]);

const IGNORE_FILE_PATTERNS = [
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /\.stories\.[tj]sx?$/,
  /\.d\.ts$/,
];

// Запрещённые паттерны (grep-стопы из конституции)
const RULES = [
  {
    id: "rows-reduce-outlets",
    pattern: /rows\s*\.\s*reduce\s*\([^)]{0,200}outlets/i,
    message:
      "Клиентский подсчёт outlets через rows.reduce. Счётчик должен приходить с сервера (totals из my-scope/team-scope/org-scope).",
  },
  {
    id: "rows-filter-active-length",
    pattern: /rows\s*\.\s*filter\s*\([^)]{0,200}status[^)]{0,200}active[^)]{0,200}\)\s*\.\s*length/i,
    message:
      "Клиентский фильтр по status==='active' с .length. Используйте totals из API, а не пересчёт на клиенте.",
  },
  {
    id: "actualization-trashed-counter",
    pattern: /actualizationState\.trashedDealersById/,
    message:
      "actualizationState.trashedDealersById не должен использоваться для счётчиков. Trash-счётчик — из API (my-scope/team-scope/org-scope totals).",
  },
  {
    id: "orgsnapshot-length-as-counter",
    pattern: /OrgSnapshot[^;]{0,200}\.length[^;]{0,80}(Counter|Count|outlets|total)/i,
    message:
      "OrgSnapshot.*.length в контексте счётчика. OrgSnapshot — release-каталог, а не источник scope. Используйте API endpoints.",
  },
  {
    id: "tp-sum-not-union",
    pattern: /members\.reduce\s*\([^)]*active_trade_points/,
    message:
      "Сумма active_trade_points через reduce → дубли по RM. Используйте SET-union по tp_id (unionTradePointIds).",
  },
];

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, acc);
    } else if (st.isFile()) {
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) continue;
      if (IGNORE_FILE_PATTERNS.some((rx) => rx.test(name))) continue;
      acc.push(full);
    }
  }
  return acc;
}

const violations = [];

for (const rel of SCAN_DIRS) {
  const abs = join(ROOT, rel);
  const files = walk(abs);
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    // skip self-allowed comment marker
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      // allow-list: строка содержит маркер обхода
      if (/db-source-invariant:\s*allow/.test(line)) return;
      for (const rule of RULES) {
        if (rule.pattern.test(line)) {
          violations.push({
            rule: rule.id,
            message: rule.message,
            file: relative(ROOT, file).split(sep).join("/"),
            line: idx + 1,
            snippet: line.trim().slice(0, 200),
          });
        }
      }
    });
  }
}

const header = "[db-source-invariant] lint check";
if (violations.length === 0) {
  console.log(`${header}: ok (no violations)`);
  process.exit(0);
}

const byRule = new Map();
for (const v of violations) {
  if (!byRule.has(v.rule)) byRule.set(v.rule, []);
  byRule.get(v.rule).push(v);
}

console.log(`${header}: ${violations.length} violation(s) (mode=${MODE})`);
console.log(
  "См. docs/architecture/db-single-source-of-truth.md (в корне монорепы) — все счётчики и scope обязаны идти из API/БД.",
);
console.log("");
for (const [ruleId, items] of byRule) {
  console.log(`# ${ruleId} — ${items.length}`);
  console.log(`  ${items[0].message}`);
  for (const v of items) {
    console.log(`    ${v.file}:${v.line}`);
    console.log(`      ${v.snippet}`);
  }
  console.log("");
}

if (MODE === "fail") {
  process.exit(1);
}
// warn mode — не валим CI
process.exit(0);
