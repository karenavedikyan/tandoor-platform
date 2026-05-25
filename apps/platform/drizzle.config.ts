import { defineConfig } from "drizzle-kit";

/**
 * SQLite (пилот `data.db`). Схема Postgres для auth — отдельно: `drizzle.auth.config.ts` + `shared/auth-schema.ts`.
 */
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data.db",
  },
});
