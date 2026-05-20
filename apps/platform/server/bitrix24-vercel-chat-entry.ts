/**
 * Vercel entry: /api/bitrix24/chat/*
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runBitrix24ChatDiagnostics } from "./bitrix24-chat-diagnostics-execute";
import { runBitrix24ChatMessages } from "./bitrix24-chat-messages-execute";
import { runBitrix24ChatMessagesPersonal } from "./bitrix24-chat-messages-personal-execute";
import { runBitrix24ChatRecent } from "./bitrix24-chat-recent-execute";
import { runBitrix24ChatRecentPersonal } from "./bitrix24-chat-recent-personal-execute";
import { runBitrix24ChatSend } from "./bitrix24-chat-send-execute";
import { runBitrix24ChatSendPersonal } from "./bitrix24-chat-send-personal-execute";

const JSON_CT = "application/json; charset=utf-8";

const SHARED_WEBHOOK_DISABLED_BODY = {
  success: false,
  code: "BITRIX24_COMMUNICATIONS_DISABLED",
  message:
    "Раздел Коммуникации временно отключён: общий webhook Bitrix24 нельзя использовать для личных чатов сотрудников. Нужна персональная авторизация Bitrix24.",
} as const;

function isUnsafeSharedWebhookEnabled(): boolean {
  const v = process.env.BITRIX24_COMMUNICATIONS_UNSAFE_SHARED_WEBHOOK_ENABLED;
  return typeof v === "string" && v.trim().toLowerCase() === "true";
}

function pickAction(req: VercelRequest): string {
  const a = req.query?.action;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && typeof a[0] === "string") return a[0].trim();
  return "";
}

function readJsonBody(req: VercelRequest): unknown {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body) as unknown;
      } catch {
        return undefined;
      }
    }
    return req.body as unknown;
  }
  return undefined;
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

export async function bitrix24ChatVercelHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = pickAction(req);
  res.setHeader("Content-Type", JSON_CT);
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({
        success: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Используйте POST с заголовком content-type: application/json.",
      });
      return;
    }

    const body = readJsonBody(req);

    if (action === "recent" || action === "messages" || action === "send" || action === "diagnostics") {
      if (!isUnsafeSharedWebhookEnabled()) {
        res.status(403).json({ ...SHARED_WEBHOOK_DISABLED_BODY });
        return;
      }
      if (action === "recent") {
        const { status, body: b } = await runBitrix24ChatRecent(body ?? {});
        res.status(status).json(b);
        return;
      }
      if (action === "messages") {
        const { status, body: b } = await runBitrix24ChatMessages(body ?? {});
        res.status(status).json(b);
        return;
      }
      if (action === "send") {
        const { status, body: b } = await runBitrix24ChatSend(body ?? {});
        res.status(status).json(b);
        return;
      }
      if (action === "diagnostics") {
        const { status, body: b } = await runBitrix24ChatDiagnostics(body ?? {});
        res.status(status).json(b);
        return;
      }
    }
    if (action === "recent-personal") {
      const { status, body: b, setCookies } = await runBitrix24ChatRecentPersonal(cookieHeader(req));
      applySetCookies(res, setCookies);
      res.status(status).json(b);
      return;
    }
    if (action === "messages-personal") {
      const { status, body: b, setCookies } = await runBitrix24ChatMessagesPersonal(body ?? {}, cookieHeader(req));
      applySetCookies(res, setCookies);
      res.status(status).json(b);
      return;
    }
    if (action === "send-personal") {
      const { status, body: b, setCookies } = await runBitrix24ChatSendPersonal(body ?? {}, cookieHeader(req));
      applySetCookies(res, setCookies);
      res.status(status).json(b);
      return;
    }

    res.status(404).json({ success: false, code: "NOT_FOUND", message: "Неизвестный chat-маршрут Bitrix24." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[bitrix24-api] chat", action, m);
    res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка сервера. Повторите запрос позже.",
    });
  }
}
