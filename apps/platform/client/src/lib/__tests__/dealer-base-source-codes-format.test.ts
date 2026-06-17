/**
 * Промт 392d — регистронезависимый filterDealerRowsByVisibleCodes.
 * Запуск: `npm run test:dealer-base-source-codes-format` из каталога apps/platform.
 */
import { describe, it, expect } from "vitest";
import { filterDealerRowsByVisibleCodes } from "../dealer-base-source.js";
import type { DealerRow } from "../dealer-base-mock-data.js";

describe("392d: filterDealerRowsByVisibleCodes регистронезависим", () => {
  const rows = [
    { id: "d1", releaseCode: "MA-MA085093", name: "A" },
    { id: "d2", releaseCode: "000000156", name: "B" },
    { id: "d3", releaseCode: "MA-MA999", name: "C" },
  ] as DealerRow[];

  it("совпадение в верхнем регистре когда codes в нижнем", () => {
    const out = filterDealerRowsByVisibleCodes(rows, ["ma-ma085093", "000000156"]);
    expect(out.map((r) => r.id).sort()).toEqual(["d1", "d2"]);
  });

  it("совпадение в нижнем регистре когда codes в верхнем", () => {
    const out = filterDealerRowsByVisibleCodes(
      [{ id: "d4", releaseCode: "ma-ma085093", name: "X" } as DealerRow],
      ["MA-MA085093"],
    );
    expect(out.length).toBe(1);
  });
});
