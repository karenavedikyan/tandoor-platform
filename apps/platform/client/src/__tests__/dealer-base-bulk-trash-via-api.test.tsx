/**
 * Промт 420: bulk trash через API.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const dealerBaseSource = readFileSync(join(here, "../pages/dealer-base.tsx"), "utf8");
const apiSource = readFileSync(join(here, "../../../api/dealer-overrides/[action].ts"), "utf8");

describe("dealer-base bulk trash via API (420)", () => {
  it("server exposes bulk-trash action", () => {
    expect(apiSource).toContain('"bulk-trash"');
    expect(apiSource).toContain("handleBulkTrashDealers");
  });

  it("client bulk handler uses bulkTrashDealersStrict", () => {
    expect(dealerBaseSource).toContain("bulkTrashDealersStrict");
  });
});
