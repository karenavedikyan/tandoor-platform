import { describe, expect, it } from "vitest";
import {
  collectShowcaseRecordsFromActualizationRows,
} from "../../../shared/trade-point-showcase-migrate-from-jsonb.js";
import {
  fetchTradePointShowcaseBatch,
  findChangedShowcaseRecords,
  upsertTradePointShowcaseRecords,
  type SqlFn,
} from "../../../shared/trade-point-showcase-shared-store.js";

function showcaseEntry(updatedAt: string, entrancePortals: number) {
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

describe("trade-point-showcase shared store", () => {
  it("findChangedShowcaseRecords detects new and updated entries", () => {
    const prev = {
      "tp-1": showcaseEntry("2026-07-01T10:00:00.000Z", 3),
    };
    const next = {
      "tp-1": showcaseEntry("2026-07-02T10:00:00.000Z", 5),
      "tp-2": showcaseEntry("2026-07-02T11:00:00.000Z", 2),
    };
    const changed = findChangedShowcaseRecords(prev, next);
    expect(changed.map((r) => r.tradePointId).sort()).toEqual(["tp-1", "tp-2"]);
    expect(changed.find((r) => r.tradePointId === "tp-1")?.data.entrancePortals).toBe(5);
  });

  it("fetchTradePointShowcaseBatch returns empty array for empty ids", async () => {
    const sql = (async () => []) as unknown as SqlFn;
    const rows = await fetchTradePointShowcaseBatch(sql, []);
    expect(rows).toEqual([]);
  });

  it("fetchTradePointShowcaseBatch maps DB rows", async () => {
    const sql = (async (strings: TemplateStringsArray) => {
      const q = strings.join(" ");
      if (q.includes("CREATE TABLE")) return [];
      return [
        {
          trade_point_id: "tp-1",
          dealer_id: "d-1",
          data: showcaseEntry("2026-07-02T10:00:00.000Z", 7),
          updated_at: "2026-07-02T10:00:00.000Z",
          updated_by: "user-1",
          updated_by_name: "User One",
        },
      ];
    }) as SqlFn;

    const rows = await fetchTradePointShowcaseBatch(sql, ["tp-1"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tradePointId).toBe("tp-1");
    expect(rows[0]?.data.entrancePortals).toBe(7);
  });

  it("upsertTradePointShowcaseRecords applies last-write-wins", async () => {
    const table = new Map<string, { updated_at: string }>();
    const sql = (async (strings: TemplateStringsArray, ...params: unknown[]) => {
      const q = strings.join(" ");
      if (q.includes("CREATE TABLE") || q.includes("CREATE INDEX")) return [];
      if (q.includes("INSERT INTO trade_point_showcase_state")) {
        const tradePointId = params[0] as string;
        const updatedAt = params[3] as string;
        const prev = table.get(tradePointId);
        if (!prev || Date.parse(updatedAt) > Date.parse(prev.updated_at)) {
          table.set(tradePointId, { updated_at: updatedAt });
          return [{ trade_point_id: tradePointId }];
        }
        return [];
      }
      return [];
    }) as SqlFn;

    const recOld = {
      tradePointId: "tp-1",
      dealerId: "d-1",
      data: showcaseEntry("2026-07-01T10:00:00.000Z", 3),
      updatedAt: "2026-07-01T10:00:00.000Z",
      updatedBy: "user-a",
      updatedByName: "A",
    };
    const recNew = {
      ...recOld,
      data: showcaseEntry("2026-07-03T10:00:00.000Z", 9),
      updatedAt: "2026-07-03T10:00:00.000Z",
      updatedBy: "user-b",
      updatedByName: "B",
    };

    const first = await upsertTradePointShowcaseRecords(sql, [recOld]);
    expect(first.upserted).toBe(1);

    const second = await upsertTradePointShowcaseRecords(sql, [recNew]);
    expect(second.upserted).toBe(1);

    const third = await upsertTradePointShowcaseRecords(sql, [recOld]);
    expect(third.upserted).toBe(0);
    expect(third.skipped).toBe(1);
  });
});

describe("migrate showcase from jsonb", () => {
  it("picks newer record when two users have same trade point", () => {
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
    expect(collected.scannedJsonbRows).toBe(2);
    expect(collected.seenRecords).toBe(2);
    const winner = collected.recordsByTradePointId.get("tp-1");
    expect(winner?.data.entrancePortals).toBe(7);
    expect(winner?.updatedAt).toBe("2026-07-05T12:00:00.000Z");
  });
});
