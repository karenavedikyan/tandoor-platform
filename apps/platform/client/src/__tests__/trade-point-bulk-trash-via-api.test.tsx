/**
 * Промт 439: bulk trash trade points via API.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(join(here, "../../../api/trade-point-overrides/[action].ts"), "utf8");
const tradePointsSource = readFileSync(join(here, "../pages/trade-points.tsx"), "utf8");
const sectionSource = readFileSync(join(here, "../components/dealer-trade-points-section.tsx"), "utf8");
const clientApiSource = readFileSync(join(here, "../lib/trade-point-overrides-api.ts"), "utf8");

describe("trade-point bulk trash via API (439)", () => {
  it("server exposes bulk-trash action", () => {
    expect(apiSource).toContain('"bulk-trash"');
    expect(apiSource).toContain("handleBulkTrashTradePoints");
  });

  it("client exposes bulkTrashTradePointsStrict", () => {
    expect(clientApiSource).toContain("bulkTrashTradePointsStrict");
    expect(clientApiSource).toContain("/api/trade-point-overrides/bulk-trash");
  });

  it("trade-points page uses single bulk call", () => {
    const block = tradePointsSource.slice(
      tradePointsSource.indexOf("const confirmBulkArchive"),
      tradePointsSource.indexOf("const tpHref"),
    );
    expect(block).toContain("bulkTrashTradePointsStrict");
    expect(block).not.toMatch(/for\s*\(.*trashTradePointStrict/);
  });

  it("dealer trade points section uses single bulk call", () => {
    const block = sectionSource.slice(
      sectionSource.indexOf("const confirmBulkArchiveTradePoints"),
      sectionSource.indexOf("if (mergedActive.length === 0"),
    );
    expect(block).toContain("bulkTrashTradePointsStrict");
    expect(block).not.toMatch(/for\s*\(.*trashTradePointStrict/);
  });
});
