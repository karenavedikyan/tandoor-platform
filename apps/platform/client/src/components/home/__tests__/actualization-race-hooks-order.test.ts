/**
 * Запуск: `npm run test:race-hooks-order` из каталога apps/platform.
 *
 * Промт 52 hotfix React #310: гарантируем, что в `ActualizationRace` все
 * хуки объявлены ДО первого условного return. В репо нет vitest/testing-library,
 * поэтому делаем static-source инвариант: парсим исходник и проверяем порядок
 * `use*(` вызовов относительно `return ` / `if (...) return ...` внутри тела
 * функции `ActualizationRace`.
 *
 * Стиль теста — tsx + node:assert/strict (как остальные test:* скрипты).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, "../actualization-race.tsx");
const raw = readFileSync(sourcePath, "utf8");

// 1. Выделяем тело функции ActualizationRace целиком (до её закрывающей фигурной скобки).
const fnStart = raw.indexOf("export function ActualizationRace()");
assert.ok(fnStart >= 0, "найдено объявление ActualizationRace");
// Идём от первой { после имени до парной закрывающей.
const openBraceIdx = raw.indexOf("{", fnStart);
assert.ok(openBraceIdx > fnStart, "найдена { начала функции");
let depth = 0;
let closeBraceIdx = -1;
for (let i = openBraceIdx; i < raw.length; i += 1) {
  const ch = raw[i];
  if (ch === "{") depth += 1;
  else if (ch === "}") {
    depth -= 1;
    if (depth === 0) {
      closeBraceIdx = i;
      break;
    }
  }
}
assert.ok(closeBraceIdx > openBraceIdx, "найдена парная }");
const fnBody = raw.slice(openBraceIdx + 1, closeBraceIdx);

// 2. Список ожидаемых хуков (имена). Все 7 должны быть в теле функции.
const expectedHooks = [
  "useAuthUser",
  "useClientBaseActualization",
  "useState",
  "useQuery", // overviewQ
  "useMemo", // range7
  "useQuery", // overview7Q
  "useMemo", // streakRows
];
const hookRe = /\buse[A-Z]\w*\s*\(/g;
const hookMatches: Array<{ name: string; index: number }> = [];
let m: RegExpExecArray | null;
while ((m = hookRe.exec(fnBody)) !== null) {
  const name = m[0].replace(/[\s(]+$/, "");
  hookMatches.push({ name, index: m.index });
}

// Проверяем, что нашли минимум 7 hook-вызовов в теле функции.
assert.ok(
  hookMatches.length >= expectedHooks.length,
  `найдено ${hookMatches.length} хуков, ожидалось ≥ ${expectedHooks.length} (${expectedHooks.join(", ")})`,
);

// Все ожидаемые имена должны присутствовать (с учётом повторов).
{
  const got = hookMatches.map((x) => x.name);
  for (const expectedName of new Set(expectedHooks)) {
    const need = expectedHooks.filter((n) => n === expectedName).length;
    const have = got.filter((n) => n === expectedName).length;
    assert.ok(have >= need, `хук ${expectedName}: ожидалось ≥ ${need}, найдено ${have}`);
  }
}

// 3. Главный инвариант: ВСЕ хуки должны вызываться ДО первого `if (` с return
//    или одиночного `return ` (вне внутренних функций IIFE).
//    Достаточно ограничиться позицией первого `if (!role) return null;` маркера —
//    он в коде явно стоит сразу после блока хуков (см. Промт 52).
const earlyReturnMarker = "if (!role) return null;";
const earlyReturnIdx = fnBody.indexOf(earlyReturnMarker);
assert.ok(earlyReturnIdx > 0, `маркер «${earlyReturnMarker}» найден в теле функции`);

const hooksAfterEarlyReturn = hookMatches.filter((h) => h.index > earlyReturnIdx);
// Допустимо, чтобы ниже маркера встречались хуки ВНУТРИ субкомпонентов / IIFE,
// но прямо в области ActualizationRace их быть не должно. Тестово: проверяем,
// что в первых ~3000 символов после маркера нет use*( вне закрытых вложенных функций.
// В данном файле подкомпонентов в самой функции нет (ProgressBar/MiniTile/MedalCard
// объявлены ВНЕ функции), поэтому ожидаем 0 хуков после маркера.
assert.equal(
  hooksAfterEarlyReturn.length,
  0,
  `ни один use*-хук не должен быть после «${earlyReturnMarker}»; найдено: ${hooksAfterEarlyReturn
    .map((h) => h.name)
    .join(", ")}`,
);

console.log(`actualization-race-hooks-order: ok (${hookMatches.length} hooks; все до early-return)`);
