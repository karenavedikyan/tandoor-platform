#!/usr/bin/env node
/**
 * Синк фото каталога с FTP 1С в Vercel Blob. Промт 120.
 * Запуск: node apps/platform/scripts/sync-1c-photos.mjs [--limit=500] [--dry]
 */

import { createDbTargets } from "./catalog-1c/db-target.mjs";
import { runPhotoSync } from "./catalog-1c/photo-sync.mjs";
import { logLine, targetsFromEnv } from "./catalog-1c/util.mjs";

function parseArgs(argv) {
  const out = { limit: 500, dry: false };
  for (const a of argv) {
    if (a === "--dry") out.dry = true;
    else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) out.limit = Math.floor(n);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = targetsFromEnv();
  logLine(`target=${target} limit=${args.limit} dry=${args.dry}`);
  const dbs = await createDbTargets(target);
  try {
    const stats = await runPhotoSync(dbs, args);
    logLine(`done processed=${stats.processed} uploaded=${stats.uploaded} missing=${stats.missing} failed=${stats.failed}`);
  } finally {
    for (const db of dbs) {
      try { await db.close?.(); } catch {}
    }
  }
}

main().catch((e) => {
  logLine(`fatal: ${e?.message ?? e}`);
  process.exitCode = 1;
});
