/**
 * Vercel entry: /api/bitrix24/oauth/*
 * Делегирует в те же run*-модули, что и Express.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runBitrix24OAuthCallback, runBitrix24OAuthDisconnect } from "./bitrix24-oauth-callback-execute";
import { runBitrix24OAuthStart } from "./bitrix24-oauth-start-execute";
import { runBitrix24OAuthStatus } from "./bitrix24-oauth-status-execute";

const JSON_CT = "application/json; charset=utf-8";

function pickAction(req: VercelRequest): string {
  const a = req.query?.action;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && typeof a[0] === "string") return a[0].trim();
  return "";
}

function cookieHeader(req: VercelRequest): string | undefined {
  const h = req.headers.cookie;
  return typeof h === "string" ? h : undefined;
}

function applySetCookies(res: VercelResponse, list: string[] | undefined): void {
  if (!list?.length) return;
  for (const c of list) {
    const cur = res.getHeader("Set-Cookie");
    if (!cur) res.setHeader("Set-Cookie", c);
    else if (Array.isArray(cur)) res.setHeader("Set-Cookie", [...cur, c]);
    else res.setHeader("Set-Cookie", [String(cur), c]);
  }
}

export async function bitrix24OauthVercelHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = pickAction(req);
  try {
    if (action === "status" && req.method === "GET") {
      const { status, body, setCookies } = await runBitrix24OAuthStatus(cookieHeader(req));
      res.setHeader("Content-Type", JSON_CT);
      applySetCookies(res, setCookies);
      res.status(status).json(body);
      return;
    }
    if (action === "start" && req.method === "GET") {
      const { status, body, setCookie } = runBitrix24OAuthStart();
      res.setHeader("Content-Type", JSON_CT);
      if (setCookie) res.setHeader("Set-Cookie", setCookie);
      res.status(status).json(body);
      return;
    }
    if (action === "callback" && req.method === "GET") {
      const out = await runBitrix24OAuthCallback({
        query: (req.query ?? {}) as Record<string, unknown>,
        cookieHeader: cookieHeader(req),
        prefersBrowserRedirect: true,
      });
      applySetCookies(res, out.setCookies);
      if (out.kind === "redirect") {
        res.setHeader("Location", out.location);
        res.statusCode = 302;
        res.end();
        return;
      }
      res.setHeader("Content-Type", JSON_CT);
      res.status(out.status).json(out.body);
      return;
    }
    if (action === "disconnect" && req.method === "POST") {
      const { setCookies } = runBitrix24OAuthDisconnect();
      res.setHeader("Content-Type", JSON_CT);
      applySetCookies(res, setCookies);
      res.status(200).json({ success: true, message: "Подключение Bitrix24 сброшено в этом браузере." });
      return;
    }

    res.setHeader("Content-Type", JSON_CT);
    res.status(404).json({ success: false, code: "NOT_FOUND", message: "Неизвестный OAuth-маршрут Bitrix24." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] oauth", action, m);
    res.setHeader("Content-Type", JSON_CT);
    res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
