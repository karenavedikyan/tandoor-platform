import type { VercelRequest } from "@vercel/node";

/** Vercel Cron (`x-vercel-cron: 1`) или `Authorization: Bearer CRON_SECRET`. */
export function isCronAuthorized(req: VercelRequest): boolean {
  const cronH = req.headers["x-vercel-cron"];
  const cronV = Array.isArray(cronH) ? cronH[0] : cronH;
  if (typeof cronV === "string" && cronV.trim() === "1") return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers["authorization"];
    const av = Array.isArray(auth) ? auth[0] : auth;
    if (typeof av === "string" && av.trim() === `Bearer ${secret}`) return true;
  }
  return false;
}

export function isCronBearerOnly(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers["authorization"];
  const av = Array.isArray(auth) ? auth[0] : auth;
  return typeof av === "string" && av.trim() === `Bearer ${secret}`;
}
