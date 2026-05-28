/**
 * Drizzle (Neon HTTP) для `shared/auth-schema.ts`.
 * Без `DATABASE_URL` / `POSTGRES_URL` / `NEON_DATABASE_URL` — `null` (сессии недоступны).
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as authSchema from "@shared/auth-schema";
import { wrapNeonWithShadow } from "../db/neon-client.js";

export type AuthDrizzle = ReturnType<typeof drizzle<typeof authSchema>>;

let cached: AuthDrizzle | null | undefined;

function resolvePostgresUrl(): string | null {
  const a = process.env.DATABASE_URL?.trim();
  if (a) return a;
  const b = process.env.POSTGRES_URL?.trim();
  if (b) return b;
  const c = process.env.NEON_DATABASE_URL?.trim();
  if (c) return c;
  return null;
}

export function getAuthDb(): AuthDrizzle | null {
  if (cached !== undefined) return cached;
  const url = resolvePostgresUrl();
  if (!url) {
    cached = null;
    return null;
  }
  // wrapNeonWithShadow сохраняет callable-API neon; типы drizzle ожидают узкий NeonQueryFunction
  const client = wrapNeonWithShadow(neon(url), "auth.drizzle");
  cached = drizzle(client as ReturnType<typeof neon>, { schema: authSchema }) as AuthDrizzle;
  return cached;
}
