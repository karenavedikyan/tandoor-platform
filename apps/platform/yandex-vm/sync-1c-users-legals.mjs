#!/usr/bin/env node
/**
 * Import exchange users/legals from FTP → Neon shadow tables (exchange_users_raw, exchange_legals_raw).
 * Запускается с Yandex VM runner (POST /run/users|legals|users-legals).
 *
 * Требует NODE_OPTIONS=--import tsx (или spawn с --import tsx) и checkout platform в TANDOOR_PLATFORM.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as ftp from "basic-ftp";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM_ROOT =
  process.env.TANDOOR_PLATFORM?.trim() ||
  path.resolve(__dirname, "../../tandoor-platform/apps/platform");

const FTP_EXCHANGE_BASE = (process.env.FTP_EXCHANGE_BASE?.trim() || "/s3/IMG/exchange").replace(/\/$/, "");
const FTP_HOST = process.env.FTP_HOST?.trim() || "gw.toopatch.ru";

function logLine(msg) {
  console.log(`[sync-users-legals] ${msg}`);
}

function parseArgs(argv) {
  let target = "both";
  let sourceUsers = "/import_users/employers1.xml";
  let sourceLegals = "/import_users/users1.xml";
  for (const a of argv) {
    if (a.startsWith("--target=")) target = a.slice("--target=".length);
    if (a.startsWith("--source-users=")) sourceUsers = a.slice("--source-users=".length);
    if (a.startsWith("--source-legals=")) sourceLegals = a.slice("--source-legals=".length);
  }
  if (!["users", "legals", "both"].includes(target)) {
    throw new Error(`Invalid --target=${target}`);
  }
  return { target, sourceUsers, sourceLegals };
}

function remoteExchangePath(exchangePath) {
  return `${FTP_EXCHANGE_BASE}${exchangePath}`;
}

async function loadModules() {
  const base = pathToFileURL(path.join(PLATFORM_ROOT, "shared/admin/")).href;
  const [usersParser, legalsParser, usersHandlers, legalsHandlers] = await Promise.all([
    import(new URL("exchange-users-xml-parser.ts", base).href),
    import(new URL("exchange-legals-xml-parser.ts", base).href),
    import(new URL("exchange-users-handlers.ts", base).href),
    import(new URL("exchange-legals-handlers.ts", base).href),
  ]);
  return {
    parseExchangeUsersXml: usersParser.parseExchangeUsersXml,
    parseExchangeLegalsStream: legalsParser.parseExchangeLegalsStream,
    upsertExchangeUsersInBatches: usersHandlers.upsertExchangeUsersInBatches,
    upsertExchangeLegalsInBatches: legalsHandlers.upsertExchangeLegalsInBatches,
  };
}

function createPool() {
  const url =
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim();
  if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");
  return new pg.Pool({ connectionString: url, max: 4 });
}

async function ftpConnect() {
  const user = process.env.FTP_USER?.trim();
  const password = process.env.FTP_PASSWORD?.trim();
  if (!user || !password) throw new Error("FTP_USER and FTP_PASSWORD are required");
  const client = new ftp.Client(120_000);
  client.ftp.verbose = process.env.FTP_VERBOSE === "1";
  await client.access({
    host: FTP_HOST,
    user,
    password,
    secure: process.env.FTP_SECURE === "1",
  });
  return client;
}

async function downloadUsersXml(sourcePath) {
  const client = await ftpConnect();
  const tmp = path.join(os.tmpdir(), `employers1-${Date.now()}.xml`);
  try {
    logLine(`FTP download ${remoteExchangePath(sourcePath)} → ${tmp}`);
    await client.downloadTo(tmp, remoteExchangePath(sourcePath));
    return fs.readFileSync(tmp, "utf8");
  } finally {
    client.close();
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

async function syncUsers(pool, mods, sourceFile) {
  const xml = await downloadUsersXml(sourceFile);
  let rows;
  try {
    rows = await mods.parseExchangeUsersXml(xml);
  } catch (e) {
    const err = new Error(`XML parse error (users): ${e instanceof Error ? e.message : e}`);
    err.exitCode = 2;
    throw err;
  }
  let stats;
  try {
    stats = await mods.upsertExchangeUsersInBatches(pool, rows, sourceFile, 200);
  } catch (e) {
    const err = new Error(`DB error (users): ${e instanceof Error ? e.message : e}`);
    err.exitCode = 3;
    throw err;
  }
  logLine(
    `[sync-users] ok inserted=${stats.inserted} updated=${stats.updated} unchanged=${stats.unchanged} total=${rows.length}`,
  );
  return stats;
}

async function syncLegals(pool, mods, sourceFile) {
  const client = await ftpConnect();
  const pass = new PassThrough();
  const remote = remoteExchangePath(sourceFile);
  let batch = [];
  let progress = 0;
  const stats = { inserted: 0, updated: 0, unchanged: 0 };
  const LEGAL_BATCH = 500;

  const flushBatch = async () => {
    if (batch.length === 0) return;
    const s = await mods.upsertExchangeLegalsInBatches(pool, batch, sourceFile, LEGAL_BATCH);
    stats.inserted += s.inserted;
    stats.updated += s.updated;
    stats.unchanged += s.unchanged;
    batch = [];
  };

  try {
    logLine(`FTP stream download ${remote}`);
    const parsePromise = mods.parseExchangeLegalsStream(pass, async (row) => {
      batch.push(row);
      progress += 1;
      if (progress % 5000 === 0) logLine(`[sync-legals] progress=${progress}`);
      if (batch.length >= LEGAL_BATCH) await flushBatch();
    });
    try {
      await client.downloadTo(pass, remote);
    } catch (e) {
      const err = new Error(`FTP error (legals): ${e instanceof Error ? e.message : e}`);
      err.exitCode = 1;
      throw err;
    }
    let parseResult;
    try {
      parseResult = await parsePromise;
    } catch (e) {
      const err = new Error(`XML parse error (legals): ${e instanceof Error ? e.message : e}`);
      err.exitCode = 2;
      throw err;
    }
    try {
      await flushBatch();
    } catch (e) {
      const err = new Error(`DB error (legals): ${e instanceof Error ? e.message : e}`);
      err.exitCode = 3;
      throw err;
    }
    logLine(
      `[sync-legals] ok inserted=${stats.inserted} updated=${stats.updated} unchanged=${stats.unchanged} total=${parseResult.total} skipped=${parseResult.skipped}`,
    );
    return { ...stats, total: parseResult.total, skipped: parseResult.skipped };
  } catch (e) {
    if (e && typeof e === "object" && "exitCode" in e) throw e;
    const err = new Error(`FTP/legals error: ${e instanceof Error ? e.message : e}`);
    err.exitCode = 1;
    throw err;
  } finally {
    client.close();
  }
}

async function main() {
  const { target, sourceUsers, sourceLegals } = parseArgs(process.argv.slice(2));
  logLine(`start target=${target} platform=${PLATFORM_ROOT}`);
  const mods = await loadModules();
  const pool = createPool();
  try {
    if (target === "users" || target === "both") {
      await syncUsers(pool, mods, sourceUsers);
    }
    if (target === "legals" || target === "both") {
      await syncLegals(pool, mods, sourceLegals);
    }
    logLine("done");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  const code = e && typeof e === "object" && "exitCode" in e ? Number(e.exitCode) : 1;
  console.error(`[sync-users-legals] fatal: ${e instanceof Error ? e.message : e}`);
  process.exit(Number.isFinite(code) && code > 0 ? code : 1);
});
