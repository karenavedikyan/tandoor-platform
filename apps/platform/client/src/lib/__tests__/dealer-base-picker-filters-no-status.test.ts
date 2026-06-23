import { describe, expect, it } from "vitest";
import { applyQuickFilter } from "@/lib/dealer-base-picker-filters";
import type { DealerRow } from "@/lib/dealer-base-mock-data";

const r = (status: DealerRow["status"]) =>
  ({ status, hasProblem: false, hasRecentActivity: true }) as unknown as DealerRow;

describe("applyQuickFilter no_status", () => {
  it("приостановлен/требует внимания → true", () => {
    expect(applyQuickFilter(r("приостановлен"), "no_status")).toBe(true);
    expect(applyQuickFilter(r("требует внимания"), "no_status")).toBe(true);
  });

  it("активный/потенциальный → false", () => {
    expect(applyQuickFilter(r("активный"), "no_status")).toBe(false);
    expect(applyQuickFilter(r("потенциальный"), "no_status")).toBe(false);
  });
});
