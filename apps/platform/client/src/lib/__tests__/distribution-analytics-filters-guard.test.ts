/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  emptyDistributionAnalyticsFilters,
  hasAnyDistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";

describe("hasAnyDistributionAnalyticsFilters (441-fix2)", () => {
  it("returns false for empty filters", () => {
    expect(hasAnyDistributionAnalyticsFilters(emptyDistributionAnalyticsFilters())).toBe(false);
  });

  it("returns true when region filter is set", () => {
    expect(
      hasAnyDistributionAnalyticsFilters({
        ...emptyDistributionAnalyticsFilters(),
        regions: ["ЦФО"],
      }),
    ).toBe(true);
  });
});
