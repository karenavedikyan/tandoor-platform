import { defineConfig } from "drizzle-kit";

/**
 * Postgres (Neon): схема будущей авторизации (`shared/auth-schema.ts`).
 * Не смешивать с SQLite-пилотом (`drizzle.config.ts` → `./data.db`).
 *
 * Генерация/применение миграций — вручную, когда будут готовы credentials:
 * `drizzle-kit generate --config=drizzle.auth.config.ts`
 * `drizzle-kit push --config=drizzle.auth.config.ts` (не вызывать из CI этого PR).
 */
export default defineConfig({
  out: "./migrations-auth",
  schema: ["./shared/auth-schema.ts", "./shared/dealers-schema.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
