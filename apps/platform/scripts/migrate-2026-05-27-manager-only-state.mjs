#!/usr/bin/env node
/**
 * Промт 50 — миграция 2026-05-27. Backfill для бизнес-правила «архив / корзина /
 * manual / overrides живут только в state менеджера».
 *
 * Что делает:
 *   1. Создаёт резервную копию `client_base_actualization_state_backup_2026_05_27`
 *      (если ещё не создана). Идемпотентно.
 *   2. Считает, сколько строк попадает под фильтр (не-manager / NULL role).
 *   3. Обнуляет 14 manager-only ключей в JSONB-поле `state` для этих строк.
 *
 * Идемпотентно: повторный запуск ничего не сломает; уже обнулённые поля
 * остаются обнулёнными.
 *
 * Запуск:
 *   DATABASE_URL=... node apps/platform/scripts/migrate-2026-05-27-manager-only-state.mjs
 *   (или) cd apps/platform && npm run migrate:manager-only-state
 */
import { neon } from "@neondatabase/serverless";

const databaseUrl = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  ""
).trim();

if (!databaseUrl) {
  console.error("[migrate-manager-only-state] DATABASE_URL (или POSTGRES_URL / NEON_DATABASE_URL) обязателен.");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  console.log("[migrate-manager-only-state] step 1: backup table ...");
  await sql`
    CREATE TABLE IF NOT EXISTS client_base_actualization_state_backup_2026_05_27 AS
    SELECT * FROM client_base_actualization_state
  `;
  const [backupCount] = await sql`SELECT count(*)::int AS n FROM client_base_actualization_state_backup_2026_05_27`;
  console.log(`[migrate-manager-only-state]   backup rows: ${backupCount?.n ?? "?"}`);

  console.log("[migrate-manager-only-state] step 2: count non-manager rows ...");
  const [countRow] = await sql`
    SELECT count(*)::int AS n
    FROM client_base_actualization_state
    WHERE role IS NULL OR lower(role) NOT IN ('manager', 'sales_manager')
  `;
  const targetCount = countRow?.n ?? 0;
  console.log(`[migrate-manager-only-state]   target rows: ${targetCount}`);

  if (targetCount === 0) {
    console.log("[migrate-manager-only-state] nothing to update — done.");
    return;
  }

  console.log("[migrate-manager-only-state] step 3: zeroing 14 manager-only fields ...");
  const result = await sql`
    UPDATE client_base_actualization_state
    SET state = state
      || jsonb_build_object(
        'archivedDealersById', '{}'::jsonb,
        'archivedTradePointsById', '{}'::jsonb,
        'archivedLegalEntitiesById', '{}'::jsonb,
        'trashedDealersById', '{}'::jsonb,
        'trashedTradePointsById', '{}'::jsonb,
        'manuallyCreatedDealersById', '{}'::jsonb,
        'manuallyCreatedTradePointsById', '{}'::jsonb,
        'dealerOverridesById', '{}'::jsonb,
        'tradePointOverridesById', '{}'::jsonb,
        'legalEntityOverridesByDealerId', '{}'::jsonb,
        'dealerActualizationContactsById', '{}'::jsonb,
        'dealerActualizationAuditByDealerId', '{}'::jsonb,
        'dealerPhotosByDealerId', '{}'::jsonb,
        'tradePointPhotosByTradePointId', '{}'::jsonb
      ),
      updated_at = now()
    WHERE role IS NULL
       OR lower(role) NOT IN ('manager', 'sales_manager')
    RETURNING scope_key
  `;
  console.log(`[migrate-manager-only-state]   updated rows: ${result?.length ?? 0}`);
  console.log("[migrate-manager-only-state] done.");
}

main().catch((err) => {
  console.error("[migrate-manager-only-state] failed:", err);
  process.exit(1);
});
