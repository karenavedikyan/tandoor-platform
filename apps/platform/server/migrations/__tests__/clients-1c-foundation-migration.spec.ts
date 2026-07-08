import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { refreshClients1cMv } from "../../../shared/clients-1c/refresh-mv.js";
import type { PoolLike } from "../../../server/db/neon-client.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(here, "..", "2026_07_11_clients_1c_foundation.sql");
const sql = readFileSync(migrationPath, "utf8");

const hasDatabase = Boolean(
  process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim(),
);

describe("clients-1c foundation migration SQL", () => {
  it("is idempotent via drop-before-create", () => {
    expect(sql).toContain("DROP FUNCTION IF EXISTS refresh_clients_1c_mv()");
    expect(sql).toContain("DROP MATERIALIZED VIEW IF EXISTS mv_clients_1c");
    expect(sql).toContain("DROP MATERIALIZED VIEW IF EXISTS mv_stores_1c");
    expect(sql).toContain("DROP VIEW IF EXISTS v_store_distribution");
    expect(sql).toContain("CREATE OR REPLACE VIEW v_store_distribution");
    expect(sql).toContain("CREATE MATERIALIZED VIEW mv_stores_1c");
    expect(sql).toContain("CREATE MATERIALIZED VIEW mv_clients_1c");
  });

  it("defines v_store_distribution with override_1c priority over matrix_lk", () => {
    expect(sql).toContain("override_rows");
    expect(sql).toContain("matrix_rows");
    expect(sql).toContain("FROM showcase_distribution_overrides_1c");
    expect(sql).toContain("FROM showcase_matrix_entries sme");
    expect(sql).toContain("tp.external_key = sme.trade_point_id");
    expect(sql).toContain("esr.linked_trade_point_id = tp.id");
    expect(sql).toContain("DISTINCT ON (store_id_1c, target_kind, target_id)");
    expect(sql).toContain("CASE source WHEN 'override_1c' THEN 0 ELSE 1 END");
  });

  it("creates mv_stores_1c with distribution and orders aggregates", () => {
    expect(sql).toContain("distribution_filled_count");
    expect(sql).toContain("distribution_total_targets");
    expect(sql).toContain("distribution_percent");
    expect(sql).toContain("orders_last_90d_count");
    expect(sql).toContain("orders_last_90d_amount");
    expect(sql).toContain("holding_id_1c");
    expect(sql).toContain("uq_mv_stores_1c_store_id");
    expect(sql).toContain("bo.store_uuid");
  });

  it("creates mv_clients_1c grouped by holding with weighted distribution_percent", () => {
    expect(sql).toContain("FROM mv_stores_1c ms");
    expect(sql).toContain("GROUP BY ms.holding_id_1c");
    expect(sql).toContain("uq_mv_clients_1c_holding_id");
    expect(sql).toContain("SUM(ms.distribution_filled_count)");
    expect(sql).toContain("SUM(ms.distribution_total_targets)");
  });

  it("defines refresh_clients_1c_mv with concurrent refresh and initial non-concurrent load", () => {
    expect(sql).toContain("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stores_1c");
    expect(sql).toContain("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_clients_1c");
    expect(sql).toMatch(/REFRESH MATERIALIZED VIEW mv_stores_1c;\s*\nREFRESH MATERIALIZED VIEW mv_clients_1c;/);
  });

  it("does not alter dealers or showcase_matrix_entries schema", () => {
    expect(sql).not.toContain("ALTER TABLE dealers");
    expect(sql).not.toContain("ALTER TABLE trade_points");
    expect(sql).not.toContain("ALTER TABLE showcase_matrix_entries");
  });
});

describe("refreshClients1cMv", () => {
  it("calls refresh_clients_1c_mv() and returns timing metadata", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const pool = { query } as unknown as PoolLike;
    const result = await refreshClients1cMv(pool);
    expect(query).toHaveBeenCalledWith("SELECT refresh_clients_1c_mv()");
    expect(result.ok).toBe(true);
    expect(result.refreshedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });
});

describe.skipIf(!hasDatabase)("clients-1c foundation migration (integration)", () => {
  it("applies migration twice without error", async () => {
    const { neon } = await import("@neondatabase/serverless");
    const { makePoolFromNeon } = await import("../../../server/db/neon-client.js");
    const url =
      process.env.DATABASE_URL?.trim() ||
      process.env.POSTGRES_URL?.trim() ||
      process.env.POSTGRES_URL_NON_POOLING?.trim();
    const pool = makePoolFromNeon(neon(url!));
    await pool.query(sql);
    await pool.query(sql);
    const views = await pool.query<{ name: string }>(
      `SELECT matviewname AS name FROM pg_matviews WHERE matviewname IN ('mv_stores_1c', 'mv_clients_1c') ORDER BY matviewname`,
    );
    expect(views.rows.map((r) => r.name)).toEqual(["mv_clients_1c", "mv_stores_1c"]);
  });

  it("v_store_distribution prefers override_1c over matrix_lk for same key", async () => {
    const { neon } = await import("@neondatabase/serverless");
    const { makePoolFromNeon } = await import("../../../server/db/neon-client.js");
    const url =
      process.env.DATABASE_URL?.trim() ||
      process.env.POSTGRES_URL?.trim() ||
      process.env.POSTGRES_URL_NON_POOLING?.trim();
    const pool = makePoolFromNeon(neon(url!));

    const storeId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const targetId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const dealerId = "client-ma-test-foundation";
    const tpKey = "client-ma-test-foundation-01";

    await pool.query(`DELETE FROM showcase_distribution_overrides_1c WHERE store_id_1c = $1::uuid`, [storeId]);
    await pool.query(`DELETE FROM showcase_matrix_entries WHERE trade_point_id = $1`, [tpKey]);
    await pool.query(`DELETE FROM exchange_stores_raw WHERE id_1c = $1::uuid`, [storeId]);
    await pool.query(`DELETE FROM trade_points WHERE external_key = $1`, [tpKey]);
    await pool.query(`DELETE FROM dealers WHERE external_key = $1`, [dealerId]);

    await pool.query(
      `INSERT INTO dealers (external_key, name) VALUES ($1, 'Test Foundation Dealer')
       ON CONFLICT (external_key) DO NOTHING`,
      [dealerId],
    );
    const dealerRes = await pool.query<{ id: string }>(`SELECT id::text FROM dealers WHERE external_key = $1`, [
      dealerId,
    ]);
    const dealerUuid = dealerRes.rows[0]?.id;
    expect(dealerUuid).toBeTruthy();

    await pool.query(
      `INSERT INTO trade_points (external_key, dealer_id, name)
       VALUES ($1, $2::uuid, 'Test TP')
       ON CONFLICT (external_key) DO NOTHING`,
      [tpKey, dealerUuid],
    );
    const tpRes = await pool.query<{ id: string }>(`SELECT id::text FROM trade_points WHERE external_key = $1`, [
      tpKey,
    ]);
    const tpUuid = tpRes.rows[0]?.id;

    await pool.query(
      `INSERT INTO exchange_stores_raw (id_1c, name, source_file, linked_trade_point_id, status)
       VALUES ($1::uuid, 'Test Store', 'test.sql', $2::uuid, 'linked')
       ON CONFLICT (id_1c) DO UPDATE SET linked_trade_point_id = EXCLUDED.linked_trade_point_id`,
      [storeId, tpUuid],
    );

    await pool.query(
      `INSERT INTO showcase_matrix_entries (
         dealer_id, trade_point_id, target_kind, target_id, status,
         placement_type, placement_actual, updated_by_name
       ) VALUES ($1, $2, 'placement', $3, 'installed', 'portal', 1, 'matrix_lk')`,
      [dealerId, tpKey, targetId],
    );

    await pool.query(
      `INSERT INTO showcase_distribution_overrides_1c (
         store_id_1c, target_kind, target_id, status,
         placement_type, placement_actual, updated_by_name
       ) VALUES ($1::uuid, 'placement', $2::uuid, 'planned', 'portal', 9, 'override_1c')`,
      [storeId, targetId],
    );

    const row = await pool.query<{ source: string; placement_actual: number }>(
      `SELECT source, placement_actual
       FROM v_store_distribution
       WHERE store_id_1c = $1::uuid AND target_kind = 'placement' AND target_id = $2`,
      [storeId, targetId],
    );
    expect(row.rows[0]?.source).toBe("override_1c");
    expect(row.rows[0]?.placement_actual).toBe(9);

    await pool.query(`DELETE FROM showcase_distribution_overrides_1c WHERE store_id_1c = $1::uuid`, [storeId]);
    await pool.query(`DELETE FROM showcase_matrix_entries WHERE trade_point_id = $1`, [tpKey]);
    await pool.query(`DELETE FROM exchange_stores_raw WHERE id_1c = $1::uuid`, [storeId]);
    await pool.query(`DELETE FROM trade_points WHERE external_key = $1`, [tpKey]);
    await pool.query(`DELETE FROM dealers WHERE external_key = $1`, [dealerId]);
  });
});
