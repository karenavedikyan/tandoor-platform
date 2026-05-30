#!/usr/bin/env node
/**
 * Smoke: upsert dealer override + get (requires DATABASE_URL and migrated schema).
 * Usage: DATABASE_URL=... node scripts/smoke-overrides-api.mjs
 */

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = neon(url);
const dealerId = `smoke-dealer-${Date.now()}`;

try {
  await sql`INSERT INTO dealer_overrides (dealer_id, name, client_category, updated_at)
    VALUES (${dealerId}, ${"Smoke Test"}, ${"top150"}, NOW())
    ON CONFLICT (dealer_id) DO UPDATE SET name = EXCLUDED.name, client_category = EXCLUDED.client_category`;

  const rows = await sql`SELECT dealer_id, name, client_category FROM dealer_overrides WHERE dealer_id = ${dealerId}`;
  const row = rows[0];
  if (!row || row.name !== "Smoke Test" || row.client_category !== "top150") {
    console.error("Mismatch after upsert", row);
    process.exit(1);
  }

  await sql`DELETE FROM dealer_override_events WHERE dealer_id = ${dealerId}`;
  await sql`DELETE FROM dealer_overrides WHERE dealer_id = ${dealerId}`;

  console.log("✓ smoke-overrides-api OK", dealerId);
} catch (e) {
  console.error("smoke-overrides-api failed:", e);
  process.exit(1);
}
