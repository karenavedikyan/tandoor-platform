import { describe, expect, it } from "vitest";
import {
  aggregateSnapshotByTypeMaps,
  computeDistributionDeltaByType,
  computeSinceDateUtc,
  EMPTY_SNAPSHOT_BY_TYPE,
} from "../distribution-snapshot-aggregate";

describe("distribution snapshot aggregate", () => {
  it("aggregates current/baseline by sums and computes delta", () => {
    const tradePointIds = ["tp-a", "tp-b"];
    const currentByTradePointId = {
      "tp-a": {
        entrance: { capacity: 10, onShelf: 5 },
        interior: { capacity: 8, onShelf: 2 },
        hardware: { capacity: 4, onShelf: 1 },
      },
      "tp-b": {
        entrance: { capacity: 6, onShelf: 3 },
        interior: { capacity: 0, onShelf: 0 },
        hardware: { capacity: 2, onShelf: 1 },
      },
    };
    const baselineByTradePointId = {
      "tp-a": {
        entrance: { capacity: 10, onShelf: 4 },
        interior: { capacity: 8, onShelf: 2 },
        hardware: { capacity: 4, onShelf: 0 },
      },
    };

    const currentAgg = aggregateSnapshotByTypeMaps(tradePointIds, currentByTradePointId);
    expect(currentAgg.entrance).toEqual({ capacity: 16, onShelf: 8, percent: 50 });
    expect(currentAgg.hardware).toEqual({ capacity: 6, onShelf: 2, percent: (2 / 6) * 100 });

    const baselineAgg = aggregateSnapshotByTypeMaps(tradePointIds, baselineByTradePointId);
    expect(baselineAgg.entrance).toEqual({ capacity: 10, onShelf: 4, percent: 40 });
    expect(baselineAgg.interior).toEqual({ capacity: 8, onShelf: 2, percent: 25 });
    expect(baselineAgg.hardware).toEqual({ capacity: 4, onShelf: 0, percent: 0 });

    const delta = computeDistributionDeltaByType(currentAgg, baselineAgg);
    expect(delta.entrance).toBeCloseTo(10, 5);
    expect(delta.interior).toBe(0);
    expect(delta.hardware).toBeCloseTo((2 / 6) * 100, 5);
  });

  it("returns null delta when denominator is zero", () => {
    const tradePointIds = ["tp-new"];
    const current = aggregateSnapshotByTypeMaps(tradePointIds, {
      "tp-new": {
        entrance: { capacity: 0, onShelf: 0 },
        interior: { capacity: 0, onShelf: 0 },
        hardware: { capacity: 0, onShelf: 0 },
      },
    });
    const baseline = aggregateSnapshotByTypeMaps(tradePointIds, {});
    const delta = computeDistributionDeltaByType(current, baseline);
    expect(delta.entrance).toBeNull();
    expect(delta.interior).toBeNull();
    expect(delta.hardware).toBeNull();
  });

  it("treats missing baseline trade point as zeros (new inside period)", () => {
    const tradePointIds = ["tp-new"];
    const current = aggregateSnapshotByTypeMaps(tradePointIds, {
      "tp-new": {
        entrance: { capacity: 5, onShelf: 2 },
        interior: { capacity: 0, onShelf: 0 },
        hardware: { capacity: 0, onShelf: 0 },
      },
    });
    const baseline = aggregateSnapshotByTypeMaps(tradePointIds, {});
    expect(baseline.entrance).toEqual({ capacity: 0, onShelf: 0, percent: null });
    const delta = computeDistributionDeltaByType(current, baseline);
    expect(delta.entrance).toBeNull();
  });

  it("uses EMPTY_SNAPSHOT_BY_TYPE for missing rows", () => {
    expect(EMPTY_SNAPSHOT_BY_TYPE.entrance).toEqual({ capacity: 0, onShelf: 0 });
  });

  it("computeSinceDateUtc subtracts period in UTC", () => {
    const now = new Date("2026-06-16T15:30:00.000Z");
    expect(computeSinceDateUtc(30, now)).toBe("2026-05-17");
    expect(computeSinceDateUtc(7, now)).toBe("2026-06-09");
  });
});
