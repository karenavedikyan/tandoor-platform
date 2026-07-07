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
const PHOTO_SCRIPT =
  process.env.SYNC_1C_PHOTO_SCRIPT?.trim() ||
  path.join(__dirname, "sync-1c-photos.mjs");
const EXCHANGE_BASE = "https://s3.toopatch.ru/images/IMG/exchange";
const EXCHANGE_MAX_BYTES = 65_536;

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

function startSync(target = "both", dry = false, extraEnv = {}, kind = "catalog", extraArgs = []) {
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
    "BLOB_READ_WRITE_TOKEN",
  ]);
  const safeExtra = {};
  for (const [k, v] of Object.entries(extraEnv || {})) {
    if (allowedExtra.has(k) && typeof v === "string" && v.length > 0) safeExtra[k] = v;
  }
  const script = kind === "photos" ? PHOTO_SCRIPT : SCRIPT;
  const args = [script, ...extraArgs];
  const child = spawn(process.execPath, args, {
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

  if (req.method === "GET" && req.url && req.url.startsWith("/exchange/list")) {
    const u = new URL(req.url, "http://x");
    const rawPath = String(u.searchParams.get("path") ?? "/").trim();
    if (!rawPath.startsWith("/") || rawPath.length > 200 || rawPath.includes("..")) {
      json(res, 400, { ok: false, code: "BAD_PATH", message: "Некорректный путь." });
      return;
    }
    const target = `${EXCHANGE_BASE}${rawPath === "/" ? "/" : rawPath.replace(/\/?$/, "/")}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15_000);
    fetch(target, {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    })
      .then(async (r) => {
        clearTimeout(t);
        const html = await r.text();
        res.writeHead(r.status, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      })
      .catch((e) => {
        clearTimeout(t);
        json(res, 502, { ok: false, code: "UPSTREAM_UNREACHABLE", message: String(e?.message ?? e) });
      });
    return;
  }

  if (req.method === "GET" && req.url && req.url.startsWith("/exchange/peek")) {
    const u = new URL(req.url, "http://x");
    const rawPath = String(u.searchParams.get("path") ?? "").trim();
    if (
      !rawPath.startsWith("/") ||
      rawPath.length > 300 ||
      rawPath.includes("..") ||
      rawPath.endsWith("/")
    ) {
      json(res, 400, { ok: false, code: "BAD_PATH", message: "Некорректный путь (должен быть файл)." });
      return;
    }
    const bytesParam = Number(u.searchParams.get("bytes") ?? 8192);
    const bytes =
      Number.isFinite(bytesParam) && bytesParam > 0
        ? Math.min(Math.floor(bytesParam), EXCHANGE_MAX_BYTES)
        : 8192;
    const target = `${EXCHANGE_BASE}${rawPath}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15_000);
    fetch(target, {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        Range: `bytes=0-${bytes - 1}`,
      },
    })
      .then(async (r) => {
        clearTimeout(t);
        if (r.status !== 200 && r.status !== 206) {
          json(res, r.status === 404 ? 404 : 502, {
            ok: false,
            code: r.status === 404 ? "NOT_FOUND" : "UPSTREAM_ERROR",
            message: `Upstream HTTP ${r.status}`,
          });
          return;
        }
        const totalSize = r.headers.get("content-range")?.match(/\/(\d+)$/)?.[1] ?? null;
        const buf = Buffer.from(await r.arrayBuffer());
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Exchange-Total-Size": totalSize ?? "unknown",
          "X-Exchange-Bytes-Returned": String(buf.length),
        });
        res.end(buf);
      })
      .catch((e) => {
        clearTimeout(t);
        json(res, 502, { ok: false, code: "UPSTREAM_UNREACHABLE", message: String(e?.message ?? e) });
      });
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

  if (req.method === "POST" && (req.url === "/run/catalog" || req.url === "/run/photos")) {
    const kind = req.url === "/run/photos" ? "photos" : "catalog";
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      let target = "both";
      let dry = false;
      let extraEnv = {};
      let extraArgs = [];
      try {
        if (body.trim()) {
          const p = JSON.parse(body);
          if (p.target) target = String(p.target);
          if (p.dry) dry = Boolean(p.dry);
          if (p.extraEnv && typeof p.extraEnv === "object") extraEnv = p.extraEnv;
          if (Array.isArray(p.args)) {
            extraArgs = p.args
              .filter((s) => typeof s === "string" && /^--[a-z][a-z0-9-]*(=[0-9a-zA-Z_.-]+)?$/.test(s))
              .slice(0, 8);
          }
        }
      } catch {
        /* ignore */
      }
      const r = startSync(target, dry, extraEnv, kind, extraArgs);
      json(res, r.ok ? 202 : 409, r);
    });
    return;
  }

  json(res, 404, { ok: false, code: "NOT_FOUND" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[sync-1c-runner] listening on :${PORT}, script=${SCRIPT}`);
});
