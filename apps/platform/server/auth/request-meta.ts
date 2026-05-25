/**
 * IP клиента для audit / сессий. Одинаково для Vercel и Express.
 * Не полагаться на подлинность без доверия к прокси (Vercel задаёт заголовки).
 */

type HeaderMap = Record<string, string | string[] | undefined>;

export function getClientIp(headers: HeaderMap): string | null {
  const xff = headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(xff) && xff[0]?.trim()) {
    const first = xff[0]!.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = headers["x-real-ip"];
  if (typeof xri === "string" && xri.trim()) return xri.trim();
  if (Array.isArray(xri) && xri[0]?.trim()) return xri[0]!.trim();
  return null;
}
