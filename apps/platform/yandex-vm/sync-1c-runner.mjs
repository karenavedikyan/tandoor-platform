#!/usr/bin/env node
/**
 * HTTP-раннер на Yandex VM: POST /run/catalog → фоновый sync-1c-catalog.mjs
 * Промт 117. Порт: SYNC_RUNNER_PORT (default 38443).
 */

import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SYNC_RUNNER_PORT ?? 38443);
const TOKEN = process.env.SYNC_RUNNER_TOKEN?.trim() ?? "";
const SCRIPT =
  process.env.SYNC_1C_SCRIPT?.trim() ||
  path.join(__dirname, "sync-1c-catalog.mjs");

/** @type {import('node:child_process').ChildProcess | null} */
let running = null;
/** @type {string | null} */
let lastLogId = null;
let lastStartedAt = null;

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function authOk(req) {
  if (!TOKEN) return true;
  const h = req.headers.authorization ?? "";
  return h === `Bearer ${TOKEN}`;
}

function startSync(target = "both", dry = false, extraEnv = {}) {
  if (running) {
    return { ok: false, code: "BUSY", message: "Sync already running" };
  }
  // extraEnv позволяет Vercel передавать временные секреты (напр. DATABASE_URL_UNPOOLED для Neon),
  // чтобы не хранить их в ~/.env на VM. Секреты попадают только в env дочернего
  // процесса, никуда не логируются.
  const allowedExtra = new Set([
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
  ]);
  const safeExtra = {};
  for (const [k, v] of Object.entries(extraEnv || {})) {
    if (allowedExtra.has(k) && typeof v === "string" && v.length > 0) safeExtra[k] = v;
  }
  const child = spawn(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      ...safeExtra,
      TARGET_DB: target,
      DRY_RUN: dry ? "1" : "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  running = child;
  lastStartedAt = new Date().toISOString();
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
    running = null;
    console.log(`[sync-1c-runner] child exit ${code}`);
  });

  return { ok: true, pid: child.pid, startedAt: lastStartedAt };
}

const server = http.createServer((req, res) => {
  if (!authOk(req)) {
    json(res, 401, { ok: false, code: "UNAUTHORIZED" });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, running: !!running, lastLogId, lastStartedAt });
    return;
  }

  if (req.method === "GET" && req.url === "/status") {
    json(res, 200, { ok: true, running: !!running, lastLogId, lastStartedAt, pid: running?.pid ?? null });
    return;
  }

  if (req.method === "POST" && req.url === "/run/catalog") {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      let target = "both";
      let dry = false;
      let extraEnv = {};
      try {
        if (body.trim()) {
          const p = JSON.parse(body);
          if (p.target) target = String(p.target);
          if (p.dry) dry = Boolean(p.dry);
          if (p.extraEnv && typeof p.extraEnv === "object") extraEnv = p.extraEnv;
        }
      } catch {
        /* ignore */
      }
      const r = startSync(target, dry, extraEnv);
      json(res, r.ok ? 202 : 409, r);
    });
    return;
  }

  json(res, 404, { ok: false, code: "NOT_FOUND" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[sync-1c-runner] listening on :${PORT}, script=${SCRIPT}`);
});
