import { describe, expect, it } from "vitest";
import type { PoolLike } from "../../server/db/neon-client.js";
import {
  fetchDistributionSnapshotRange,
  handleDistributionSnapshotRange,
  handleDistributionSnapshotUpsert,
  upsertDistributionSnapshot,
  type ShowcaseMatrixSessionUser,
} from "../showcase-matrix-handlers.js";

const SESSION_USER: ShowcaseMatrixSessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "manager",
  status: "active",
  fullName: "Test Manager",
};

type SnapshotRow = Record<string, unknown>;

class InMemoryDistributionSnapshotDb implements PoolLike {
  snapshots: SnapshotRow[] = [];
  matrixEntries: SnapshotRow[] = [];

  query<T = SnapshotRow>(text: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount?: number }> {
    const sql = text.trim();

    if (sql.includes("INSERT INTO showcase_distribution_snapshots")) {
      const [
        tradePointId,
        dealerId,
        entranceCapacity,
        entranceOnShelf,
        interiorCapacity,
        interiorOnShelf,
        hardwareCapacity,
        hardwareOnShelf,
        updatedBy,
        updatedByName,
      ] = params as unknown[];
      const existing = this.snapshots.find((r) => r.trade_point_id === tradePointId);
      const row: SnapshotRow = {
        trade_point_id: tradePointId,
        dealer_id: dealerId,
        snapshot_date: "2026-06-16",
        entrance_capacity: entranceCapacity,
        entrance_on_shelf: entranceOnShelf,
        interior_capacity: interiorCapacity,
        interior_on_shelf: interiorOnShelf,
        hardware_capacity: hardwareCapacity,
        hardware_on_shelf: hardwareOnShelf,
        updated_by: updatedBy,
        updated_by_name: updatedByName,
      };
      if (existing) Object.assign(existing, row);
      else this.snapshots.push(row);
      return Promise.resolve({ rows: [row as T], rowCount: 1 });
    }

    if (sql.includes("FROM showcase_distribution_snapshots") && sql.includes("DISTINCT ON (trade_point_id)")) {
      const tradePointIds = params[0] as string[];
      const sinceDate = params[1] as string | undefined;
      let rows = this.snapshots.filter((r) => tradePointIds.includes(String(r.trade_point_id)));
      if (sinceDate) {
        rows = rows.filter((r) => String(r.snapshot_date) <= sinceDate);
      }
      const latestByTp = new Map<string, SnapshotRow>();
      for (const row of rows) {
        const tpId = String(row.trade_point_id);
        const prev = latestByTp.get(tpId);
        if (!prev || String(row.snapshot_date) > String(prev.snapshot_date)) {
          latestByTp.set(tpId, row);
        }
      }
      return Promise.resolve({ rows: Array.from(latestByTp.values()) as T[] });
    }

    if (sql.includes("FROM showcase_distribution_snapshots") && sql.includes("trade_point_id, dealer_id")) {
      const tradePointIds = params[0] as string[];
      const latestByTp = new Map<string, SnapshotRow>();
      for (const row of this.snapshots.filter((r) => tradePointIds.includes(String(r.trade_point_id)))) {
        const tpId = String(row.trade_point_id);
        const prev = latestByTp.get(tpId);
        if (!prev || String(row.snapshot_date) > String(prev.snapshot_date)) {
          latestByTp.set(tpId, row);
        }
      }
      return Promise.resolve({
        rows: Array.from(latestByTp.values()).map((r) => ({
          trade_point_id: r.trade_point_id,
          dealer_id: r.dealer_id,
        })) as T[],
      });
    }

    if (sql.includes("FROM showcase_matrix_entries") && sql.includes("trade_point_id, dealer_id")) {
      const tradePointIds = params[0] as string[];
      const latestByTp = new Map<string, SnapshotRow>();
      for (const row of this.matrixEntries.filter((r) => tradePointIds.includes(String(r.trade_point_id)))) {
        const tpId = String(row.trade_point_id);
        latestByTp.set(tpId, row);
      }
      return Promise.resolve({
        rows: Array.from(latestByTp.values()).map((r) => ({
          trade_point_id: r.trade_point_id,
          dealer_id: r.dealer_id,
        })) as T[],
      });
    }

    return Promise.resolve({ rows: [] });
  }
}

describe("distribution snapshot handlers", () => {
  it("upsertDistributionSnapshot builds UPSERT with sanitized numbers", async () => {
    const db = new InMemoryDistributionSnapshotDb();
    const result = await upsertDistributionSnapshot(db, SESSION_USER, {
      tradePointId: "tp-1",
      dealerId: "client-ma001",
      byType: {
        entrance: { capacity: -3, onShelf: 2.7 },
        interior: { capacity: 4, onShelf: 1 },
        hardware: { capacity: Number.NaN, onShelf: -1 },
      },
    });
    expect(result).toEqual({ ok: true });
    expect(db.snapshots[0]).toMatchObject({
      trade_point_id: "tp-1",
      entrance_capacity: 0,
      entrance_on_shelf: 2,
      hardware_capacity: 0,
      hardware_on_shelf: 0,
    });
  });

  it("fetchDistributionSnapshotRange returns current and baseline via DISTINCT ON semantics", async () => {
    const db = new InMemoryDistributionSnapshotDb();
    db.snapshots.push(
      {
        trade_point_id: "tp-1",
        dealer_id: "client-ma001",
        snapshot_date: "2026-05-01",
        entrance_capacity: 10,
        entrance_on_shelf: 2,
        interior_capacity: 0,
        interior_on_shelf: 0,
        hardware_capacity: 0,
        hardware_on_shelf: 0,
      },
      {
        trade_point_id: "tp-1",
        dealer_id: "client-ma001",
        snapshot_date: "2026-06-10",
        entrance_capacity: 10,
        entrance_on_shelf: 5,
        interior_capacity: 0,
        interior_on_shelf: 0,
        hardware_capacity: 0,
        hardware_on_shelf: 0,
      },
    );

    const range = await fetchDistributionSnapshotRange(db, {
      tradePointIds: ["tp-1", "tp-2"],
      sinceDate: "2026-05-15",
    });

    expect(range.currentByTradePointId["tp-1"]?.entrance.onShelf).toBe(5);
    expect(range.baselineByTradePointId["tp-1"]?.entrance.onShelf).toBe(2);
    expect(range.baselineByTradePointId["tp-2"]).toBeUndefined();
  });

  it("handleDistributionSnapshotRange filters trade points by visibility", async () => {
    const db = new InMemoryDistributionSnapshotDb();
    db.snapshots.push(
      {
        trade_point_id: "tp-visible",
        dealer_id: "client-ma001",
        snapshot_date: "2026-06-16",
        entrance_capacity: 5,
        entrance_on_shelf: 2,
        interior_capacity: 0,
        interior_on_shelf: 0,
        hardware_capacity: 0,
        hardware_on_shelf: 0,
      },
      {
        trade_point_id: "tp-hidden",
        dealer_id: "client-other",
        snapshot_date: "2026-06-16",
        entrance_capacity: 5,
        entrance_on_shelf: 4,
        interior_capacity: 0,
        interior_on_shelf: 0,
        hardware_capacity: 0,
        hardware_on_shelf: 0,
      },
    );

    const payload = await handleDistributionSnapshotRange(
      db,
      { unrestricted: false, visibleCodes: new Set(["MA001"]) },
      {
        tradePointIds: ["tp-visible", "tp-hidden"],
        sinceDate: "2026-06-01",
      },
    );

    expect(payload.success).toBe(true);
    expect(payload.currentByTradePointId["tp-visible"]).toBeTruthy();
    expect(payload.currentByTradePointId["tp-hidden"]).toBeUndefined();
  });

  it("handleDistributionSnapshotUpsert validates body", async () => {
    const db = new InMemoryDistributionSnapshotDb();
    const payload = await handleDistributionSnapshotUpsert(db, SESSION_USER, {
      tradePointId: "tp-1",
      dealerId: "client-ma001",
      byType: {
        entrance: { capacity: 1, onShelf: 1 },
        interior: { capacity: 0, onShelf: 0 },
        hardware: { capacity: 0, onShelf: 0 },
      },
    });
    expect(payload).toEqual({ ok: true });
  });
});
