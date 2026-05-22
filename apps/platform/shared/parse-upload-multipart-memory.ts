/**
 * Парсинг multipart/form-data в память для serverless (Vercel), без multer.
 * Ожидаются поля `image` и опционально `thumbnail`.
 *
 * Тело сначала читается в Buffer, затем подаётся в busboy через Readable.from().
 * Так надёжнее, чем req.pipe(busboy), на Vercel (стрим запроса / helpers).
 */

import busboy from "busboy";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

/** Поток файла из busboy (Readable + флаг обрезки по лимиту). */
type BusboyMultipartFileStream = Readable & { truncated?: boolean };

/** Заголовки file-part в multipart/form-data (аргумент `info` у события `file`). */
interface BusboyMultipartFileInfo {
  encoding: string;
  mimeType: string;
  filename: string;
}

export type ParsedClientBaseUploadMultipart = {
  image?: Buffer;
  imageMime?: string;
  thumbnail?: Buffer;
  thumbMime?: string;
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Запас на boundary и поля формы поверх лимита файла. */
const MAX_TOTAL_MULTIPART_BYTES = 12 * 1024 * 1024;

function normalizeHeadersForBusboy(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const out: IncomingHttpHeaders = { ...headers };
  const ct = headers["content-type"];
  if (Array.isArray(ct)) {
    out["content-type"] = ct[0];
  }
  return out;
}

async function bufferRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Uint8Array | Buffer | string>) {
    if (Buffer.isBuffer(chunk)) chunks.push(chunk);
    else if (typeof chunk === "string") chunks.push(Buffer.from(chunk));
    else chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function parseClientBaseUploadMultipart(req: IncomingMessage): Promise<ParsedClientBaseUploadMultipart> {
  const headers = normalizeHeadersForBusboy(req.headers);
  const ct = headers["content-type"];
  if (!ct || typeof ct !== "string" || !ct.toLowerCase().includes("multipart/form-data")) {
    return {};
  }

  const raw = await bufferRequestBody(req);
  if (raw.length > MAX_TOTAL_MULTIPART_BYTES) {
    throw new Error("Слишком большой запрос (лимит загрузки).");
  }

  return new Promise((resolve, reject) => {
    const out: ParsedClientBaseUploadMultipart = {};
    const fileTasks: Promise<void>[] = [];

    const bb = busboy({
      headers,
      limits: { files: 4, fileSize: MAX_FILE_BYTES },
    });

    bb.on("file", (name: string, file: BusboyMultipartFileStream, info: BusboyMultipartFileInfo) => {
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

    Readable.from(raw).pipe(bb);

    void finished(bb)
      .then(() => Promise.all(fileTasks))
      .then(() => resolve(out))
      .catch((err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));
  });
}
