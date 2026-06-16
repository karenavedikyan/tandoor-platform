/**
 * Запуск: `npm run test:virtualization-large-lists` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LARGE_LIST_VIRTUAL_THRESHOLD, LARGE_LIST_OVERSCAN, shouldVirtualizeLargeList } from "../window-list-virtualizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(path.join(clientSrc, rel), "utf8");
}

assert.equal(LARGE_LIST_VIRTUAL_THRESHOLD, 100);
assert.equal(LARGE_LIST_OVERSCAN, 5);
assert.equal(shouldVirtualizeLargeList(99), false);
assert.equal(shouldVirtualizeLargeList(100), true);
assert.equal(shouldVirtualizeLargeList(1000), true);

const virtualizedPages = [
  {
    file: "pages/trash-bin.tsx",
    markers: ["VirtualizedStackList", "trash-dealers-virtual-list", "card-trash-dealer-"],
  },
  {
    file: "pages/dealer-base-management-cockpit.tsx",
    markers: ["shouldVirtualizeLargeList", "management-cockpit-client-list", "row-management-client-"],
  },
  {
    file: "pages/trade-points.tsx",
    markers: ["VirtualizedStackList", "trade-points-virtual-list", "TRADE_POINT_DENSITY_ESTIMATE"],
  },
  {
    file: "pages/tasks.tsx",
    markers: ["VirtualizedStackList", "section-showcase-tasks-visual-list", "row-showcase-task"],
  },
  {
    file: "pages/catalog.tsx",
    markers: ["VirtualizedStackList", "catalog-products-virtual-list", "row-catalog-product"],
  },
  {
    file: "lib/window-list-virtualizer.tsx",
    markers: ["useWindowVirtualizer", "LARGE_LIST_VIRTUAL_THRESHOLD"],
  },
];

for (const { file, markers } of virtualizedPages) {
  const src = read(file);
  for (const m of markers) {
    assert.ok(src.includes(m), `${file} contains ${m}`);
  }
}

// DOM budget: 1000 rows with overscan 5 → at most ~11 visible chunks + margin
const maxMounted = 20 + LARGE_LIST_OVERSCAN * 2;
assert.ok(maxMounted <= 30, "virtual window stays under 30 rows with overscan");

console.log("virtualization-large-lists: ok");
