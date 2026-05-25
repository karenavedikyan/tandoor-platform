#!/usr/bin/env node
/**
 * Ручной запуск, не из CI; используется единственный раз (или повторно) для bootstrap первого администратора.
 * См. `docs/auth-access-foundation.md`. Реализация в `auth-seed-admin.impl.ts` (запуск через tsx).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const impl = path.join(__dirname, "auth-seed-admin.impl.ts");
const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const r = spawnSync(process.execPath, [tsx, impl], { cwd: root, stdio: "inherit", env: process.env });
process.exit(r.status === 0 ? 0 : r.status ?? 1);
