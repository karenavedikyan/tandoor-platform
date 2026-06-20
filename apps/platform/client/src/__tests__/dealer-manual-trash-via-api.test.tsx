/**
 * Промт 439: manual actualization card trash via DB API.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "../components/dealer-manual-actualization-page.tsx"), "utf8");

describe("dealer-manual-actualization trash via API (439)", () => {
  it("trashDealer calls trashDealerStrict, not actx.persist trashedDealersById", () => {
    const block = source.slice(source.indexOf("const trashDealer"), source.indexOf("const tps = useMemo"));
    expect(block).toContain("trashDealerStrict");
    expect(block).not.toContain("trashedDealersById");
    expect(block).not.toContain("actx.persist");
  });

  it("isDealerTrashed reads runtime DB source", () => {
    expect(source).toContain("isDealerTrashedInRuntime(baseRow.id, actx.state)");
    expect(source).not.toMatch(/isDealerTrashed\s*=\s*Boolean\(actx\.state\.trashedDealersById/);
  });

  it("links to dealer-base bulk mode", () => {
    expect(source).toContain("/dealer-base?bulkMode=1");
    expect(source).toContain("Выбрать несколько");
  });
});
