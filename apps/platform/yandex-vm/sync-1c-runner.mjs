#!/usr/bin/env node
/**
 * HTTP-раннер на Yandex VM:
 * POST /run/catalog → sync-1c-catalog.mjs
 * POST /run/photos → sync-1c-photos.mjs
 */

import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SYNC_RUNNER_PORT ?? 38443);
const TOKEN = process.env.SYNC_RUNNER_TOKEN?.trim() ?? "";
const SCRIPT_CATALOG =
  process.env.SYNC_1C_SCRIPT?.trim() ||
  path.join(__dirname, "../scripts/sync-1c-catalog.mjs");
const SCRIPT_PHOTOS =
  process.env.SYNC_1C_PHOTOS_SCRIPT?.trim() ||
  path.join(__dirname, "../scripts/sync-1c-photos.mjs");

const ARG_RE = /^--[a-z][a-z0-9-]*(=[0-9a-zA-Z_.-]+)?$/;

const CATALOG_EXTRA_KEYS = new Set([
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
]);

const PHOTOS_EXTRA_KEYS = new Set([
  "BLOB_READ_WRITE_TOKEN",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "YANDEX_DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "PG_PROXY_URL",
  "YANDEX_PROXY_URL",
  "PG_PROXY_TOKEN",
  "YANDEX_PROXY_TOKEN",
  "FTP_HOST",
  "FTP_USER",
  "FTP_PASSWORD",
  "FTP_PATH",
  "FTP_IMG_BASE",
  "FTP_SECURE",
  "PHOTO_SYNC_LIMIT",
]);

/** @type {import('node:child_process').ChildProcess | null} */
let runningCatalog = null;
/** @type {import('node:child_process').ChildProcess | null} */
let runningPhotos = null;
/** @type {string | null} */
let lastLogId = null;
let lastStartedAt = null;
let lastJob = null;

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function authOk(req) {
  if (!TOKEN) return true;
  const h = req.headers.authorization ?? "";
  return h === `Bearer ${TOKEN}`;
}

function filterExtra(extraEnv, allowed) {
  const safeExtra = {};
  for (const [k, v] of Object.entries(extraEnv || {})) {
    if (allowed.has(k) && typeof v === "string" && v.length > 0) safeExtra[k] = v;
  }
  return safeExtra;
}

function validateArgs(args) {
  if (!Array.isArray(args)) return [];
  const out = [];
  for (const a of args.slice(0, 8)) {
    const s = String(a);
    if (!ARG_RE.test(s)) {
      throw new Error(`Invalid arg: ${s}`);
    }
    out.push(s);
  }
  return out;
}

function spawnJob(script, argv, envExtra, jobName) {
  const child = spawn(process.execPath, [script, ...argv], {
    env: { ...process.env, ...envExtra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (jobName === "catalog") runningCatalog = child;
  else runningPhotos = child;
  lastStartedAt = new Date().toISOString();
  lastJob = jobName;
  lastLogId = null;

  child.stdout?.on("data", (buf) => {
    const s = buf.toString();
    process.stdout.write(s);
    const m = /sync log id=(\d+)/i.exec(s);
    if (m) lastLogId = m[1];
  });
  child.stderr?.on("data", (buf) => {
    process.stderr.write(buf.toString());
  });
  child.on("close", (code) => {
    if (jobName === "catalog") runningCatalog = null;
    else runningPhotos = null;
    console.log(`[sync-1c-runner] ${jobName} exit ${code}`);
  });

  return { ok: true, pid: child.pid, startedAt: lastStartedAt, job: jobName };
}

function startCatalog(target = "both", dry = false, extraEnv = {}) {
  if (runningCatalog || runningPhotos) {
    return { ok: false, code: "BUSY", message: "Another sync job is running" };
  }
  const safeExtra = filterExtra(extraEnv, CATALOG_EXTRA_KEYS);
  return spawnJob(
    SCRIPT_CATALOG,
    [],
    { ...safeExtra, TARGET_DB: target, DRY_RUN: dry ? "1" : "0" },
    "catalog",
  );
}

function startPhotos(target = "both", dry = false, limit = 500, extraEnv = {}, args = []) {
  if (runningCatalog || runningPhotos) {
    return { ok: false, code: "BUSY", message: "Another sync job is running" };
  }
  const safeExtra = filterExtra(extraEnv, PHOTOS_EXTRA_KEYS);
  const argv = validateArgs(args);
  if (!argv.some((a) => a.startsWith("--limit="))) {
    argv.unshift(`--limit=${Math.min(Math.max(Number(limit) || 500, 1), 2000)}`);
  }
  if (dry && !argv.includes("--dry")) argv.push("--dry");
  return spawnJob(
    SCRIPT_PHOTOS,
    argv,
    { ...safeExtra, TARGET_DB: target, DRY_RUN: dry ? "1" : "0" },
    "photos",
  );
}

const server = http.createServer((req, res) => {
  if (!authOk(req)) {
    json(res, 401, { ok: false, code: "UNAUTHORIZED" });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, {
      ok: true,
      runningCatalog: !!runningCatalog,
      runningPhotos: !!runningPhotos,
      lastLogId,
      lastStartedAt,
      lastJob,
    });
    return;
  }

  if (req.method === "GET" && req.url === "/status") {
    json(res, 200, {
      ok: true,
      runningCatalog: !!runningCatalog,
      runningPhotos: !!runningPhotos,
      lastLogId,
      lastStartedAt,
      lastJob,
      pid: runningCatalog?.pid ?? runningPhotos?.pid ?? null,
    });
    return;
  }

  const handlePost = (url, handler) => {
    if (req.method !== "POST" || req.url !== url) return false;
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      try {
        const p = body.trim() ? JSON.parse(body) : {};
        const r = handler(p);
        json(res, r.ok ? 202 : 409, r);
      } catch (e) {
        json(res, 400, {
          ok: false,
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    });
    return true;
  };

  if (
    handlePost("/run/catalog", (p) => {
      const target = p.target ? String(p.target) : "both";
      const dry = Boolean(p.dry);
      const extraEnv = p.extraEnv && typeof p.extraEnv === "object" ? p.extraEnv : {};
      return startCatalog(target, dry, extraEnv);
    })
  ) {
    return;
  }

  if (
    handlePost("/run/photos", (p) => {
      const target = p.target ? String(p.target) : "both";
      const dry = Boolean(p.dry);
      const limit = Number(p.limit ?? process.env.PHOTO_SYNC_LIMIT ?? 500);
      const extraEnv = p.extraEnv && typeof p.extraEnv === "object" ? p.extraEnv : {};
      const args = Array.isArray(p.args) ? p.args : [];
      return startPhotos(target, dry, limit, extraEnv, args);
    })
  ) {
    return;
  }

  json(res, 404, { ok: false, code: "NOT_FOUND" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[sync-1c-runner] listening on :${PORT}`);
  console.log(`  catalog=${SCRIPT_CATALOG}`);
  console.log(`  photos=${SCRIPT_PHOTOS}`);
});
