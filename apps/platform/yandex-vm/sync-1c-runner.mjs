#!/usr/bin/env node
/**
 * HTTP-раннер на Yandex VM: POST /run/catalog → фоновый sync-1c-catalog.mjs
 * Промт 117. Порт: SYNC_RUNNER_PORT (default 38443).
 * /exchange/list и /exchange/peek — FTP (gw.toopatch.ru), не HTTPS s3.
 */

import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import * as ftp from "basic-ftp";
import { applyExchangeRootPrefix } from "./exchange-path.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isMain = process.argv[1] === fileURLToPath(import.meta.url);

const PORT = Number(process.env.SYNC_RUNNER_PORT ?? 38443);
const TOKEN = process.env.SYNC_RUNNER_TOKEN?.trim() ?? "";
const SCRIPT =
  process.env.SYNC_1C_SCRIPT?.trim() ||
  path.join(__dirname, "sync-1c-catalog.mjs");
const PHOTO_SCRIPT =
  process.env.SYNC_1C_PHOTO_SCRIPT?.trim() ||
  path.join(__dirname, "sync-1c-photos.mjs");
const USERS_LEGALS_SCRIPT =
  process.env.SYNC_1C_USERS_LEGALS_SCRIPT?.trim() ||
  path.join(__dirname, "sync-1c-users-legals.mjs");

const FTP_EXCHANGE_BASE = (process.env.FTP_EXCHANGE_BASE?.trim() || "/s3/IMG/exchange").replace(/\/$/, "");
const FTP_HOST = process.env.FTP_HOST?.trim() || "gw.toopatch.ru";
const EXCHANGE_MAX_BYTES = 10_485_760; // 10 MB
const EXCHANGE_HTTP_PREFIX = "/images/IMG/exchange";
const FTP_OP_TIMEOUT_MS = 25_000;
const FTP_UPLOAD_TIMEOUT_MS = 60_000;

/** Allows /s3/IMG/exchange[/<prefix>]/from_lk/<filename> — prefix may contain spaces and (). */
export const FROM_LK_UPLOAD_PATH_PATTERN =
  /^\/s3\/IMG\/exchange(\/[A-Za-z0-9_.\-() ]+)?\/from_lk\/[A-Za-z0-9_.\-]+$/;

const SNAPSHOT_FILENAME_RE = /^distribution_(\d{4})-(\d{2})-(\d{2})_(\d{2})\.json$/;

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

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeExchangePath(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.length > 300) return null;
  if (trimmed.includes("..")) return null;
  if (trimmed.includes("\\")) return null;
  return trimmed;
}

/**
 * List queries may omit trailing slash (exchange-list API); normalize to directory path.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeExchangeListPath(raw) {
  const p = normalizeExchangePath(raw);
  if (!p) return null;
  if (p === "/" || p.endsWith("/")) return p;
  return `${p}/`;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {Date | undefined} modifiedAt
 */
export function formatListingTime(modifiedAt) {
  if (!modifiedAt || Number.isNaN(modifiedAt.getTime())) return "--:--";
  const h = String(modifiedAt.getUTCHours()).padStart(2, "0");
  const m = String(modifiedAt.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function entryIsDirectory(entry) {
  if (typeof entry.isDirectory === "function") return entry.isDirectory();
  return entry.type === ftp.FileType.Directory;
}

/**
 * @param {string} listPath — normalized list path ending with /
 * @param {import('basic-ftp').FileInfo[]} entries
 */
export function buildExchangeListHtml(listPath, entries) {
  const pathPrefix = listPath === "/" ? "" : listPath.replace(/\/$/, "");
  const lines = [`<html><head><title>Index of ${escapeHtml(EXCHANGE_HTTP_PREFIX)}${escapeHtml(listPath)}</title></head><body><pre>`];

  for (const entry of entries) {
    if (!entry?.name || entry.name === "." || entry.name === "..") continue;
    const time = formatListingTime(entry.modifiedAt);
    const encodedName = encodeURIComponent(entry.name);
    const hrefBase = `${EXCHANGE_HTTP_PREFIX}${pathPrefix}/${encodedName}`;
    const displayName = escapeHtml(entry.name);

    if (entryIsDirectory(entry)) {
      lines.push(`   ${time}        &lt;dir&gt; <A HREF="${hrefBase}/">${displayName}</A><br>`);
    } else {
      const size = Number.isFinite(entry.size) ? String(entry.size) : "0";
      lines.push(`   ${time}        ${size} <A HREF="${hrefBase}">${displayName}</A><br>`);
    }
  }

  lines.push("</pre></body></html>");
  return lines.join("\n");
}

/**
 * @param {string} listPath — normalized, ends with /
 */
export function remoteExchangeListPath(listPath) {
  const suffix = listPath === "/" ? "" : listPath.replace(/\/$/, "");
  return `${FTP_EXCHANGE_BASE}${applyExchangeRootPrefix(suffix === "" ? "/" : `${suffix}/`)}`;
}

/**
 * @param {string} filePath — normalized file path, no trailing /
 */
export function remoteExchangePeekPath(filePath) {
  return `${FTP_EXCHANGE_BASE}${applyExchangeRootPrefix(filePath)}`;
}

/**
 * @param {unknown} rawPath
 * @returns {string | null}
 */
export function validateDistributionUploadPath(rawPath) {
  if (typeof rawPath !== "string") return null;
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.includes("\\")) return null;
  if (!FROM_LK_UPLOAD_PATH_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function snapshotDateFromFilename(name) {
  const m = SNAPSHOT_FILENAME_RE.exec(name);
  if (!m) return null;
  const [, y, mo, d, h] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), 0, 0, 0));
}

/**
 * @param {string} remotePath — validated absolute FTP path
 * @param {Buffer} content
 * @param {{ purgeSnapshotsOlderThanMs?: number, snapshotPrefix?: string }} [options]
 */
export async function exchangeUploadFromLk(remotePath, content, options = {}) {
  const client = await ftpConnect();
  try {
    const dir = remotePath.slice(0, remotePath.lastIndexOf("/"));
    await withTimeout(client.ensureDir(dir), FTP_UPLOAD_TIMEOUT_MS, "FTP ensureDir");
    const body = Readable.from([content]);
    await withTimeout(client.uploadFrom(body, remotePath), FTP_UPLOAD_TIMEOUT_MS, "FTP upload");

    let removedSnapshots = 0;
    const purgeMs = Number(options.purgeSnapshotsOlderThanMs);
    const snapshotPrefix =
      typeof options.snapshotPrefix === "string" ? options.snapshotPrefix.trim() : "";
    if (Number.isFinite(purgeMs) && purgeMs > 0 && snapshotPrefix) {
      const cutoff = Date.now() - purgeMs;
      const entries = await withTimeout(client.list(dir), FTP_UPLOAD_TIMEOUT_MS, "FTP list");
      for (const item of entries) {
        if (!item?.name || item.name === "." || item.name === "..") continue;
        if (entryIsDirectory(item)) continue;
        if (!item.name.startsWith(snapshotPrefix)) continue;
        const snapAt = snapshotDateFromFilename(item.name);
        if (!snapAt || snapAt.getTime() >= cutoff) continue;
        await withTimeout(client.remove(`${dir}/${item.name}`), FTP_UPLOAD_TIMEOUT_MS, "FTP remove");
        removedSnapshots += 1;
      }
    }

    return { removedSnapshots };
  } finally {
    client.close();
  }
}

export async function ftpConnect() {
  const user = process.env.FTP_USER?.trim();
  const password = process.env.FTP_PASSWORD?.trim();
  if (!user || !password) throw new Error("FTP_USER and FTP_PASSWORD are required");
  const client = new ftp.Client(20_000);
  client.ftp.verbose = false;
  await client.access({
    host: FTP_HOST,
    user,
    password,
    secure: process.env.FTP_SECURE === "1",
  });
  return client;
}

function isFtpNotFoundError(err) {
  const code = err && typeof err === "object" && "code" in err ? Number(err.code) : NaN;
  return code === 550;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

/**
 * @param {string} listPath — normalized list path ending with /
 */
export async function exchangeListFromFtp(listPath) {
  const remote = remoteExchangeListPath(listPath);
  const client = await ftpConnect();
  try {
    const entries = await withTimeout(client.list(remote), FTP_OP_TIMEOUT_MS, "FTP list");
    return buildExchangeListHtml(listPath, entries);
  } finally {
    client.close();
  }
}

/**
 * @param {string} filePath
 * @param {number} bytes
 * @returns {Promise<{ buf: Buffer, totalSize: number | null }>}
 */
export async function exchangePeekFromFtp(filePath, bytes) {
  const remote = remoteExchangePeekPath(filePath);
  const client = await ftpConnect();
  let totalSize = null;
  try {
    try {
      totalSize = await withTimeout(client.size(remote), FTP_OP_TIMEOUT_MS, "FTP size");
    } catch (e) {
      if (isFtpNotFoundError(e)) {
        const err = new Error("NOT_FOUND");
        err.code = "NOT_FOUND";
        throw err;
      }
      throw e;
    }

    const chunks = [];
    let total = 0;
    const pass = new PassThrough();
    pass.on("data", (chunk) => {
      if (total >= bytes) return;
      const room = bytes - total;
      const slice = chunk.length <= room ? chunk : chunk.subarray(0, room);
      chunks.push(slice);
      total += slice.length;
      if (total >= bytes) {
        try {
          client.close();
        } catch {
          /* ignore */
        }
      }
    });

    try {
      await withTimeout(client.downloadTo(pass, remote, 0), FTP_OP_TIMEOUT_MS, "FTP download");
    } catch (e) {
      if (total < bytes) throw e;
    }

    const buf = Buffer.concat(chunks, total);
    return { buf, totalSize };
  } finally {
    try {
      client.close();
    } catch {
      /* ignore */
    }
  }
}

function resolveScript(kind) {
  if (kind === "photos") return PHOTO_SCRIPT;
  if (kind === "users-legals") return USERS_LEGALS_SCRIPT;
  return SCRIPT;
}

function spawnArgsForKind(kind, script, extraArgs) {
  if (kind === "users-legals") {
    return ["--import", "tsx", script, ...extraArgs];
  }
  return [script, ...extraArgs];
}

function startSync(target = "both", dry = false, extraEnv = {}, kind = "catalog", extraArgs = []) {
  if (running) {
    return { ok: false, code: "BUSY", message: "Sync already running" };
  }
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
  const script = resolveScript(kind);
  const args = spawnArgsForKind(kind, script, extraArgs);
  const child = spawn(process.execPath, args, {
    env: {
      ...process.env,
      ...safeExtra,
      TARGET_DB: target,
      DRY_RUN: dry ? "1" : "0",
      TANDOOR_PLATFORM:
        process.env.TANDOOR_PLATFORM?.trim() ||
        "/home/ubuntu/tandoor-platform/apps/platform",
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
    const listPath = normalizeExchangeListPath(rawPath);
    if (!listPath) {
      json(res, 400, { ok: false, code: "BAD_PATH", message: "Некорректный путь." });
      return;
    }

    exchangeListFromFtp(listPath)
      .then((html) => {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      })
      .catch((e) => {
        json(res, 502, { ok: false, code: "UPSTREAM_UNREACHABLE", message: String(e?.message ?? e) });
      });
    return;
  }

  if (req.method === "GET" && req.url && req.url.startsWith("/exchange/peek")) {
    const u = new URL(req.url, "http://x");
    const rawPath = String(u.searchParams.get("path") ?? "").trim();
    const filePath = normalizeExchangePath(rawPath);
    if (!filePath || filePath.endsWith("/")) {
      json(res, 400, { ok: false, code: "BAD_PATH", message: "Некорректный путь (должен быть файл)." });
      return;
    }
    const bytesParam = Number(u.searchParams.get("bytes") ?? 8192);
    const byteLimit =
      Number.isFinite(bytesParam) && bytesParam > 0
        ? Math.min(Math.floor(bytesParam), EXCHANGE_MAX_BYTES)
        : 8192;

    exchangePeekFromFtp(filePath, byteLimit)
      .then(({ buf, totalSize }) => {
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Exchange-Total-Size": totalSize != null ? String(totalSize) : "unknown",
          "X-Exchange-Bytes-Returned": String(buf.length),
        });
        res.end(buf);
      })
      .catch((e) => {
        if (e?.code === "NOT_FOUND" || isFtpNotFoundError(e)) {
          json(res, 404, { ok: false, code: "NOT_FOUND", message: "Файл не найден." });
          return;
        }
        json(res, 502, { ok: false, code: "UPSTREAM_UNREACHABLE", message: String(e?.message ?? e) });
      });
    return;
  }

  if (req.method === "POST" && req.url === "/exchange/upload") {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      let payload;
      try {
        payload = body.trim() ? JSON.parse(body) : null;
      } catch {
        json(res, 400, { ok: false, code: "BAD_JSON", message: "Invalid JSON body." });
        return;
      }
      const rawPath = validateDistributionUploadPath(payload?.path);
      if (!rawPath) {
        json(res, 400, {
          ok: false,
          code: "BAD_PATH",
          message: "path must match /s3/IMG/exchange[/<prefix>]/from_lk/<filename>",
        });
        return;
      }
      const contentBase64 =
        typeof payload?.contentBase64 === "string" ? payload.contentBase64.trim() : "";
      if (!contentBase64) {
        json(res, 400, { ok: false, code: "BAD_CONTENT", message: "contentBase64 is required." });
        return;
      }
      let content;
      try {
        content = Buffer.from(contentBase64, "base64");
      } catch {
        json(res, 400, { ok: false, code: "BAD_CONTENT", message: "contentBase64 is invalid." });
        return;
      }
      if (content.length === 0) {
        json(res, 400, { ok: false, code: "BAD_CONTENT", message: "contentBase64 is empty." });
        return;
      }

      exchangeUploadFromLk(rawPath, content, {
        purgeSnapshotsOlderThanMs: payload?.purgeSnapshotsOlderThanMs,
        snapshotPrefix: payload?.snapshotPrefix,
      })
        .then(({ removedSnapshots }) => {
          json(res, 200, { ok: true, path: rawPath, removedSnapshots });
        })
        .catch((e) => {
          json(res, 502, { ok: false, code: "UPSTREAM_UNREACHABLE", message: String(e?.message ?? e) });
        });
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

  if (
    req.method === "POST" &&
    (req.url === "/run/users" || req.url === "/run/legals" || req.url === "/run/users-legals")
  ) {
    const targetArg =
      req.url === "/run/users" ? "users" : req.url === "/run/legals" ? "legals" : "both";
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      let extraEnv = {};
      try {
        if (body.trim()) {
          const p = JSON.parse(body);
          if (p.extraEnv && typeof p.extraEnv === "object") extraEnv = p.extraEnv;
        }
      } catch {
        /* ignore */
      }
      const r = startSync("neon", false, extraEnv, "users-legals", [`--target=${targetArg}`]);
      json(res, r.ok ? 202 : 409, r);
    });
    return;
  }

  json(res, 404, { ok: false, code: "NOT_FOUND" });
});

if (isMain) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[sync-1c-runner] listening on :${PORT}, script=${SCRIPT}, ftpExchange=${FTP_EXCHANGE_BASE}`);
  });
}

export { server, EXCHANGE_MAX_BYTES, FTP_EXCHANGE_BASE };
