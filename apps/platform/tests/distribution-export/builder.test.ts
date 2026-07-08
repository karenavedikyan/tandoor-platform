import { describe, expect, it, vi } from "vitest";
import { buildDistributionExport } from "../../shared/distribution-export/builder.js";
import { distributionSnapshotFilename } from "../../shared/distribution-export/ftp-uploader.js";
import type { PoolLike } from "../../server/db/neon-client.js";

function mockPool(rows: unknown[], unmatched: string[] = []): PoolLike {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("l.id_1c IS NULL")) {
        return { rows: unmatched.map((dealer_id) => ({ dealer_id })) };
      }
      return { rows };
    }),
  };
}

describe("buildDistributionExport", () => {
  it("returns empty structure when no placement rows", async () => {
    const now = new Date("2026-07-08T15:00:00.000Z");
    const data = await buildDistributionExport(mockPool([]), now);

    expect(data).toEqual({
      generated_at: "2026-07-08T15:00:00.000Z",
      source: "lk.tandoor.ru",
      version: 2,
      level: 2,
      stores: [],
      unmatched_dealers: [],
    });
  });

  it("aggregates placements per store with UTC dates and stable order", async () => {
    const rows = [
      {
        store_id_1c: "df52937d-0739-11f1-80bf-00155d60ef09",
        legal_entity_1c: "8d7679e3-d6f0-11ea-80f5-00155d0a0a4e",
        ma_number: "MA-MA132519",
        placement_type: "portal",
        placement_segment: "vh",
        placement_capacity: 25,
        placement_actual: 0,
        placement_our_models: [{ modelId: "ART-1", count: 2 }],
        placement_competitors: [{ brand: "BrandX", count: 1 }],
        placement_ref: null,
        updated_at: "2026-06-24T18:38:43.000Z",
      },
      {
        store_id_1c: "aaaaaaaa-0739-11f1-80bf-00155d60ef09",
        legal_entity_1c: "bbbbbbbb-d6f0-11ea-80f5-00155d0a0a4e",
        ma_number: "MA-MA000001",
        placement_type: "cube",
        placement_segment: "mk",
        placement_capacity: 10,
        placement_actual: 3,
        placement_our_models: [],
        placement_competitors: [],
        placement_ref: "ref-1",
        updated_at: "2026-07-07T20:15:00.000Z",
      },
    ];

    const data = await buildDistributionExport(mockPool(rows, ["client-ma-ma066200"]));

    expect(data.stores).toHaveLength(2);
    expect(data.stores[0]?.store_id_1c).toBe("aaaaaaaa-0739-11f1-80bf-00155d60ef09");
    expect(data.stores[1]?.store_id_1c).toBe("df52937d-0739-11f1-80bf-00155d60ef09");
    expect(data.stores[1]?.models).toEqual([]);
    expect(data.stores[1]?.placements[0]).toMatchObject({
      type: "portal",
      segment: "vh",
      capacity: 25,
      actual_ours: 0,
      our_models: [{ article: "ART-1", count: 2 }],
      competitors: [{ brand: "BrandX", count: 1 }],
      ref: null,
      updated_at: "2026-06-24T18:38:43.000Z",
    });
    expect(data.stores[1]?.updated_at).toBe("2026-06-24T18:38:43.000Z");
    expect(data.unmatched_dealers).toEqual(["client-ma-ma066200"]);
  });
});

describe("distributionSnapshotFilename", () => {
  it("uses UTC hour in snapshot name", () => {
    expect(distributionSnapshotFilename(new Date("2026-07-08T15:30:00.000Z"))).toBe(
      "distribution_2026-07-08_15.json",
    );
  });
});
