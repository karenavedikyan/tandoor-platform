/**
 * Обёртка над auth-e2e-smoke.ts: пропускает прогон, если нет ADMIN_EMAIL/ADMIN_PASSWORD.
 * Так локальный `npm run test:ci-smoke` не падает в отсутствие env, но CI с env-секретами всё запускает.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const adminEmail = process.env.ADMIN_EMAIL?.trim();
const adminPassword = process.env.ADMIN_PASSWORD?.trim();

if (!adminEmail || !adminPassword) {
  console.log("[auth-e2e-smoke-guarded] SKIP: ADMIN_EMAIL/ADMIN_PASSWORD не заданы — прогон пропущен.");
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "auth-e2e-smoke.ts");

const child = spawn("npx", ["-y", "tsx", target], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (e) => {
  console.error("[auth-e2e-smoke-guarded] FATAL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
