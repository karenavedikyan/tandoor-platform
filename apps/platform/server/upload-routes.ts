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
    const configured = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
    res.json({ configured });
  });

  app.post("/api/uploads/image", fields, async (req: Request, res: Response) => {
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
  });
}
