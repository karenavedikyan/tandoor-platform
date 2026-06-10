/**
 * Запуск: `npm run test:city-shadow` из каталога apps/platform.
 *
 * Промт 278 — shadow-write города из актуализации в dealer_overrides.city.
 */
import assert from "node:assert/strict";
import type { PoolLike } from "../../../shared/admin/admin-auth.js";
import { shadowWriteCitiesFromActualization } from "../../../shared/actualization-city-shadow.js";
import { upsertDealerOverrideCity } from "../../../shared/dealer-overrides-handlers.js";

const ACTOR_UUID = "d43940b0-f52f-413e-8de6-7d62d5dcc8b5";
const DEALER_A = "client-ma-test-a";
const DEALER_B = "client-ma-test-b";

type QueryCall = { sql: string; params: unknown[] };

function makeMockPool(handlers: {
  onQuery?: (sql: string, params: unknown[]) => unknown;
  failForDealer?: string;
}): { pool: PoolLike; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const pool: PoolLike = {
    async query<T>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
      calls.push({ sql: text, params });
      if (handlers.failForDealer && text.includes("dealer_overrides") && params[0] === handlers.failForDealer) {
        throw new Error(`mock failure for ${handlers.failForDealer}`);
      }
      if (handlers.onQuery) {
        const result = handlers.onQuery(text, params);
        if (Array.isArray(result)) return { rows: result as T[] };
        if (result && typeof result === "object" && "rows" in (result as object)) {
          return result as { rows: T[] };
        }
      }
      if (text.includes("SELECT * FROM dealer_overrides")) return { rows: [] };
      return { rows: [] };
    },
  };
  return { pool, calls };
}

function fields(city: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { city, name: "Pilot Name", rop_name: "Pilot ROP", ...extra };
}

function stateWith(
  overrides: Record<string, { fields: Record<string, unknown> }>,
): Record<string, unknown> {
  return { dealerOverridesById: overrides };
}

// ==========================================================================
// upsertDealerOverrideCity
// ==========================================================================
{
  const { pool, calls } = makeMockPool({
    onQuery: (sql) => {
      if (sql.includes("SELECT * FROM dealer_overrides")) {
        return { rows: [{ dealer_id: DEALER_A, city: "Старый" }] };
      }
      return { rows: [] };
    },
  });

  await upsertDealerOverrideCity(pool, DEALER_A, "Бутурлиновка", ACTOR_UUID);

  const eventInsert = calls.find((c) => c.sql.includes("INSERT INTO dealer_override_events"));
  assert.ok(eventInsert, "logs dealer_override_events");
  assert.equal(eventInsert?.params[1], "city");
  assert.equal(eventInsert?.params[3], "Бутурлиновка");
  assert.equal(eventInsert?.params[4], ACTOR_UUID);

  const update = calls.find((c) => c.sql.includes("UPDATE dealer_overrides SET city"));
  assert.ok(update, "updates dealer_overrides.city");
  assert.equal(update?.params[1], "Бутурлиновка");

  const touchedFields = calls
    .filter((c) => c.sql.includes("dealer_overrides") && !c.sql.includes("SELECT"))
    .flatMap((c) => c.sql);
  assert.ok(!touchedFields.some((s) => s.includes("name =")), "does not touch name");
  assert.ok(!touchedFields.some((s) => s.includes("rop_name")), "does not touch rop_name");
}

// ==========================================================================
// shadowWriteCitiesFromActualization — diff only
// ==========================================================================
{
  const upserted: Array<{ dealerId: string; city: string }> = [];
  const { pool } = makeMockPool({
    onQuery: (sql, params) => {
      if (sql.includes("SELECT * FROM dealer_overrides")) return { rows: [] };
      if (sql.includes("INSERT INTO dealer_overrides")) {
        upserted.push({ dealerId: String(params[0]), city: String(params[1]) });
      }
      return { rows: [] };
    },
  });

  const prev = stateWith({
    [DEALER_A]: { fields: fields("Воронеж") },
    [DEALER_B]: { fields: fields("Липецк") },
  });
  const next = stateWith({
    [DEALER_A]: { fields: fields("Бутурлиновка") },
    [DEALER_B]: { fields: fields("Липецк") },
  });

  await shadowWriteCitiesFromActualization(pool, prev, next, ACTOR_UUID);

  assert.equal(upserted.length, 1, "writes only changed city");
  assert.equal(upserted[0]?.dealerId, DEALER_A);
  assert.equal(upserted[0]?.city, "Бутурлиновка");
}

// ==========================================================================
// shadowWriteCitiesFromActualization — skip empty city
// ==========================================================================
{
  const upserted: string[] = [];
  const { pool } = makeMockPool({
    onQuery: (sql, params) => {
      if (sql.includes("INSERT INTO dealer_overrides")) upserted.push(String(params[0]));
      return { rows: [] };
    },
  });

  const prev = stateWith({ [DEALER_A]: { fields: fields("Воронеж") } });
  const next = stateWith({ [DEALER_A]: { fields: fields("   ") } });

  await shadowWriteCitiesFromActualization(pool, prev, next, ACTOR_UUID);
  assert.equal(upserted.length, 0, "does not clear city with blank actualization value");
}

// ==========================================================================
// shadowWriteCitiesFromActualization — other fields ignored
// ==========================================================================
{
  const upserted: string[] = [];
  const { pool } = makeMockPool({
    onQuery: (sql, params) => {
      if (sql.includes("INSERT INTO dealer_overrides")) upserted.push(String(params[0]));
      return { rows: [] };
    },
  });

  const prev = stateWith({ [DEALER_A]: { fields: fields("Воронеж") } });
  const next = stateWith({
    [DEALER_A]: { fields: { city: "Воронеж", name: "New Pilot", rop_name: "New ROP" } },
  });

  await shadowWriteCitiesFromActualization(pool, prev, next, ACTOR_UUID);
  assert.equal(upserted.length, 0, "name/rop_name change without city diff does not upsert");
}

// ==========================================================================
// shadowWriteCitiesFromActualization — isolated per-dealer errors
// ==========================================================================
{
  const upserted: string[] = [];
  const { pool } = makeMockPool({
    failForDealer: DEALER_A,
    onQuery: (sql, params) => {
      if (sql.includes("INSERT INTO dealer_overrides")) upserted.push(String(params[0]));
      return { rows: [] };
    },
  });

  const prev = stateWith({
    [DEALER_A]: { fields: fields("A") },
    [DEALER_B]: { fields: fields("B") },
  });
  const next = stateWith({
    [DEALER_A]: { fields: fields("A2") },
    [DEALER_B]: { fields: fields("C") },
  });

  await shadowWriteCitiesFromActualization(pool, prev, next, ACTOR_UUID);
  assert.equal(upserted.length, 1, "continues after one dealer fails");
  assert.equal(upserted[0], DEALER_B);
}

// ==========================================================================
// shadowWriteCitiesFromActualization — no-op without pool
// ==========================================================================
{
  let called = false;
  const pool: PoolLike = {
    async query() {
      called = true;
      return { rows: [] };
    },
  };

  await shadowWriteCitiesFromActualization(null, null, stateWith({ [DEALER_A]: { fields: fields("X") } }), ACTOR_UUID);
  assert.equal(called, false, "null pool is no-op");
  void pool;
}

console.log("city-shadow.test.ts: all assertions passed");
