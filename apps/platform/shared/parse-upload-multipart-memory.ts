/**
 * Парсинг multipart/form-data в память для serverless (Vercel), без multer.
 * Ожидаются поля `image` и опционально `thumbnail`.
 */

import busboy from "busboy";
import type { IncomingMessage } from "node:http";

export type ParsedClientBaseUploadMultipart = {
  image?: Buffer;
  imageMime?: string;
  thumbnail?: Buffer;
  thumbMime?: string;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function parseClientBaseUploadMultipart(req: IncomingMessage): Promise<ParsedClientBaseUploadMultipart> {
  return new Promise((resolve, reject) => {
    const ct = req.headers["content-type"];
    if (!ct || !String(ct).toLowerCase().includes("multipart/form-data")) {
      resolve({});
      return;
    }

    const out: ParsedClientBaseUploadMultipart = {};
    const fileTasks: Promise<void>[] = [];

    const bb = busboy({
      headers: req.headers,
      limits: { files: 4, fileSize: MAX_FILE_BYTES },
    });

    bb.on("file", (name, file, info) => {
      const field = name === "image" || name === "thumbnail" ? name : null;
      if (!field) {
        file.resume();
        return;
      }

      fileTasks.push(
        new Promise<void>((res, rej) => {
          const chunks: Buffer[] = [];
          file.on("data", (chunk: Buffer) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          file.on("limit", () => {
            file.resume();
            rej(new Error("Превышен максимальный размер файла (10 МБ)."));
          });
          file.on("error", rej);
          file.on("end", () => {
            const buf = Buffer.concat(chunks);
            const mime = (info.mimeType ?? "").toLowerCase();
            if (field === "image") {
              out.image = buf;
              out.imageMime = mime;
            } else {
              out.thumbnail = buf;
              out.thumbMime = mime;
            }
            res();
          });
        }),
      );
    });

    bb.on("error", (err: Error) => {
      reject(err);
    });

    bb.on("finish", () => {
      void Promise.all(fileTasks)
        .then(() => resolve(out))
        .catch(reject);
    });

    req.pipe(bb);
  });
}
