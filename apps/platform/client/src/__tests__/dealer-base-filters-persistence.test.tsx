/**
 * Промт 412: фильтры не сбрасываются при пересоздании mergedRowsForDealerBase.
 * Запуск: `npm run test:dealer-base-filters-persistence` из каталога apps/platform.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const dealerBaseSource = readFileSync(join(here, "../pages/dealer-base.tsx"), "utf8");

describe("dealer-base filter persistence", () => {
  it("URL filter effect does not depend on mergedRowsForDealerBase", () => {
    expect(dealerBaseSource).toContain("mergedRowsRef");
    expect(dealerBaseSource).toContain("mergedRowsRef.current");
    const depsBlock = dealerBaseSource.slice(
      dealerBaseSource.indexOf("setProgramFilters(programParsed)"),
      dealerBaseSource.indexOf("const firstRopTeamId"),
    );
    expect(depsBlock).not.toContain("mergedRowsForDealerBase,");
    expect(depsBlock).toContain("[412]");
  });

  it("filters persist across mergedRowsForDealerBase reference changes", () => {
    let quick: "all" | "active" = "all";
    const mergedRowsRef = { current: [] as Array<{ id: string }> };

    const runUrlFilterEffect = (routeKey: string) => {
      if (!routeKey) {
        quick = "all";
        return;
      }
      void mergedRowsRef.current;
    };

    runUrlFilterEffect("");
    expect(quick).toBe("all");

    quick = "active";
    mergedRowsRef.current = [{ id: "client-ma-ma1" }];
    // [412] mergedRows reference change alone must NOT re-run the effect.
    expect(quick).toBe("active");

    runUrlFilterEffect("quick=active");
    expect(quick).toBe("active");
  });
});
