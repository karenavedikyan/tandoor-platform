import { describe, expect, it } from "vitest";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  buildReleaseClientByCodeMap,
  dealerRowMatchesSegment,
  resolveDealerRowSegmentKey,
} from "@/lib/dealer-base-dealer-segment";

function row(id: string, partial: Partial<DealerRow> = {}): DealerRow {
  return {
    id,
    releaseCode: partial.releaseCode ?? id,
    name: partial.name ?? id,
    city: partial.city ?? "Город",
    manager: partial.manager ?? "",
    status: partial.status ?? "активный",
    outlets: partial.outlets ?? 1,
    distribution: partial.distribution ?? 50,
    hasProblem: partial.hasProblem ?? false,
    hasRecentActivity: partial.hasRecentActivity ?? true,
    clientCategory: partial.clientCategory ?? "B",
    ...partial,
  } as DealerRow;
}

function applyForcedSegmentFilter(
  rows: DealerRow[],
  forcedSegmentFilter: "active" | "potential" | null,
): DealerRow[] {
  if (!forcedSegmentFilter) return rows;
  const releaseByCode = buildReleaseClientByCodeMap();
  return rows.filter((r) => dealerRowMatchesSegment(r, forcedSegmentFilter, releaseByCode));
}

describe("dealer-base forced segment filter", () => {
  const rows = [
    row("active-1", { status: "активный" }),
    row("active-2", { status: "активный" }),
    row("potential-1", { status: "потенциальный" }),
  ];

  const releaseByCode = buildReleaseClientByCodeMap();

  it("dealerRowMatchesSegment returns all rows when segment is null", () => {
    for (const r of rows) {
      expect(dealerRowMatchesSegment(r, null, releaseByCode)).toBe(true);
    }
    expect(applyForcedSegmentFilter(rows, null)).toHaveLength(rows.length);
  });

  it("filters to active segment only", () => {
    const filtered = applyForcedSegmentFilter(rows, "active");
    expect(filtered).toHaveLength(2);
    for (const r of filtered) {
      expect(resolveDealerRowSegmentKey(r, releaseByCode)).toBe("active");
    }
  });

  it("filters to potential segment only", () => {
    const filtered = applyForcedSegmentFilter(rows, "potential");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("potential-1");
    expect(resolveDealerRowSegmentKey(filtered[0]!, releaseByCode)).toBe("potential");
  });
});
