import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as ftp from "basic-ftp";
import { put } from "@vercel/blob";
import { normPath, logLine } from "./util.mjs";

const FTP_RETRIES = 3;
const PROGRESS_EVERY = 25;
const CACHE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

/**
 * @param {string} relPath
 */
export function blobKeyForPath(relPath) {
  const normalized = normPath(relPath);
  const hash = createHash("sha1").update(normalized).digest("hex").slice(0, 24);
  const extMatch = normalized.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : "bin";
  return `catalog/${hash}.${ext}`;
}

function guessContentType(ext) {
  switch (ext.toLowerCase()) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

function isRetryableFtpError(e) {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("socket")
  );
}

async function withFtpRetry(fn) {
  let last;
  for (let i = 0; i < FTP_RETRIES; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isRetryableFtpError(e) || i === FTP_RETRIES - 1) throw e;
      logLine(`FTP retry ${i + 1}/${FTP_RETRIES}: ${e instanceof Error ? e.message : String(e)}`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw last;
}

/**
 * @returns {import('basic-ftp').Client}
 */
export async function connectFtp() {
  const host = process.env.FTP_HOST?.trim() || "gw.toopatch.ru";
  const user = process.env.FTP_USER?.trim();
  const password = process.env.FTP_PASSWORD?.trim();
  if (!user || !password) throw new Error("FTP_USER and FTP_PASSWORD are required");

  const client = new ftp.Client(120_000);
  client.ftp.verbose = process.env.FTP_VERBOSE === "1";
  await withFtpRetry(async () => {
    await client.access({
      host,
      user,
      password,
      secure: process.env.FTP_SECURE === "1",
    });
  });
  return client;
}

function ftpRemotePath(relPath) {
  const base = (process.env.FTP_IMG_BASE?.trim() || "/s3/IMG").replace(/\/$/, "");
  const normalized = normPath(relPath);
  return `${base}/${normalized}`;
}

/**
 * @param {import('./db-target.mjs').NeonTarget | import('./db-target.mjs').YandexProxyTarget} db
 * @param {number} limit
 */
export async function pickQueue(db, limit) {
  const r = await db.query(
    `SELECT product_id::text AS product_id, path, sort_order
     FROM catalog_product_images
     WHERE blob_url IS NULL
       AND path IS NOT NULL
       AND TRIM(path) <> ''
     ORDER BY product_id, sort_order NULLS LAST, path
     LIMIT $1`,
    [limit],
  );
  return r.rows.map((row) => ({
    productId: String(row.product_id),
    path: String(row.path),
    sortOrder: row.sort_order,
  }));
}

/**
 * @param {import('./db-target.mjs').NeonTarget | import('./db-target.mjs').YandexProxyTarget[]} targets
 * @param {{ productId: string, path: string, blobUrl: string, blobSize: number, sourceSize: number, sourceMtime: Date | null }} patch
 */
async function updateBlobMeta(targets, patch) {
  const params = [
    patch.productId,
    patch.path,
    patch.blobUrl,
    patch.blobSize,
    patch.sourceSize,
    patch.sourceMtime,
  ];
  const sql = `UPDATE catalog_product_images SET
      blob_url = $3,
      blob_size = $4,
      blob_uploaded_at = NOW(),
      source_size = $5,
      source_mtime = $6
    WHERE product_id = $1::uuid AND path = $2`;

  for (const db of targets) {
    await db.query(sql, params);
  }
}

/**
 * @param {import('basic-ftp').Client} client
 * @param {{ productId: string, path: string }} row
 * @param {string} token
 * @param {boolean} dry
 */
async function uploadOne(client, row, token, dry) {
  const relPath = row.path;
  const remote = ftpRemotePath(relPath);
  const tmpFile = path.join(
    os.tmpdir(),
    `catalog-photo-${createHash("sha1").update(relPath).digest("hex")}-${Date.now()}`,
  );

  try {
    await withFtpRetry(async () => {
      await client.downloadTo(tmpFile, remote);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("550") || msg.toLowerCase().includes("not found")) {
      return { status: "missing", error: msg };
    }
    return { status: "failed", error: msg };
  }

  let buf;
  let sourceSize;
  let sourceMtime;
  try {
    const st = fs.statSync(tmpFile);
    sourceSize = st.size;
    sourceMtime = st.mtime;
    buf = fs.readFileSync(tmpFile);
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }

  const blobKey = blobKeyForPath(relPath);
  const ext = blobKey.split(".").pop() ?? "bin";

  if (dry) {
    return {
      status: "uploaded",
      blobUrl: `(dry) ${blobKey}`,
      blobSize: buf.length,
      sourceSize,
      sourceMtime,
    };
  }
  const result = await put(blobKey, buf, {
    access: "public",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: CACHE_MAX_AGE_SEC,
    contentType: guessContentType(ext),
  });

  return {
    status: "uploaded",
    blobUrl: result.url,
    blobSize: buf.length,
    sourceSize,
    sourceMtime,
  };
}

/**
 * @param {{ targets: import('./db-target.mjs').NeonTarget[], limit?: number, dry?: boolean }} opts
 */
export async function runPhotoSync(opts) {
  const limit = Math.min(Math.max(Number(opts.limit ?? process.env.PHOTO_SYNC_LIMIT ?? 500) || 500, 1), 2000);
  const dry = opts.dry === true || process.env.DRY_RUN === "1";
  const targets = opts.targets;
  if (!targets?.length) throw new Error("No database targets");

  const queueSource = targets.find((t) => t.label === "neon") ?? targets[0];
  const queue = await pickQueue(queueSource, limit);
  logLine(`photo queue: ${queue.length} rows (source=${queueSource.label}, limit=${limit}, dry=${dry})`);

  if (queue.length === 0) {
    return { uploaded: 0, missing: 0, failed: 0, dry, limit, queued: 0 };
  }

  if (dry) {
    logLine(`dry-run: would upload ${queue.length} images`);
    return { uploaded: 0, missing: 0, failed: 0, dry: true, limit, queued: queue.length };
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required");
  }

  let uploaded = 0;
  let missing = 0;
  let failed = 0;
  let client = null;

  try {
    client = await connectFtp();

    for (let i = 0; i < queue.length; i++) {
      const row = queue[i];
      try {
        const r = await uploadOne(client, row, token ?? "", dry);
        if (r.status === "missing") {
          missing += 1;
          logLine(`missing ${row.path}: ${r.error}`);
          continue;
        }
        if (r.status === "failed") {
          failed += 1;
          logLine(`failed ${row.path}: ${r.error}`);
          continue;
        }
        if (!dry) {
          await updateBlobMeta(targets, {
            productId: row.productId,
            path: row.path,
            blobUrl: r.blobUrl,
            blobSize: r.blobSize,
            sourceSize: r.sourceSize,
            sourceMtime: r.sourceMtime,
          });
        }
        uploaded += 1;
      } catch (e) {
        failed += 1;
        logLine(`error ${row.path}: ${e instanceof Error ? e.message : String(e)}`);
      }

      if ((i + 1) % PROGRESS_EVERY === 0 || i + 1 === queue.length) {
        logLine(`progress ${i + 1}/${queue.length} uploaded=${uploaded} missing=${missing} failed=${failed}`);
      }
    }
  } finally {
    try {
      client?.close();
    } catch {
      /* ignore */
    }
  }

  logLine(`photo sync done uploaded=${uploaded} missing=${missing} failed=${failed}`);
  return { uploaded, missing, failed, dry, limit, queued: queue.length };
}
