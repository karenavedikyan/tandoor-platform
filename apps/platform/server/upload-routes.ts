import type { Express, Request, Response } from "express";
import multer from "multer";
import { executeClientBaseImageUpload, sanitizeUploadUserIdFromHeader } from "../shared/client-base-image-upload-execute";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const fields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

export function registerUploadRoutes(app: Express): void {
  app.get("/api/uploads/config", (_req: Request, res: Response) => {
    try {
      const configured = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
      res.json({ configured });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка.";
      res.status(500).json({ success: false, message: msg });
    }
  });

  app.post(
    "/api/uploads/image",
    (req: Request, res: Response, next) => {
      try {
        if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
          res.status(503).json({
            success: false,
            code: "UPLOAD_NOT_CONFIGURED",
            message:
              "Загрузка фото пока не настроена. Укажите BLOB_READ_WRITE_TOKEN (Vercel Blob) в переменных окружения сервера.",
          });
          return;
        }
        next();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ошибка.";
        res.status(500).json({ success: false, message: msg });
      }
    },
    (req: Request, res: Response, next) => {
      fields(req, res, (err: unknown) => {
        if (err) {
          const msg = err instanceof Error ? err.message : "Ошибка разбора multipart.";
          res.status(400).json({ success: false, message: msg });
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const files = req.files as { image?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] } | undefined;
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
          res.status(result.httpStatus).json({
            success: false,
            ...(result.code ? { code: result.code } : {}),
            message: result.message,
          });
          return;
        }

        res.json({ success: true, url: result.url, thumbnailUrl: result.thumbnailUrl });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Внутренняя ошибка загрузки.";
        res.status(500).json({ success: false, message: msg });
      }
    },
  );
}
