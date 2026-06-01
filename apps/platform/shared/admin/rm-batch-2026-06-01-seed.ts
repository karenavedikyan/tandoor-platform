/**
 * Промт 115: пакетное создание пользователей regional_manager (Neon + Yandex).
 * Хеши bcrypt (10 rounds) сгенерированы при подготовке релиза.
 */

import { randomUUID } from "node:crypto";
import type { PoolLike } from "./admin-auth.js";

export type RmBatchSeedUser = {
  email: string;
  full_name: string;
  password_hash: string;
};

/** SYNC: apps/platform/docs/credentials-rm-batch-2026-06-01.md */
export const RM_BATCH_2026_06_01: readonly RmBatchSeedUser[] = [
  {
    email: "drogobitsky-ii@tandoor.local",
    full_name: "Дрогобицкий Игорь Игоревич",
    password_hash: "$2a$10$gteKVI/tEv6n3Rv3A66uWueWjU/DB5iMTA86iwq4dexoV2I6GQvpC",
  },
  {
    email: "bogachev-dn@tandoor.local",
    full_name: "Богачёв Денис Николаевич",
    password_hash: "$2a$10$yT2SuC73mqZ.2pb4WKM.Se7PpHXR9QAI8TI6.jun5jxvyC.PpD8IG",
  },
  {
    email: "dzodzikov-gv@tandoor.local",
    full_name: "Дзодзиков Георгий Владимирович",
    password_hash: "$2a$10$E/.skWOzzr.JOvxxXVNzBeCVLNJYDdI1/eCWWTyj32AVwsJ3FVYDu",
  },
  {
    email: "serebryakov-yu@tandoor.local",
    full_name: "Серебряков Юрий",
    password_hash: "$2a$10$Uy9BDPkvWxYx8Mzxi3m3BuBvKi46fRCDyOJs5/j5Y1cyGmN.UJfpG",
  },
  {
    email: "melnik-vv@tandoor.local",
    full_name: "Мельник Виктор Викторович",
    password_hash: "$2a$10$GnowsGhtbihDyYcDt.E8c.WNv2Uk9r7ZV8DARTe8YvUgq9fCP3stK",
  },
] as const;

export type RmSeedRowResult = {
  email: string;
  action: "inserted" | "exists" | "updated_role";
  id?: string;
  error?: string;
};

export async function seedRegionalManagersBatch(pool: PoolLike): Promise<RmSeedRowResult[]> {
  const results: RmSeedRowResult[] = [];

  for (const u of RM_BATCH_2026_06_01) {
    const email = u.email.trim().toLowerCase();
    try {
      const existing = await pool.query<{ id: string; role: string }>(
        `SELECT id, role FROM users WHERE lower(email) = $1 LIMIT 1`,
        [email],
      );
      if (existing.rows[0]) {
        const id = String(existing.rows[0].id);
        const role = String(existing.rows[0].role);
        if (role !== "regional_manager") {
          await pool.query(
            `UPDATE users SET role = 'regional_manager', status = 'active', must_change_password = true, updated_at = NOW()
             WHERE id = $1::uuid`,
            [id],
          );
          results.push({ email, action: "updated_role", id });
        } else {
          results.push({ email, action: "exists", id });
        }
        continue;
      }

      const id = randomUUID();
      await pool.query(
        `INSERT INTO users (id, email, full_name, role, status, password_hash, must_change_password, phone, created_by)
         VALUES ($1::uuid, $2, $3, 'regional_manager', 'active', $4, true, NULL, NULL)`,
        [id, email, u.full_name, u.password_hash],
      );
      results.push({ email, action: "inserted", id });
    } catch (e) {
      results.push({
        email,
        action: "exists",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}
