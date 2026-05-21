/**
 * Загрузка буферов изображений в Vercel Blob (сервер).
 */

import { put } from "@vercel/blob";

function mimeToExt(m: string): string {
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return "jpg";
}

export async function putClientBaseImagePair(opts: {
  token: string;
  userId: string;
  imageBuffer: Buffer;
  imageMime: string;
  thumbBuffer?: Buffer;
  thumbMime?: string;
}): Promise<{ url: string; thumbnailUrl: string }> {
  const safeUser = opts.userId.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) || "anonymous";
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);
  const extMain = mimeToExt(opts.imageMime);
  const mainPath = `client-base/${safeUser}/${ts}-${rnd}-main.${extMain}`;
  const main = await put(mainPath, opts.imageBuffer, {
    access: "public",
    token: opts.token,
    contentType: opts.imageMime,
  });
  let thumbnailUrl = main.url;
  if (opts.thumbBuffer && opts.thumbBuffer.length > 0 && opts.thumbMime) {
    const extT = mimeToExt(opts.thumbMime);
    const thumbPath = `client-base/${safeUser}/${ts}-${rnd}-thumb.${extT}`;
    const thumb = await put(thumbPath, opts.thumbBuffer, {
      access: "public",
      token: opts.token,
      contentType: opts.thumbMime,
    });
    thumbnailUrl = thumb.url;
  }
  return { url: main.url, thumbnailUrl };
}
