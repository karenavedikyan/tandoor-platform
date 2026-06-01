#!/usr/bin/env node
/**
 * Импорт catalog1.xml с FTP 1С → catalog_* (Neon + Yandex).
 * Промт 117. Запуск: node apps/platform/scripts/sync-1c-catalog.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ftp from "basic-ftp";
import { createDbTargets } from "./catalog-1c/db-target.mjs";
import { finishSyncLog, importCatalogToDb, startSyncLog } from "./catalog-1c/importer.mjs";
import { parseCatalogXmlFile } from "./catalog-1c/xml-parser.mjs";
import { logLine, targetsFromEnv } from "./catalog-1c/util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = "catalog1.xml";

async function downloadCatalogXml(destPath) {
  const host = process.env.FTP_HOST?.trim() || "gw.toopatch.ru";
  const user = process.env.FTP_USER?.trim();
  const password = process.env.FTP_PASSWORD?.trim();
  const remotePath =
    process.env.FTP_PATH?.trim() || "/s3/IMG/exchange/full_import/catalog1.xml";

  if (!user || !password) {
    throw new Error("FTP_USER and FTP_PASSWORD are required");
  }

  const client = new ftp.Client(120_000);
  client.ftp.verbose = process.env.FTP_VERBOSE === "1";
  try {
    logLine(`FTP connect ${host} …`);
    await client.access({
      host,
      user,
      password,
      secure: process.env.FTP_SECURE === "1",
    });
    logLine(`FTP download ${remotePath} → ${destPath}`);
    await client.downloadTo(destPath, remotePath);
    const st = fs.statSync(destPath);
    logLine(`FTP done, size=${st.size} bytes`);
  } finally {
    client.close();
  }
}

async function runForTarget(db, parsed, dryRun) {
  const logId = await startSyncLog(db, SOURCE_FILE);
  logLine(`[${db.label}] sync log id=${logId}`);
  try {
    if (dryRun) {
      await finishSyncLog(db, logId, {
        status: "ok",
        rowsTotal: parsed.products.length,
        rowsUpserted: 0,
        details: { dryRun: true, label: db.label },
      });
      return { logId, dryRun: true };
    }
    const { stats, rowsUpserted } = await importCatalogToDb(db, parsed);
    const rowsTotal =
      parsed.categories.length +
      parsed.groups.length +
      parsed.products.length +
      parsed.stocks.length +
      parsed.priceTypes.length;
    await finishSyncLog(db, logId, {
      status: "ok",
      rowsTotal,
      rowsUpserted,
      details: { stats, label: db.label },
    });
    logLine(`[${db.label}] ok rows_upserted≈${rowsUpserted}`);
    return { logId, stats, rowsUpserted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishSyncLog(db, logId, {
      status: "error",
      error: msg.slice(0, 4000),
    });
    throw e;
  }
}

async function main() {
  const dryRun = process.env.DRY_RUN === "1" || process.argv.includes("--dry");
  const target = targetsFromEnv();
  const tmpDir = process.env.CATALOG_XML_TMP?.trim() || os.tmpdir();
  const xmlPath = path.join(tmpDir, `catalog1-${Date.now()}.xml`);

  logLine(`target=${target} dryRun=${dryRun}`);

  const dbs = await createDbTargets(target);

  try {
    if (process.env.CATALOG_XML_PATH?.trim()) {
      const local = process.env.CATALOG_XML_PATH.trim();
      logLine(`use local XML: ${local}`);
      fs.copyFileSync(local, xmlPath);
    } else {
      await downloadCatalogXml(xmlPath);
    }

    logLine("parsing XML …");
    const parsed = await parseCatalogXmlFile(xmlPath);
    logLine(
      `parsed: categories=${parsed.categories.length} groups=${parsed.groups.length} products=${parsed.products.length} stocks=${parsed.stocks.length} warehouses=${parsed.warehouseIds.size}`,
    );

    let lastLogId = null;
    for (const db of dbs) {
      const r = await runForTarget(db, parsed, dryRun);
      lastLogId = r.logId;
    }

    if (lastLogId) {
      logLine(`last catalog_sync_log id=${lastLogId}`);
    }
    logLine("done");
  } finally {
    for (const db of dbs) {
      try {
        await db.close();
      } catch {
        /* ignore */
      }
    }
    try {
      if (!process.env.KEEP_CATALOG_XML?.trim()) fs.unlinkSync(xmlPath);
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error("[sync-1c-catalog] fatal", e);
  process.exit(1);
});
