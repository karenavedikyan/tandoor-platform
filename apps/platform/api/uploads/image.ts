/**
 * Vercel Serverless: POST /api/uploads/image
 *
 * Локально тот же путь в Express: `server/upload-routes.ts` (multer).
 * Здесь нет runtime top-level импортов busboy/blob/parser — только после проверки
 * Content-Type (и ранних отказов), чтобы пустой POST без multipart не трогал тяжёлые модули.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { IncomingMessage } from "node:http";

type ClientBaseImageUploadExecuteResult =
  | { ok: true; url: string; thumbnailUrl: string }
  | { ok: false; httpStatus: number; code?: string; message: string };

const JSON_CT = "application/json; charset=utf-8";

/** Next.js / Vercel: не преобразовывать тело запроса до handler (нужен сырой multipart). */
export const config = {
  api: {
    bodyParser: false,
  },
};

function headerString(h: string | string[] | undefined): string {
  if (h === undefined) return "";
  return Array.isArray(h) ? (h[0] ?? "") : String(h);
}

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

    const ct = headerString(req.headers["content-type"]).trim();
    const ctLower = ct.toLowerCase();

    if (!ctLower || !ctLower.includes("multipart/form-data")) {
      sendJson(res, 400, {
        success: false,
        code: "UPLOAD_MULTIPART_REQUIRED",
        message: "Ожидается POST с заголовком Content-Type: multipart/form-data и полем image.",
      });
      return;
    }

    if (!ctLower.includes("boundary=")) {
      sendJson(res, 400, {
        success: false,
        code: "UPLOAD_MULTIPART_INVALID",
        message: "В Content-Type отсутствует boundary для multipart/form-data.",
      });
      return;
    }

    const clRaw = headerString(req.headers["content-length"]).trim();
    if (clRaw === "0") {
      sendJson(res, 400, {
        success: false,
        code: "UPLOAD_FILE_REQUIRED",
        message: "Тело запроса пусто — передайте файл в поле image (multipart/form-data).",
      });
      return;
    }

    let parsed: { image?: Buffer; imageMime?: string; thumbnail?: Buffer; thumbMime?: string };
    try {
      const { parseClientBaseUploadMultipart } = await import("../../shared/parse-upload-multipart-memory");
      const rawReq = req as unknown as IncomingMessage;
      parsed = await parseClientBaseUploadMultipart(rawReq);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка разбора multipart.";
      sendJson(res, 400, { success: false, code: "UPLOAD_PARSE_ERROR", message: msg });
      return;
    }

    const imgBuf = parsed.image;
    if (!imgBuf?.length) {
      sendJson(res, 400, {
        success: false,
        code: "UPLOAD_FILE_REQUIRED",
        message: "Не передан файл image в multipart/form-data.",
      });
      return;
    }

    let result: ClientBaseImageUploadExecuteResult;
    try {
      const { executeClientBaseImageUpload, sanitizeUploadUserIdFromHeader } = await import(
        "../../shared/client-base-image-upload-execute"
      );
      result = await executeClientBaseImageUpload({
        token,
        userId: sanitizeUploadUserIdFromHeader(req.headers["x-tandoor-demo-user-id"]),
        imageBuffer: parsed.image,
        imageMime: parsed.imageMime,
        thumbBuffer: parsed.thumbnail,
        thumbMime: parsed.thumbMime,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка инициализации загрузки.";
      sendJson(res, 500, {
        success: false,
        code: "UPLOAD_SERVER_ERROR",
        message: msg,
      });
      return;
    }

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
    sendJson(res, 500, {
      success: false,
      code: "UPLOAD_SERVER_ERROR",
      message: msg,
    });
  }
}
