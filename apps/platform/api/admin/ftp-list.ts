/**
 * GET /api/admin/ftp-list?path=/s3/IMG/exchange
 * Возвращает список файлов и папок по указанному пути на FTP 1С.
 * Только для роли admin.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as ftp from "basic-ftp";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
      return;
    }
    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }
    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (me.role !== "admin") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для администратора." });
      return;
    }

    const rawPath = String(req.query.path ?? "/").trim();
    if (!rawPath.startsWith("/")) {
      sendJson(res, 400, { success: false, code: "BAD_PATH", message: "Путь должен начинаться с /." });
      return;
    }
    if (rawPath.length > 500 || rawPath.split("/").length > 20) {
      sendJson(res, 400, { success: false, code: "BAD_PATH", message: "Слишком длинный путь." });
      return;
    }

    const host = process.env.FTP_HOST?.trim() || "gw.toopatch.ru";
    const user = process.env.FTP_USER?.trim();
    const password = process.env.FTP_PASSWORD?.trim();
    if (!user || !password) {
      sendJson(res, 503, { success: false, code: "FTP_NOT_CONFIGURED", message: "FTP-креды не настроены." });
      return;
    }

    const client = new ftp.Client(30_000);
    try {
      await client.access({
        host,
        user,
        password,
        secure: process.env.FTP_SECURE === "1",
      });
      const list = await client.list(rawPath);
      const items = list.map((item) => ({
        name: item.name,
        type: item.type === 2 ? "directory" : item.type === 1 ? "file" : "other",
        size: item.size,
        modifiedAt: item.modifiedAt?.toISOString?.() ?? null,
        rawModifiedAt: item.rawModifiedAt ?? null,
      }));
      sendJson(res, 200, { success: true, path: rawPath, count: items.length, items });
    } finally {
      client.close();
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[ftp-list]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
