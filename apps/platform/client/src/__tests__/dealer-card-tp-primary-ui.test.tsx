/**
 * Промт 422: dealer card trade-point primary UI.
 * Запуск: npm run test:dealer-card-tp-primary-ui
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sectionSource = readFileSync(join(here, "../components/dealer-trade-points-section.tsx"), "utf8");

describe("dealer card trade point primary UI (422)", () => {
  it("uses trashTradePointStrict API instead of jsonb trashedTradePointsById", () => {
    expect(sectionSource).toContain("trashTradePointStrict");
    expect(sectionSource).toContain("setPrimaryTradePointStrict");
    expect(sectionSource).not.toContain("trashedTradePointsById");
    expect(sectionSource).not.toContain("makeTrashedTradePointInfo");
  });

  it("renders primary radio and disabled trash tooltips", () => {
    expect(sectionSource).toContain("radio-trade-point-primary-");
    expect(sectionSource).toContain("badge-dealer-trade-point-primary-");
    expect(sectionSource).toContain("tradePointTrashDisabledReason");
    expect(sectionSource).toContain("trade-point-primary-ui");
  });
});
