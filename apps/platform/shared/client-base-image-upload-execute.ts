/**
 * Общая серверная логика загрузки пары изображений (основное + миниатюра) в Vercel Blob.
 * Вызывается из Express (`server/upload-routes.ts`) и из Vercel serverless (`api/uploads/image.ts`).
 */

import { putClientBaseImagePair } from "./upload-image-blob";

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export type ClientBaseImageUploadExecuteResult =
  | { ok: true; url: string; thumbnailUrl: string }
  | { ok: false; httpStatus: number; code?: string; message: string };

export function sanitizeUploadUserIdFromHeader(rawHeader: string | string[] | undefined): string {
  const raw = typeof rawHeader === "string" ? rawHeader : Array.isArray(rawHeader) ? rawHeader[0] : "";
  const t = (raw ?? "").trim();
  if (!t || t.length > 96) return "anonymous";
  if (!/^[a-zA-Z0-9._-]+$/.test(t)) return "anonymous";
  return t;
}

/**
 * @param token — `BLOB_READ_WRITE_TOKEN`; если пусто, вернётся `UPLOAD_NOT_CONFIGURED`.
 */
export async function executeClientBaseImageUpload(opts: {
  token: string | undefined;
  userId: string;
  imageBuffer?: Buffer;
  imageMime?: string;
  thumbBuffer?: Buffer;
  thumbMime?: string;
}): Promise<ClientBaseImageUploadExecuteResult> {
  const token = opts.token?.trim();
  if (!token) {
    return {
      ok: false,
      httpStatus: 503,
      code: "UPLOAD_NOT_CONFIGURED",
      message:
        "Загрузка фото пока не настроена. Укажите BLOB_READ_WRITE_TOKEN (Vercel Blob) в переменных окружения сервера.",
    };
  }

  const imgBuf = opts.imageBuffer;
  if (!imgBuf?.length) {
    return { ok: false, httpStatus: 400, message: "Не передан файл image." };
  }

  const mime = (opts.imageMime ?? "").toLowerCase();
  if (!ALLOWED.has(mime)) {
    return { ok: false, httpStatus: 400, message: "Допустимы только JPG, PNG и WebP." };
  }

  const thumbMimeRaw = opts.thumbMime?.toLowerCase() ?? "";
  const thumbBuf =
    opts.thumbBuffer && opts.thumbBuffer.length > 0 && ALLOWED.has(thumbMimeRaw) ? opts.thumbBuffer : undefined;
  const thumbMime = thumbBuf ? (thumbMimeRaw === "image/jpg" ? "image/jpeg" : thumbMimeRaw) : undefined;

  try {
    const pair = await putClientBaseImagePair({
      token,
      userId: opts.userId,
      imageBuffer: imgBuf,
      imageMime: mime === "image/jpg" ? "image/jpeg" : mime,
      thumbBuffer: thumbBuf,
      thumbMime,
    });
    return { ok: true, url: pair.url, thumbnailUrl: pair.thumbnailUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка загрузки в хранилище.";
    return { ok: false, httpStatus: 500, message: msg };
  }
}
