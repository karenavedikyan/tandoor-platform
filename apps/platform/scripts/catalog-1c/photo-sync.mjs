/**
 * Промт 120: синк фото каталога с FTP 1С в Vercel Blob.
 *
 * Алгоритм:
 *   1. Из БД (Neon) берём catalog_product_images, у которых blob_url IS NULL.
 *   2. Скачиваем с FTP (~250КБ на файл) и заливаем в Vercel Blob под именем
 *      `catalog/<sha1(path)>.<ext>` (path-стабильный, чтобы повторные синки
 *      попадали в один объект).
 *   3. Обновляем blob_url, blob_size, blob_uploaded_at, source_size в обеих БД.
 *
 * Окружение:
 *   - BLOB_READ_WRITE_TOKEN — Vercel Blob (sensitive).
 *   - FTP_HOST, FTP_USER, FTP_PASSWORD (FTP_IMG_BASE — по умолчанию /s3/IMG).
 *   - DATABASE_URL / DATABASE_URL_UNPOOLED для двух таргетов (используем targetsFromEnv).
 *
 * Параметры скрипта:
 *   --limit=<n>        не более <n> картинок за запуск (по умолчанию 500)
 *   --target=neon|yandex|both (определяется автоматически из env)
 *   --dry              ничего не пишет, только лог
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import * as ftp from "basic-ftp";
import { put } from "@vercel/blob";
import { logLine } from "./util.mjs";

const FTP_IMG_BASE = (process.env.FTP_IMG_BASE?.trim() || "/s3/IMG").replace(/\/$/, "");
const FTP_HOST = process.env.FTP_HOST?.trim() || "gw.toopatch.ru";

/**
 * @param {string} p path вида "20250523/OL HH.png"
 * @returns {string} ключ Vercel Blob
 */
export function blobKeyForPath(p) {
  const sha = crypto.createHash("sha1").update(p).digest("hex").slice(0, 24);
  const dot = p.lastIndexOf(".");
  const extRaw = dot >= 0 ? p.slice(dot + 1) : "bin";
  const ext = extRaw.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `catalog/${sha}.${ext}`;
}

function contentTypeFor(ext) {
  const e = ext.toLowerCase();
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "application/octet-stream";
}

/**
 * Подключение к FTP с retry.
 */
async function openFtp() {
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

/**
 * Скачать файл с FTP во временный путь. Возвращает {size}.
 */
async function downloadOne(client, remotePath, destPath) {
  await client.downloadTo(destPath, remotePath);
  const st = fs.statSync(destPath);
  return { size: st.size };
}

/**
 * Залить файл в Vercel Blob. Возвращает {url, size}.
 */
async function uploadToBlob(localPath, key, ext, token) {
  const buf = fs.readFileSync(localPath);
  const res = await put(key, buf, {
    access: "public",
    token,
    contentType: contentTypeFor(ext),
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60 * 60 * 24 * 30, // 30 дней
  });
  return { url: res.url, size: buf.length };
}

/**
 * Получить очередь картинок из первого таргета (приоритет neon — есть в обеих БД).
 */
async function fetchQueue(db, limit) {
  const r = await db.query(
    `SELECT id, product_id, path
     FROM catalog_product_images
     WHERE blob_url IS NULL
     ORDER BY id ASC
     LIMIT $1`,
    [limit],
  );
  return r.rows;
}

/**
 * Обновить запись в одной БД. Если по (product_id, path) запись существует —
 * апдейтим; иначе пропускаем (вторая БД могла отставать).
 */
async function updateRow(db, productId, path_, blobUrl, blobSize, sourceSize) {
  await db.query(
    `UPDATE catalog_product_images
        SET blob_url = $1,
            blob_size = $2,
            blob_uploaded_at = NOW(),
            source_size = $3
      WHERE product_id = $4::uuid AND path = $5`,
    [blobUrl, blobSize, sourceSize, productId, path_],
  );
}

/**
 * Главный цикл синка.
 * @param {Array<{pool: any, label: string}>} dbs
 * @param {{ limit: number, dry: boolean }} opts
 */
export async function runPhotoSync(dbs, opts) {
  const { limit, dry } = opts;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is required");

  if (dbs.length === 0) throw new Error("no DB targets");
  // Очередь берём из первого (neon — обычно полнее). Это безопасно: если в
  // yandex ещё нет такой записи, UPDATE её просто не найдёт.
  const primary = dbs[0];
  const queue = await fetchQueue(primary, limit);
  logLine(`queue: ${queue.length} (limit=${limit}, source=${primary.label})`);
  if (queue.length === 0) return { processed: 0, uploaded: 0, missing: 0, failed: 0 };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-photos-"));
  const stats = { processed: 0, uploaded: 0, missing: 0, failed: 0 };
  let client = null;
  try {
    logLine(`FTP connect ${FTP_HOST} …`);
    client = await openFtp();
    let i = 0;
    for (const row of queue) {
      i++;
      const remote = `${FTP_IMG_BASE}/${row.path}`;
      const key = blobKeyForPath(row.path);
      const ext = key.slice(key.lastIndexOf(".") + 1);
      const localTmp = path.join(tmpDir, `f-${row.id}.${ext}`);
      try {
        const { size: srcSize } = await downloadOne(client, remote, localTmp);
        if (dry) {
          stats.processed++;
          if (i % 50 === 0) logLine(`progress ${i}/${queue.length} (dry, last=${row.path})`);
          continue;
        }
        const { url, size: blobSize } = await uploadToBlob(localTmp, key, ext, blobToken);
        for (const db of dbs) {
          try {
            await updateRow(db, row.product_id, row.path, url, blobSize, srcSize);
          } catch (e) {
            logLine(`[${db.label}] update failed for ${row.path}: ${e?.message ?? e}`);
          }
        }
        stats.processed++;
        stats.uploaded++;
        if (i % 25 === 0 || i === queue.length) {
          logLine(`progress ${i}/${queue.length} uploaded=${stats.uploaded} missing=${stats.missing} failed=${stats.failed}`);
        }
      } catch (e) {
        const msg = e?.message ?? String(e);
        if (/550|not.*found|no such file/i.test(msg)) {
          stats.missing++;
        } else {
          stats.failed++;
          logLine(`error ${row.path}: ${msg}`);
        }
        // Если FTP-канал упал — переподключимся
        if (/connection|timeout|ECONNRESET/i.test(msg)) {
          try { client.close(); } catch {}
          logLine(`FTP reconnect …`);
          client = await openFtp();
        }
      } finally {
        try { fs.unlinkSync(localTmp); } catch {}
      }
    }
  } finally {
    if (client) {
      try { client.close(); } catch {}
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
  return stats;
}
