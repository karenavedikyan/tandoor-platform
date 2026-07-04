/**
 * Запуск: npm run test:distribution-entry-virtualization
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISTRIBUTION_ENTRY_VIRTUAL_OVERSCAN } from "../distribution-entry-element-virtualizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../../components/distribution");

function read(name: string): string {
  return readFileSync(path.join(dist, name), "utf8");
}

const tpPanel = read("distribution-entry-tradepoint-panel.tsx");
const productPanel = read("distribution-entry-product-panel.tsx");
const cityPanel = read("distribution-entry-city-panel.tsx");

for (const [label, src] of [
  ["tradepoint", tpPanel],
  ["product", productPanel],
  ["city", cityPanel],
] as const) {
  assert.ok(src.includes("useDistributionEntryVirtualizer"), `${label}: virtualizer hook`);
}

assert.ok(tpPanel.includes('data-testid="list-distribution-entry-tradepoints"'));
assert.ok(!tpPanel.includes("rows.map((row) =>"), "tradepoint: no full rows.map");
assert.ok(tpPanel.includes("virtualizer.scrollToIndex"), "tradepoint: scroll to selected");
assert.ok(!tpPanel.includes("grid grid-cols-2 gap-2 lg:grid-cols-1"), "tradepoint: no grid layout");
assert.ok(tpPanel.includes('id: "compact"'), "tradepoint: compact toggle");
assert.ok(tpPanel.includes('id: "detailed"'), "tradepoint: detailed toggle");

assert.ok(productPanel.includes('data-testid="list-distribution-entry-product-models"'));
assert.ok(!productPanel.includes("catalogProducts.map((p)"), "product models: no full map");
assert.ok(!productPanel.includes("tpRows.map((row)"), "product tp: no full map");

assert.ok(cityPanel.includes('data-testid="list-distribution-entry-cities"'));
assert.ok(!cityPanel.includes("cityRows.map((row)"), "city: no full map");
assert.ok(!cityPanel.includes("tpRows.map((row)"), "city tp: no full map");

const lanes = 2;
const virtualRows500 = Math.ceil(500 / lanes);
assert.ok(virtualRows500 + DISTRIBUTION_ENTRY_VIRTUAL_OVERSCAN * 2 < 500);


assert.ok(tpPanel.includes("useDistributionEntryDesktopLayout"), "tradepoint: desktop layout hook");
assert.ok(tpPanel.includes("isDesktopLayout ?"), "tradepoint: conditional layout");
assert.ok(!tpPanel.includes("lg:hidden"), "tradepoint: no CSS-only mobile branch");
assert.ok(productPanel.includes("isDesktopLayout ?"), "product: conditional tpList");
assert.ok(cityPanel.includes("isDesktopLayout ?"), "city: conditional tpList");
assert.equal(
  (tpPanel.split("list-distribution-entry-tradepoints").length - 1),
  1,
  "tradepoint: single virtual list testid definition",
);

console.log("distribution-entry-list-virtualization.test.ts: ok");
