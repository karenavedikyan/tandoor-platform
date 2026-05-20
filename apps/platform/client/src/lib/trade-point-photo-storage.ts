/**
 * Фото торговых точек (MVP: data URL в localStorage, без backend).
 * Ключ: dealerId + tradePointId.
 */

export const TRADE_POINT_PHOTO_STORAGE_KEY = "tandoor-trade-point-photos-v1";
export const TRADE_POINT_PHOTO_EVENT = "tandoor-trade-point-photos-changed";

/** Макс. размер файла до сжатия (байт). */
export const TRADE_POINT_PHOTO_MAX_INPUT_BYTES = 5 * 1024 * 1024;
/** Целевой макс. длина data URL после сжатия (порядок). */
const TARGET_MAX_DATA_URL_CHARS = 900_000;

type PhotoRoot = Record<string, Record<string, string>>;

function emptyRoot(): PhotoRoot {
  return {};
}

export function loadTradePointPhotoRoot(): PhotoRoot {
  if (typeof window === "undefined" || !window.localStorage) return emptyRoot();
  try {
    const raw = window.localStorage.getItem(TRADE_POINT_PHOTO_STORAGE_KEY);
    if (!raw) return emptyRoot();
    const p = JSON.parse(raw) as PhotoRoot;
    return p && typeof p === "object" ? p : emptyRoot();
  } catch {
    return emptyRoot();
  }
}

function saveTradePointPhotoRoot(root: PhotoRoot): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(TRADE_POINT_PHOTO_STORAGE_KEY, JSON.stringify(root));
  window.dispatchEvent(new CustomEvent(TRADE_POINT_PHOTO_EVENT));
}

export function getTradePointPhotoDataUrl(dealerId: string, tradePointId: string): string | null {
  const url = loadTradePointPhotoRoot()[dealerId]?.[tradePointId];
  return typeof url === "string" && url.startsWith("data:image/") ? url : null;
}

export function removeTradePointPhoto(dealerId: string, tradePointId: string): void {
  const root = { ...loadTradePointPhotoRoot() };
  const inner = { ...(root[dealerId] ?? {}) };
  delete inner[tradePointId];
  if (Object.keys(inner).length === 0) delete root[dealerId];
  else root[dealerId] = inner;
  saveTradePointPhotoRoot(root);
}

/**
 * Сжимает изображение до JPEG (если возможно) и ограничивает размер.
 * @returns data URL или сообщение об ошибке.
 */
export async function compressImageFileToDataUrl(file: File): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Выберите файл изображения." };
  }
  if (file.size > TRADE_POINT_PHOTO_MAX_INPUT_BYTES) {
    return { ok: false, error: `Файл слишком большой (макс. ${TRADE_POINT_PHOTO_MAX_INPUT_BYTES / (1024 * 1024)} МБ).` };
  }

  const bitmap = await readImageBitmap(file);
  const maxDim = 1600;
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const k = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * k);
    height = Math.round(height * k);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: "Не удалось обработать изображение." };
  ctx.drawImage(bitmap, 0, 0, width, height);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  let guard = 0;
  while (dataUrl.length > TARGET_MAX_DATA_URL_CHARS && quality > 0.35 && guard < 12) {
    quality -= 0.06;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    guard += 1;
  }
  if (dataUrl.length > TARGET_MAX_DATA_URL_CHARS) {
    return { ok: false, error: "После сжатия фото всё ещено слишком велико — выберите другое изображение." };
  }
  return { ok: true, dataUrl };
}

function readImageBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export function setTradePointPhotoDataUrl(dealerId: string, tradePointId: string, dataUrl: string): void {
  const root = { ...loadTradePointPhotoRoot() };
  const inner = { ...(root[dealerId] ?? {}) };
  inner[tradePointId] = dataUrl;
  root[dealerId] = inner;
  saveTradePointPhotoRoot(root);
}
