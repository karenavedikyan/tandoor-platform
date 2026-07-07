/**
 * Upsert handlers for exchange_legals_raw shadow table.
 */

import type { PoolLike } from "../../server/db/neon-client.js";
import type { ExchangeLegalRawRow } from "./exchange-legals-xml-parser.js";

export type UpsertLegalStats = { inserted: number; updated: number; unchanged: number };

type ExistingLegalRow = ExchangeLegalRawRow;

function nullableEq(a: string | number | null | undefined, b: string | number | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

function legalRowEqual(a: ExchangeLegalRawRow, b: ExistingLegalRow): boolean {
  return (
    a.name === b.name &&
    nullableEq(a.legal_name, b.legal_name) &&
    nullableEq(a.inn, b.inn) &&
    nullableEq(a.kpp, b.kpp) &&
    nullableEq(a.ogrn, b.ogrn) &&
    nullableEq(a.ma_number, b.ma_number) &&
    nullableEq(a.payment_form, b.payment_form) &&
    nullableEq(a.region, b.region) &&
    nullableEq(a.city, b.city) &&
    nullableEq(a.client_type, b.client_type) &&
    nullableEq(a.phone, b.phone) &&
    nullableEq(a.email, b.email) &&
    nullableEq(a.discount_code, b.discount_code) &&
    nullableEq(a.discount_percent, b.discount_percent) &&
    nullableEq(a.regional_manager_1c, b.regional_manager_1c) &&
    nullableEq(a.regional_manager_name, b.regional_manager_name) &&
    nullableEq(a.responsible_manager_1c, b.responsible_manager_1c) &&
    nullableEq(a.responsible_manager_name, b.responsible_manager_name) &&
    nullableEq(a.furniture_manager_1c, b.furniture_manager_1c) &&
    nullableEq(a.furniture_manager_name, b.furniture_manager_name) &&
    nullableEq(a.furniture_manager_phone, b.furniture_manager_phone) &&
    nullableEq(a.parent_1c, b.parent_1c) &&
    nullableEq(a.plan_retro_bonus, b.plan_retro_bonus) &&
    nullableEq(a.plan_sum, b.plan_sum)
  );
}

export async function upsertExchangeLegalsBatch(
  pool: PoolLike,
  rows: ExchangeLegalRawRow[],
  sourceFile: string,
): Promise<UpsertLegalStats> {
  const stats: UpsertLegalStats = { inserted: 0, updated: 0, unchanged: 0 };
  if (rows.length === 0) return stats;

  const ids = rows.map((r) => r.id_1c);
  const existingRes = await pool.query<ExistingLegalRow>(
    `SELECT id_1c, name, legal_name, inn, kpp, ogrn, ma_number, payment_form, region, city,
            client_type, phone, email, discount_code, discount_percent,
            regional_manager_1c, regional_manager_name,
            responsible_manager_1c, responsible_manager_name,
            furniture_manager_1c, furniture_manager_name, furniture_manager_phone,
            parent_1c, plan_retro_bonus, plan_sum
     FROM exchange_legals_raw WHERE id_1c = ANY($1::uuid[])`,
    [ids],
  );
  const existingMap = new Map(existingRes.rows.map((r) => [r.id_1c, r]));

  for (const row of rows) {
    const ex = existingMap.get(row.id_1c);
    if (!ex) stats.inserted += 1;
    else if (legalRowEqual(row, ex)) stats.unchanged += 1;
    else stats.updated += 1;
  }

  await pool.query(
    `INSERT INTO exchange_legals_raw (
       id_1c, name, legal_name, inn, kpp, ogrn, ma_number, payment_form, region, city,
       client_type, phone, email, discount_code, discount_percent,
       regional_manager_1c, regional_manager_name,
       responsible_manager_1c, responsible_manager_name,
       furniture_manager_1c, furniture_manager_name, furniture_manager_phone,
       parent_1c, plan_retro_bonus, plan_sum, source_file
     )
     SELECT * FROM UNNEST(
       $1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
       $8::text[], $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::text[],
       $15::numeric[], $16::uuid[], $17::text[], $18::uuid[], $19::text[], $20::uuid[],
       $21::text[], $22::text[], $23::uuid[], $24::text[], $25::numeric[], $26::text[]
     )
     ON CONFLICT (id_1c) DO UPDATE SET
       name = EXCLUDED.name,
       legal_name = EXCLUDED.legal_name,
       inn = EXCLUDED.inn,
       kpp = EXCLUDED.kpp,
       ogrn = EXCLUDED.ogrn,
       ma_number = EXCLUDED.ma_number,
       payment_form = EXCLUDED.payment_form,
       region = EXCLUDED.region,
       city = EXCLUDED.city,
       client_type = EXCLUDED.client_type,
       phone = EXCLUDED.phone,
       email = EXCLUDED.email,
       discount_code = EXCLUDED.discount_code,
       discount_percent = EXCLUDED.discount_percent,
       regional_manager_1c = EXCLUDED.regional_manager_1c,
       regional_manager_name = EXCLUDED.regional_manager_name,
       responsible_manager_1c = EXCLUDED.responsible_manager_1c,
       responsible_manager_name = EXCLUDED.responsible_manager_name,
       furniture_manager_1c = EXCLUDED.furniture_manager_1c,
       furniture_manager_name = EXCLUDED.furniture_manager_name,
       furniture_manager_phone = EXCLUDED.furniture_manager_phone,
       parent_1c = EXCLUDED.parent_1c,
       plan_retro_bonus = EXCLUDED.plan_retro_bonus,
       plan_sum = EXCLUDED.plan_sum,
       source_file = EXCLUDED.source_file,
       imported_at = NOW(),
       updated_at = NOW()`,
    [
      rows.map((r) => r.id_1c),
      rows.map((r) => r.name),
      rows.map((r) => r.legal_name),
      rows.map((r) => r.inn),
      rows.map((r) => r.kpp),
      rows.map((r) => r.ogrn),
      rows.map((r) => r.ma_number),
      rows.map((r) => r.payment_form),
      rows.map((r) => r.region),
      rows.map((r) => r.city),
      rows.map((r) => r.client_type),
      rows.map((r) => r.phone),
      rows.map((r) => r.email),
      rows.map((r) => r.discount_code),
      rows.map((r) => r.discount_percent),
      rows.map((r) => r.regional_manager_1c),
      rows.map((r) => r.regional_manager_name),
      rows.map((r) => r.responsible_manager_1c),
      rows.map((r) => r.responsible_manager_name),
      rows.map((r) => r.furniture_manager_1c),
      rows.map((r) => r.furniture_manager_name),
      rows.map((r) => r.furniture_manager_phone),
      rows.map((r) => r.parent_1c),
      rows.map((r) => r.plan_retro_bonus),
      rows.map((r) => r.plan_sum),
      rows.map(() => sourceFile),
    ],
  );

  return stats;
}

export async function upsertExchangeLegalsInBatches(
  pool: PoolLike,
  rows: ExchangeLegalRawRow[],
  sourceFile: string,
  batchSize = 200,
): Promise<UpsertLegalStats> {
  const total: UpsertLegalStats = { inserted: 0, updated: 0, unchanged: 0 };
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const s = await upsertExchangeLegalsBatch(pool, batch, sourceFile);
    total.inserted += s.inserted;
    total.updated += s.updated;
    total.unchanged += s.unchanged;
  }
  return total;
}
