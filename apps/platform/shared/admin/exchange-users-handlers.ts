/**
 * Upsert handlers for exchange_users_raw shadow table.
 */

import type { PoolLike } from "../../server/db/neon-client.js";
import type { ExchangeUserRawRow } from "./exchange-users-xml-parser.js";

export type UpsertUserStats = { inserted: number; updated: number; unchanged: number };

type ExistingUserRow = {
  id_1c: string;
  name: string;
  phone: string | null;
};

function userRowEqual(a: ExchangeUserRawRow, b: ExistingUserRow): boolean {
  return a.name === b.name && (a.phone ?? null) === (b.phone ?? null);
}

export async function upsertExchangeUsersBatch(
  pool: PoolLike,
  rows: ExchangeUserRawRow[],
  sourceFile: string,
): Promise<UpsertUserStats> {
  const stats: UpsertUserStats = { inserted: 0, updated: 0, unchanged: 0 };
  if (rows.length === 0) return stats;

  const ids = rows.map((r) => r.id_1c);
  const existingRes = await pool.query<ExistingUserRow>(
    `SELECT id_1c, name, phone FROM exchange_users_raw WHERE id_1c = ANY($1::uuid[])`,
    [ids],
  );
  const existingMap = new Map(existingRes.rows.map((r) => [r.id_1c, r]));

  for (const row of rows) {
    const ex = existingMap.get(row.id_1c);
    if (!ex) stats.inserted += 1;
    else if (userRowEqual(row, ex)) stats.unchanged += 1;
    else stats.updated += 1;
  }

  await pool.query(
    `INSERT INTO exchange_users_raw (id_1c, name, phone, source_file)
     SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::text[], $4::text[])
     ON CONFLICT (id_1c) DO UPDATE SET
       name = EXCLUDED.name,
       phone = EXCLUDED.phone,
       source_file = EXCLUDED.source_file,
       imported_at = NOW(),
       updated_at = NOW()`,
    [
      rows.map((r) => r.id_1c),
      rows.map((r) => r.name),
      rows.map((r) => r.phone),
      rows.map(() => sourceFile),
    ],
  );

  return stats;
}

export async function upsertExchangeUsersInBatches(
  pool: PoolLike,
  rows: ExchangeUserRawRow[],
  sourceFile: string,
  batchSize = 200,
): Promise<UpsertUserStats> {
  const total: UpsertUserStats = { inserted: 0, updated: 0, unchanged: 0 };
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const s = await upsertExchangeUsersBatch(pool, batch, sourceFile);
    total.inserted += s.inserted;
    total.updated += s.updated;
    total.unchanged += s.unchanged;
  }
  return total;
}
