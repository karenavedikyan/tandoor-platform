/**
 * Применение seed regional_manager на Neon и Yandex (Промт 115).
 */

import { neon } from "@neondatabase/serverless";
import { makePoolFromNeon } from "../server/db/neon-client.js";
import { seedRegionalManagersBatch, type RmSeedRowResult } from "./admin/rm-batch-2026-06-01-seed.js";
import { resolveNeonUrl } from "./dual-db-migrate.js";

export type RmSeedRunResult =
  | { ok: true; results: RmSeedRowResult[] }
  | { ok: false; error: string; results?: RmSeedRowResult[] };

export async function seedRmBatchOnNeon(): Promise<RmSeedRunResult> {
  const url = resolveNeonUrl();
  if (!url) return { ok: false, error: "DATABASE_URL is not configured" };
  try {
    const pool = makePoolFromNeon(neon(url));
    const results = await seedRegionalManagersBatch(pool);
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function seedRmBatchOnYandex(): Promise<RmSeedRunResult | { skipped: true; reason: string }> {
  const proxyUrl = process.env.YANDEX_PROXY_URL?.trim();
  const proxyToken = process.env.YANDEX_PROXY_TOKEN?.trim();
  if (!proxyUrl || !proxyToken) {
    return {
      skipped: true,
      reason: "YANDEX_PROXY_URL/TOKEN не настроены — seed РМ на Yandex вручную.",
    };
  }

  const { RM_BATCH_2026_06_01 } = await import("./admin/rm-batch-2026-06-01-seed.js");
  const results: RmSeedRowResult[] = [];

  for (const u of RM_BATCH_2026_06_01) {
    const email = u.email.trim().toLowerCase().replace(/'/g, "''");
    const name = u.full_name.replace(/'/g, "''");
    const hash = u.password_hash.replace(/'/g, "''");
    const sql = `
      INSERT INTO users (id, email, full_name, role, status, password_hash, must_change_password, phone, created_by)
      SELECT gen_random_uuid(), '${email}', '${name}', 'regional_manager', 'active', '${hash}', true, NULL, NULL
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = '${email}')
    `;
    try {
      const r = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${proxyToken}`,
        },
        body: JSON.stringify({ sql }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        results.push({ email: u.email, action: "exists", error: `HTTP ${r.status}: ${txt.slice(0, 120)}` });
        continue;
      }
      results.push({ email: u.email, action: "inserted" });
    } catch (e) {
      results.push({
        email: u.email,
        action: "exists",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { ok: true, results };
}
