/**
 * Запуск: `npm run test:scroll-restoration` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(path.join(clientSrc, rel), "utf8");
}

const hookSrc = read("hooks/use-scroll-restoration.ts");
assert.ok(hookSrc.includes("sessionStorage"), "uses sessionStorage");
assert.ok(hookSrc.includes("requestAnimationFrame"), "restores via rAF");
assert.ok(hookSrc.includes("window.scrollY"), "saves scrollY");

const pagesWithScroll = [
  "pages/dealer-base.tsx",
  "pages/trade-points.tsx",
  "pages/trash-bin.tsx",
  "pages/dealer-base-management-cockpit.tsx",
  "pages/tasks.tsx",
  "pages/catalog.tsx",
];

for (const p of pagesWithScroll) {
  const src = read(p);
  assert.ok(src.includes("useScrollRestoration"), `${p} uses scroll restoration`);
}

console.log("scroll-restoration: ok");
