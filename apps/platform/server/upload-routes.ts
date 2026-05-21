import type { Express, Request, Response } from "express";
import multer from "multer";
import { putClientBaseImagePair } from "../shared/upload-image-blob";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const fields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function userIdFromRequest(req: Request): string {
  const h = req.headers["x-tandoor-demo-user-id"];
  const raw = typeof h === "string" ? h : Array.isArray(h) ? h[0] : "";
  const t = (raw ?? "").trim();
  if (!t || t.length > 96) return "anonymous";
  if (!/^[a-zA-Z0-9._-]+$/.test(t)) return "anonymous";
  return t;
}

export function registerUploadRoutes(app: Express): void {
  app.get("/api/uploads/config", (_req: Request, res: Response) => {
    const configured = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
    res.json({ configured });
  });

  app.post("/api/uploads/image", fields, async (req: Request, res: Response) => {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token) {
      res.status(503).json({
        success: false,
        code: "UPLOAD_STORAGE_NOT_CONFIGURED",
        message: "Загрузка фото пока не настроена. Укажите BLOB_READ_WRITE_TOKEN (Vercel Blob) в переменных окружения сервера.",
      });
      return;
    }

    const files = req.files as { image?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] } | undefined;
    const img = files?.image?.[0];
    if (!img?.buffer) {
      res.status(400).json({ success: false, message: "Не передан файл image." });
      return;
    }
    const mime = img.mimetype.toLowerCase();
    if (!ALLOWED.has(mime)) {
      res.status(400).json({ success: false, message: "Допустимы только JPG, PNG и WebP." });
      return;
    }

    const thumb = files?.thumbnail?.[0];
    const thumbMime = thumb?.mimetype?.toLowerCase() ?? "";
    const thumbBuf = thumb?.buffer && ALLOWED.has(thumbMime) ? thumb.buffer : undefined;

    try {
      const userId = userIdFromRequest(req);
      const pair = await putClientBaseImagePair({
        token,
        userId,
        imageBuffer: img.buffer,
        imageMime: mime === "image/jpg" ? "image/jpeg" : mime,
        thumbBuffer: thumbBuf,
        thumbMime: thumbBuf ? (thumbMime === "image/jpg" ? "image/jpeg" : thumbMime) : undefined,
      });
      res.json({ success: true, url: pair.url, thumbnailUrl: pair.thumbnailUrl });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки в хранилище.";
      res.status(500).json({ success: false, message: msg });
    }
  });
}
