/**
 * Vercel Serverless: POST /api/uploads/image
 *
 * Локальная разработка (`npm run dev`): тот же путь обслуживает Express в `server/upload-routes.ts`.
 * На Vercel production запрос попадает сюда; multipart разбирается через multer (как в Express).
 *
 * Общая логика загрузки в Blob: `shared/client-base-image-upload-execute.ts` → `putClientBaseImagePair`
 * в `shared/upload-image-blob.ts`.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { IncomingMessage } from "node:http";
import multer from "multer";
import { executeClientBaseImageUpload, sanitizeUploadUserIdFromHeader } from "../../shared/client-base-image-upload-execute";

const JSON_CT = "application/json; charset=utf-8";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const fields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

type MemoryUploadFile = { buffer?: Buffer; mimetype?: string };

type MulterRequest = IncomingMessage & {
  files?: { image?: MemoryUploadFile[]; thumbnail?: MemoryUploadFile[] };
};

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    sendJson(res, 405, { success: false, message: "Метод не поддерживается. Используйте POST." });
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      // Multer ожидает Express Request/Response; VercelRequest совместим по потоку тела.
      fields(req as never, res as never, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка разбора multipart.";
    sendJson(res, 400, { success: false, message: msg });
    return;
  }

  const mreq = req as unknown as MulterRequest;
  const files = mreq.files;
  const img = files?.image?.[0];
  const thumb = files?.thumbnail?.[0];

  const result = await executeClientBaseImageUpload({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    userId: sanitizeUploadUserIdFromHeader(req.headers["x-tandoor-demo-user-id"]),
    imageBuffer: img?.buffer,
    imageMime: img?.mimetype,
    thumbBuffer: thumb?.buffer,
    thumbMime: thumb?.mimetype,
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
}
