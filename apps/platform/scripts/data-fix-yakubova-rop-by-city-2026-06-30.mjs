#!/usr/bin/env node
/**
 * Data-fix: проставить dealer_overrides.rop_id клиентам Якубовой Юлии Сергеевны
 * с пустым rop_id — по городу (территориальное деление Скалабан / Купянский).
 *
 * Идемпотентно: обновляет только строки с rop_id IS NULL (не затирает уже заданные).
 * Перед записью — бэкап затрагиваемых строк в dealer_overrides_pre_yakubova_rop_fix.
 *
 * По умолчанию dry-run. Запись: --apply
 *
 * Запуск:
 *   DATABASE_URL=... node apps/platform/scripts/data-fix-yakubova-rop-by-city-2026-06-30.mjs
 *   DATABASE_URL=... node apps/platform/scripts/data-fix-yakubova-rop-by-city-2026-06-30.mjs --apply
 */
import { neon } from "@neondatabase/serverless";

const YAKUBOVA_MANAGER_ID = "0481a81d-160b-422e-8257-cf21d134cd42";
const ROP_SKALABAN_ID = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
const ROP_KUPYANSKIY_ID = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
const ROP_SKALABAN_NAME = "Скалабан Александр";
const ROP_KUPYANSKIY_NAME = "Купянский Родион";

const SKALABAN_CITIES = new Set(
  [
    "Воронеж",
    "Липецк",
    "Лиски",
    "Елец",
    "Россошь",
    "Богучар",
    "Старый Оскол",
    "Тамбов",
    "Верхний Мамон",
    "Мичуринск",
    "Калач-Куртлак",
    "Алексеевка",
    "Павловск",
    "Бобров",
    "Подгорное",
    "Усмань",
    "Каменка",
  ].map((c) => c.toLowerCase()),
);

const apply = process.argv.includes("--apply");
const dryRun = !apply;

const databaseUrl = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  ""
).trim();

if (!databaseUrl) {
  console.error("[yakubova-rop-fix] DATABASE_URL (или POSTGRES_URL / NEON_DATABASE_URL) обязателен.");
  process.exit(1);
}

const sql = neon(databaseUrl);

function targetRopForCity(city) {
  const normalized = (city ?? "").trim().toLowerCase();
  if (SKALABAN_CITIES.has(normalized)) {
    return { ropId: ROP_SKALABAN_ID, ropName: ROP_SKALABAN_NAME };
  }
  return { ropId: ROP_KUPYANSKIY_ID, ropName: ROP_KUPYANSKIY_NAME };
}

async function main() {
  console.log(`[yakubova-rop-fix] mode: ${dryRun ? "dry-run (use --apply to write)" : "APPLY"}`);

  const candidates = await sql`
    SELECT DISTINCT
      ca.client_code,
      d.city,
      d.external_key,
      d.id::text AS dealer_uuid,
      d_ov.dealer_id AS override_dealer_id,
      d_ov.rop_id::text AS current_rop_id
    FROM client_assignments ca
    INNER JOIN dealers d ON upper(d.release_code) = ca.client_code
    LEFT JOIN dealer_overrides d_ov ON (
      d_ov.dealer_id = d.id::text
      OR d_ov.dealer_id = d.external_key
      OR (
        d.release_code IS NOT NULL
        AND lower(d_ov.dealer_id) = 'client-' || lower(d.release_code)
      )
    )
    WHERE ca.responsible_user_id = ${YAKUBOVA_MANAGER_ID}::uuid
      AND d_ov.rop_id IS NULL
    ORDER BY ca.client_code
  `;

  if (candidates.length === 0) {
    console.log("[yakubova-rop-fix] нет клиентов с пустым rop_id — нечего обновлять.");
    return;
  }

  const plan = candidates.map((row) => {
    const target = targetRopForCity(row.city);
    const dealerId = row.override_dealer_id ?? `client-${String(row.client_code).toLowerCase()}`;
    return {
      client_code: row.client_code,
      city: row.city,
      dealer_id: dealerId,
      target_rop_id: target.ropId,
      target_rop_name: target.ropName,
    };
  });

  const skalabanCount = plan.filter((p) => p.target_rop_id === ROP_SKALABAN_ID).length;
  const kupyanskiyCount = plan.filter((p) => p.target_rop_id === ROP_KUPYANSKIY_ID).length;

  console.log(`[yakubova-rop-fix] candidates: ${plan.length} (Скалабан: ${skalabanCount}, Купянский: ${kupyanskiyCount})`);
  for (const row of plan) {
    console.log(`  ${row.client_code} | ${row.city ?? "—"} → ${row.target_rop_name}`);
  }

  if (dryRun) {
    console.log("[yakubova-rop-fix] dry-run complete — no writes.");
    return;
  }

  console.log("[yakubova-rop-fix] creating backup table ...");
  await sql`
    CREATE TABLE IF NOT EXISTS dealer_overrides_pre_yakubova_rop_fix (
      LIKE dealer_overrides INCLUDING ALL
    )
  `;

  const dealerIds = plan.map((p) => p.dealer_id);
  await sql`
    INSERT INTO dealer_overrides_pre_yakubova_rop_fix
    SELECT d_ov.*
    FROM dealer_overrides d_ov
    WHERE d_ov.dealer_id = ANY(${dealerIds}::text[])
      AND NOT EXISTS (
        SELECT 1 FROM dealer_overrides_pre_yakubova_rop_fix b
        WHERE b.dealer_id = d_ov.dealer_id
      )
  `;

  let updated = 0;
  for (const row of plan) {
    const result = await sql`
      INSERT INTO dealer_overrides (dealer_id, rop_id, rop_name, created_at, updated_at)
      VALUES (${row.dealer_id}, ${row.target_rop_id}::uuid, ${row.target_rop_name}, now(), now())
      ON CONFLICT (dealer_id) DO UPDATE
        SET rop_id = EXCLUDED.rop_id,
            rop_name = EXCLUDED.rop_name,
            updated_at = now()
        WHERE dealer_overrides.rop_id IS NULL
      RETURNING dealer_id
    `;
    updated += result.length;
  }

  console.log(`[yakubova-rop-fix] updated rows: ${updated}`);
  console.log("[yakubova-rop-fix] done.");
}

main().catch((err) => {
  console.error("[yakubova-rop-fix] fatal:", err);
  process.exit(1);
});
