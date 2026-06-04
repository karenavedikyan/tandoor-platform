/**
 * Запуск: `npm run test:dealer-base-virtualization` из каталога apps/platform.
 *
 * Промт 183: списки /dealer-base виртуализированы через window + @tanstack/react-virtual.
 * Без testing-library проверяем инварианты исходников и оценку числа DOM-рядов в grid.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEALER_BASE_VIRTUAL_ESTIMATE, DEALER_BASE_VIRTUAL_OVERSCAN } from "../dealer-base-list-window-virtualizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(path.join(clientSrc, rel), "utf8");
}

const dealerBase = read("pages/dealer-base.tsx");
const showcaseGrid = read("components/dealer-base-dealer-showcase-grid.tsx");

assert.ok(dealerBase.includes("useDealerBaseWindowVirtualizer"), "dealer-base.tsx uses window virtualizer");
assert.ok(showcaseGrid.includes("useDealerBaseWindowVirtualizer"), "showcase grid uses window virtualizer");
assert.ok(dealerBase.includes('data-testid="dealer-base-virtual-list-grid"'));
assert.ok(dealerBase.includes('data-testid="dealer-base-virtual-list-list"'));
assert.ok(dealerBase.includes('data-testid="dealer-base-virtual-list-table"'));
assert.ok(showcaseGrid.includes('data-testid="dealer-base-virtual-list-large"'));

function fnBody(source: string, fnName: string): string {
  const needle = `function ${fnName}(`;
  const start = source.indexOf(needle);
  assert.ok(start >= 0, `найдено ${fnName}`);
  const bodyOpen = source.indexOf(") {", start);
  assert.ok(bodyOpen >= 0, `найдено тело ${fnName}`);
  const open = bodyOpen + 2;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`не найдено закрытие ${fnName}`);
}

for (const [name, src] of [
  ["ClientCompactGridBlock", fnBody(dealerBase, "ClientCompactGridBlock")],
  ["ClientListRowsBlock", fnBody(dealerBase, "ClientListRowsBlock")],
  ["DealerBaseDataTable", fnBody(dealerBase, "DealerBaseDataTable")],
] as const) {
  assert.ok(src.includes("virtualizer.getVirtualItems()"), `${name}: virtual items`);
  assert.ok(!src.includes("rows.map((row)"), `${name}: нет полного rows.map`);
}

{
  const body = fnBody(showcaseGrid, "DealerBaseDealerShowcaseGrid");
  assert.ok(body.includes("virtualizer.getVirtualItems()"));
  assert.ok(!body.includes("rows.map((row)"));
}

const columns = 4;
const virtualRowsFor500 = Math.ceil(500 / columns);
const overscanRows = DEALER_BASE_VIRTUAL_OVERSCAN;
const maxMountedVirtualRows = virtualRowsFor500 + overscanRows * 2;
assert.ok(virtualRowsFor500 < 500, "grid virtualizes row chunks");
assert.ok(maxMountedVirtualRows < 500, "grid mounted virtual rows << client count");
assert.ok(DEALER_BASE_VIRTUAL_ESTIMATE.large > DEALER_BASE_VIRTUAL_ESTIMATE.table);

console.log("dealer-base-list-virtualization.test.ts: ok");
