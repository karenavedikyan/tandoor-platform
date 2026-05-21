/**
 * Vercel / Node: POST /api/dadata/address-suggest
 * Self-contained entry: импорт только @vercel/node + shared/dadata-handlers.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  fetchDadataAddressSuggestions,
  getDadataApiKey,
  isDadataAddressSuggestEnabled,
  parseAddressSuggestBody,
  readJsonBodyFromUnknown,
} from "../../shared/dadata-handlers";

const JSON_CT = "application/json; charset=utf-8";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, message: "Используйте POST." });
      return;
    }
    const raw = readJsonBodyFromUnknown(req.body, typeof req.body === "string" ? req.body : undefined);
    const parsed = parseAddressSuggestBody(raw);
    if (!parsed.ok) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: parsed.message });
      return;
    }
    if (!isDadataAddressSuggestEnabled()) {
      sendJson(res, 200, {
        success: false,
        code: "DADATA_NOT_CONFIGURED",
        message: "Сервис подсказок адресов не подключён.",
      });
      return;
    }
    const apiKey = getDadataApiKey();
    const out = await fetchDadataAddressSuggestions(parsed.query, parsed.count, apiKey);
    if (!out.ok) {
      sendJson(res, out.status, { success: false, message: out.message });
      return;
    }
    sendJson(res, 200, { success: true, items: out.items });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[dadata-address-suggest]", m.slice(0, 200));
    sendJson(res, 500, { success: false, message: "Внутренняя ошибка сервера." });
  }
}
