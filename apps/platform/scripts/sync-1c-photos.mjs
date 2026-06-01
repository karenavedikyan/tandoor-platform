#!/usr/bin/env node
/**
 * Синхронизация фото каталога 1С: FTP → Vercel Blob (промт 120).
 * node apps/platform/scripts/sync-1c-photos.mjs [--limit=N] [--dry]
 */

import { createDbTargets } from "./catalog-1c/db-target.mjs";
import { runPhotoSync } from "./catalog-1c/photo-sync.mjs";
import { logLine, targetsFromEnv } from "./catalog-1c/util.mjs";

function parseLimit() {
  for (const arg of process.argv.slice(2)) {
    const m = /^--limit=(\d+)$/i.exec(arg);
    if (m) return Number(m[1]);
  }
  const env = Number(process.env.PHOTO_SYNC_LIMIT ?? 500);
  return Number.isFinite(env) && env > 0 ? env : 500;
}

async function main() {
  const dry = process.env.DRY_RUN === "1" || process.argv.includes("--dry");
  const limit = parseLimit();
  const target = targetsFromEnv();

  logLine(`photo sync start target=${target} limit=${limit} dry=${dry}`);

  const targets = await createDbTargets(target);
  try {
    const result = await runPhotoSync({ targets, limit, dry });
    logLine(`result ${JSON.stringify(result)}`);
    if (result.failed > 0) process.exit(1);
  } finally {
    for (const db of targets) {
      try {
        await db.close();
      } catch {
        /* ignore */
      }
    }
  }
}

main().catch((e) => {
  console.error("[sync-1c-photos] fatal", e);
  process.exit(1);
});
