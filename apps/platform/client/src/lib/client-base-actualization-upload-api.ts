/**
 * Клиент: загрузка изображений на сервер (URL в ответе).
 */

export type UploadImageApiResult =
  | { success: true; url: string; thumbnailUrl: string }
  | { success: false; code?: string; message: string };

export async function fetchUploadConfig(): Promise<{ configured: boolean }> {
  try {
    const res = await fetch("/api/uploads/config");
    if (!res.ok) return { configured: false };
    const j = (await res.json()) as { configured?: boolean };
    return { configured: Boolean(j.configured) };
  } catch {
    return { configured: false };
  }
}

export async function uploadClientBaseImagePair(params: {
  image: Blob;
  thumbnail: Blob;
  fileName?: string;
}): Promise<UploadImageApiResult> {
  const fd = new FormData();
  fd.append("image", params.image, params.fileName?.replace(/[^\w.\-]+/g, "_") || "photo.jpg");
  fd.append("thumbnail", params.thumbnail, "thumb.jpg");
  const res = await fetch("/api/uploads/image", { method: "POST", body: fd });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof j.code === "string" ? j.code : undefined;
    const message = typeof j.message === "string" ? j.message : `Ошибка загрузки (${res.status})`;
    return { success: false, code, message };
  }
  if (j.success === true && typeof j.url === "string") {
    const thumb = typeof j.thumbnailUrl === "string" ? j.thumbnailUrl : String(j.url);
    return { success: true, url: String(j.url), thumbnailUrl: thumb };
  }
  return { success: false, message: typeof j.message === "string" ? j.message : "Неизвестный ответ сервера." };
}
