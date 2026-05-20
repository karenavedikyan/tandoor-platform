/**
 * Vercel Serverless: GET /api/bitrix24/oauth/status
 *
 * Полностью автономный handler: без импортов из других файлов api/, server/*, client/*, @/.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

function strEnv(name: string): string {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      sendJson(res, 405, {
        success: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Используйте GET.",
      });
      return;
    }

    const clientId = strEnv("BITRIX24_OAUTH_CLIENT_ID");
    const clientSecret = strEnv("BITRIX24_OAUTH_CLIENT_SECRET");
    const portalDomain = strEnv("BITRIX24_PORTAL_DOMAIN");
    const configured = Boolean(clientId && clientSecret && portalDomain);

    sendJson(res, 200, {
      success: true,
      configured,
      connected: false,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth/status unhandled", m);
    sendJson(res, 500, {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
