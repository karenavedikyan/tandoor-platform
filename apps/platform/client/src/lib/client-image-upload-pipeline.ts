/**
 * Клиент: сжатие изображения до JPEG перед загрузкой (без base64 в state).
 */

export const CLIENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const MAIN_MAX_SIDE = 1920;
const THUMB_MAX_SIDE = 540;
const JPEG_QUALITY_MAIN = 0.82;
const JPEG_QUALITY_THUMB = 0.78;

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Не удалось сформировать JPEG."));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function readBitmap(file: File): Promise<ImageBitmap> {
  const lower = file.name.toLowerCase();
  const heic =
    file.type.includes("heic") ||
    file.type.includes("heif") ||
    lower.endsWith(".heic") ||
    lower.endsWith(".heif");
  if (heic) {
    throw new Error("Формат HEIC/HEIF пока не поддерживается. Сохраните фото как JPG или PNG.");
  }
  return createImageBitmap(file);
}

function scaleToMaxSide(width: number, height: number, maxSide: number): { w: number; h: number } {
  if (width <= maxSide && height <= maxSide) return { w: width, h: height };
  const k = Math.min(maxSide / width, maxSide / height);
  return { w: Math.max(1, Math.round(width * k)), h: Math.max(1, Math.round(height * k)) };
}

export async function prepareImageFileForUpload(
  file: File,
): Promise<{ ok: true; image: Blob; thumbnail: Blob; width: number; height: number } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Выберите файл изображения (JPG, PNG или WebP)." };
  }
  if (file.size > CLIENT_IMAGE_MAX_BYTES) {
    return { ok: false, error: "Файл больше 10 МБ." };
  }
  try {
    const bitmap = await readBitmap(file);
    const { width: sw, height: sh } = bitmap;
    const mainDim = scaleToMaxSide(sw, sh, MAIN_MAX_SIDE);
    const thumbDim = scaleToMaxSide(sw, sh, THUMB_MAX_SIDE);

    const canvasMain = document.createElement("canvas");
    canvasMain.width = mainDim.w;
    canvasMain.height = mainDim.h;
    const ctxMain = canvasMain.getContext("2d");
    if (!ctxMain) return { ok: false, error: "Не удалось обработать изображение." };
    ctxMain.drawImage(bitmap, 0, 0, mainDim.w, mainDim.h);

    const canvasThumb = document.createElement("canvas");
    canvasThumb.width = thumbDim.w;
    canvasThumb.height = thumbDim.h;
    const ctxThumb = canvasThumb.getContext("2d");
    if (!ctxThumb) return { ok: false, error: "Не удалось обработать изображение." };
    ctxThumb.drawImage(bitmap, 0, 0, thumbDim.w, thumbDim.h);

    bitmap.close?.();

    const [image, thumbnail] = await Promise.all([
      canvasToJpegBlob(canvasMain, JPEG_QUALITY_MAIN),
      canvasToJpegBlob(canvasThumb, JPEG_QUALITY_THUMB),
    ]);
    return { ok: true, image, thumbnail, width: mainDim.w, height: mainDim.h };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не удалось обработать изображение.";
    return { ok: false, error: msg };
  }
}
