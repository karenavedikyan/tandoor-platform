import type { Express, Request, Response } from "express";
import {
  fetchDadataAddressSuggestions,
  fetchDadataPartyByInn,
  getDadataApiKey,
  isDadataAddressSuggestEnabled,
  isDadataPartyLookupEnabled,
  parseAddressSuggestBody,
  parsePartyFindBody,
  readJsonBodyFromUnknown,
} from "../shared/dadata-handlers";

const JSON_CT = "application/json; charset=utf-8";

function sendJson(res: Response, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

export function registerDadataRoutes(app: Express): void {
  app.post("/api/dadata/address-suggest", async (req: Request, res: Response) => {
    try {
      const raw = readJsonBodyFromUnknown(req.body, typeof req.body === "string" ? (req.body as string) : undefined);
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
  });

  app.post("/api/dadata/party-find-by-inn", async (req: Request, res: Response) => {
    try {
      const raw = readJsonBodyFromUnknown(req.body, typeof req.body === "string" ? (req.body as string) : undefined);
      const parsed = parsePartyFindBody(raw);
      if (!parsed.ok) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: parsed.message });
        return;
      }
      if (!isDadataPartyLookupEnabled()) {
        sendJson(res, 200, {
          success: false,
          code: "DADATA_PARTY_NOT_CONFIGURED",
          message: "Поиск юрлица по ИНН через DaData не подключён.",
        });
        return;
      }
      const apiKey = getDadataApiKey();
      const out = await fetchDadataPartyByInn(parsed.inn, apiKey);
      if (!out.ok) {
        sendJson(res, out.status, { success: false, message: out.message });
        return;
      }
      sendJson(res, 200, { success: true, items: out.items });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[dadata-party-find-by-inn]", m.slice(0, 200));
      sendJson(res, 500, { success: false, message: "Внутренняя ошибка сервера." });
    }
  });
}
