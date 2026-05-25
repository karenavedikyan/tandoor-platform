#!/usr/bin/env node
/**
 * Ручной запуск применения схемы auth к Postgres (Neon) через drizzle-kit.
 * Не вызывать из CI — только локально / на согласованном шаге после ревью PR.
 *
 * Читает `DATABASE_URL` (обязательно) и при наличии `DATABASE_URL_UNPOOLED`
 * добавляет её в окружение дочернего процесса (Neon pooling / миграции).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const db = process.env.DATABASE_URL?.trim();
if (!db) {
  console.error("[auth-db-push] DATABASE_URL is required.");
  process.exit(1);
}

const unpooled = process.env.DATABASE_URL_UNPOOLED?.trim();
const env = { ...process.env, DATABASE_URL: db };
if (unpooled) {
  env.DATABASE_URL_UNPOOLED = unpooled;
}

const r = spawnSync("npx", ["drizzle-kit", "push", "--config=drizzle.auth.config.ts"], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: false,
});

process.exit(r.status === 0 ? 0 : r.status ?? 1);
