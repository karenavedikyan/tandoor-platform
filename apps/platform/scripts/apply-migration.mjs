#!/usr/bin/env node
/**
 * Применить один SQL-файл миграции к Neon/Postgres.
 * Usage: node scripts/apply-migration.mjs server/migrations/2026_06_17_dealer_db_diff_log.sql
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const here = dirname(fileURLToPath(import.meta.url));
const platformRoot = join(here, "..");

function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.NEON_DATABASE_URL?.trim() ||
    null
  );
}

function splitStatements(sql) {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
}

async function main() {
  const rel = process.argv[2];
  if (!rel) {
    console.error("Usage: node scripts/apply-migration.mjs <path-to.sql>");
    process.exit(1);
  }

  const url = resolveDatabaseUrl();
  if (!url) {
    console.error("[apply-migration] DATABASE_URL is required.");
    process.exit(1);
  }

  const path = resolve(platformRoot, rel);
  const sql = readFileSync(path, "utf8");
  const sqlFn = neon(url);

  for (const stmt of splitStatements(sql)) {
    const q = stmt.endsWith(";") ? stmt : `${stmt};`;
    console.log(`[apply-migration] executing: ${q.slice(0, 80).replace(/\s+/g, " ")}...`);
    await sqlFn(q);
  }

  console.log(`[apply-migration] done: ${rel}`);
}

main().catch((e) => {
  console.error("[apply-migration]", e instanceof Error ? e.message : e);
  process.exit(1);
});
