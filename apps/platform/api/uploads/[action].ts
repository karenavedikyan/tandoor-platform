/**
 * Vercel Serverless: /api/uploads/:action
 *
 * Catch-all handler для uploads (config + image + ping).
 * Объединение в один файл — обход лимита Vercel Hobby 12-функций.
 *
 * Локально те же пути в Express: `server/upload-routes.ts` (multer).
 *
 * bodyParser отключён на уровне всего файла, так как `image` требует сырой multipart.
 * Для `config` и `ping` это безвредно — они не читают тело запроса.
 *
 * Тяжёлые модули (busboy/blob) подгружаются только в ветке `image` через dynamic import,
 * чтобы пустой запрос на `config`/`ping` не тянул их.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { IncomingMessage } from "node:http";

const JSON_CT = "application/json; charset=utf-8";

/** Next.js / Vercel: не преобразовывать тело запроса до handler (нужен сырой multipart для image). */
export const config = {
  api: {
    bodyParser: false,
  },
};

type ClientBaseImageUploadExecuteResult =
  | { ok: true; url: string; thumbnailUrl: string }
  | { ok: false; httpStatus: number; code?: string; message: string };

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  try {
    if (res.headersSent) return;
    res.setHeader("Content-Type", JSON_CT);
    res.status(status).json(body);
  } catch {
    /* ignore */
  }
}

function headerString(h: string | string[] | undefined): string {
  if (h === undefined) return "";
  return Array.isArray(h) ? (h[0] ?? "") : String(h);
}

function pickAction(req: VercelRequest): string {
  const a = req.query?.action;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && typeof a[0] === "string") return a[0].trim();
  return "";
}

// ---------- config ----------

function handleConfig(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, message: "Метод не поддерживается. Используйте GET." });
    return;
  }
  sendJson(res, 200, { configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()) });
}

// ---------- ping ----------

function handlePing(_req: VercelRequest, res: VercelResponse): void {
  try {
    if (!res.headersSent) {
      res.setHeader("Content-Type", JSON_CT);
    }
    res.status(200).json({ ok: true, route: "uploads/ping" });
  } catch {
    try {
      if (!res.headersSent) res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("uploads/ping error");
    } catch {
      /* ignore */
    }
  }
}

// ---------- image ----------

async function handleImage(req: VercelRequest, res: VercelResponse): Promise<void> {
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
}

// ---------- entry ----------

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = pickAction(req);
  try {
    if (action === "config") {
      handleConfig(req, res);
      return;
    }
    if (action === "ping") {
      handlePing(req, res);
      return;
    }
    if (action === "image") {
      await handleImage(req, res);
      return;
    }
    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный маршрут uploads API.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/uploads]", action, m.slice(0, 200));
    try {
      if (!res.headersSent && !res.writableEnded) {
        sendJson(res, 500, {
          success: false,
          code: "UPLOAD_SERVER_ERROR",
          message: "Внутренняя ошибка загрузки.",
        });
      }
    } catch {
      /* ignore */
    }
  }
}
