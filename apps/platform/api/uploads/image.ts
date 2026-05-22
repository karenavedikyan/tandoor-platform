/**
 * Vercel Serverless: POST /api/uploads/image
 *
 * Локально тот же путь в Express: `server/upload-routes.ts` (multer).
 * На Vercel multipart обрабатывается через busboy (`shared/parse-upload-multipart-memory.ts`),
 * чтобы не падать invocation до JSON-ответа.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { IncomingMessage } from "node:http";
import { executeClientBaseImageUpload, sanitizeUploadUserIdFromHeader } from "../../shared/client-base-image-upload-execute";
import { parseClientBaseUploadMultipart } from "../../shared/parse-upload-multipart-memory";

const JSON_CT = "application/json; charset=utf-8";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  try {
    if (res.headersSent) return;
    res.setHeader("Content-Type", JSON_CT);
    res.status(status).json(body);
  } catch {
    /* ignore */
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, message: "Метод не поддерживается. Используйте POST." });
      return;
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token?.trim()) {
      sendJson(res, 503, {
        success: false,
        code: "UPLOAD_NOT_CONFIGURED",
        message:
          "Загрузка фото пока не настроена. Укажите BLOB_READ_WRITE_TOKEN (Vercel Blob) в переменных окружения сервера.",
      });
      return;
    }

    const ct = String(req.headers["content-type"] ?? "");
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      sendJson(res, 400, {
        success: false,
        message: "Ожидается multipart/form-data с полем image.",
      });
      return;
    }

    const rawReq = req as unknown as IncomingMessage;
    let parsed;
    try {
      parsed = await parseClientBaseUploadMultipart(rawReq);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка разбора multipart.";
      sendJson(res, 400, { success: false, message: msg });
      return;
    }

    const result = await executeClientBaseImageUpload({
      token,
      userId: sanitizeUploadUserIdFromHeader(req.headers["x-tandoor-demo-user-id"]),
      imageBuffer: parsed.image,
      imageMime: parsed.imageMime,
      thumbBuffer: parsed.thumbnail,
      thumbMime: parsed.thumbMime,
    });

    if (!result.ok) {
      sendJson(res, result.httpStatus, {
        success: false,
        ...(result.code ? { code: result.code } : {}),
        message: result.message,
      });
      return;
    }

    sendJson(res, 200, { success: true, url: result.url, thumbnailUrl: result.thumbnailUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Внутренняя ошибка загрузки.";
    sendJson(res, 500, { success: false, message: msg });
  }
}
