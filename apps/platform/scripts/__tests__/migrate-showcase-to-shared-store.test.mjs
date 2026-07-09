import { describe, expect, it } from "vitest";
import { collectShowcaseRecordsFromActualizationRows } from "../../shared/trade-point-showcase-migrate-from-jsonb.js";

function showcaseEntry(updatedAt, entrancePortals) {
  return {
    tradePointId: "tp-1",
    dealerId: "d-1",
    updatedAt,
    updatedBy: "user-1",
    updatedByName: "User One",
    entrancePortals,
    interiorPortals: null,
    hasShowcase: true,
  };
}

describe("migrate-showcase-to-shared-store script logic", () => {
  it("picks newer showcase record for the same trade point from two users", () => {
    const rows = [
      {
        state: {
          tradePointShowcaseActualizationById: {
            "tp-1": showcaseEntry("2026-07-01T10:00:00.000Z", 3),
          },
        },
      },
      {
        state: {
          tradePointShowcaseActualizationById: {
            "tp-1": showcaseEntry("2026-07-05T12:00:00.000Z", 7),
          },
        },
      },
    ];

    const collected = collectShowcaseRecordsFromActualizationRows(rows);
    expect(collected.seenRecords).toBe(2);
    const winner = collected.recordsByTradePointId.get("tp-1");
    expect(winner?.data.entrancePortals).toBe(7);
    expect(winner?.updatedAt).toBe("2026-07-05T12:00:00.000Z");
  });
});
