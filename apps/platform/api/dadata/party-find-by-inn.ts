/**
 * Vercel Serverless: POST /api/dadata/party-find-by-inn
 *
 * Полностью self-contained handler: только типы `@vercel/node` и глобальный `fetch`.
 * Без импортов из `server/`, `shared/`, client — иначе Vercel-tracing может уронить
 * функцию ещё до возврата JSON (`FUNCTION_INVOCATION_FAILED`).
 *
 * Express-дев-роуты (`server/dadata-routes.ts`) продолжают использовать
 * общий модуль `shared/dadata-handlers.ts`; здесь логика дублируется намеренно.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

type DadataPartyLookupItem = {
  id: string;
  name: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  legalAddress?: string;
  source: string;
};

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function getDadataApiKey(): string {
  return (process.env.DADATA_API_KEY ?? "").trim();
}

function isDadataPartyLookupEnabled(): boolean {
  const key = getDadataApiKey();
  if (!key) return false;
  const raw = (process.env.DADATA_PARTY_LOOKUP_ENABLED ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

function readJsonBodyFromUnknown(body: unknown, rawString?: string): unknown {
  if (body !== undefined && body !== null) {
    if (typeof body === "string") {
      try {
        return JSON.parse(body) as unknown;
      } catch {
        return undefined;
      }
    }
    return body;
  }
  if (rawString && rawString.trim()) {
    try {
      return JSON.parse(rawString) as unknown;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function parsePartyFindBody(raw: unknown): { ok: true; inn: string } | { ok: false; message: string } {
  const body = raw != null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const qRaw = body.query ?? body.inn;
  const digits = typeof qRaw === "string" ? qRaw.replace(/\D/g, "") : "";
  if (!digits) return { ok: false, message: "Укажите ИНН в поле query." };
  if (digits.length !== 10 && digits.length !== 12) {
    return { ok: false, message: "ИНН должен содержать 10 или 12 цифр." };
  }
  return { ok: true, inn: digits };
}

function partyLegalAddress(data: Record<string, unknown>): string {
  const addr = data.address;
  if (addr != null && typeof addr === "object" && !Array.isArray(addr)) {
    const a = addr as Record<string, unknown>;
    const u = str(a.unrestricted_value).trim();
    if (u) return u;
    const v = str(a.value).trim();
    if (v) return v;
  }
  return str(data.address_value).trim() || str(data.address_unrestricted).trim();
}

function partyName(data: Record<string, unknown>): string {
  const name = data.name;
  if (name != null && typeof name === "object" && !Array.isArray(name)) {
    const n = name as Record<string, unknown>;
    return str(n.full_with_opf).trim() || str(n.short_with_opf).trim() || str(n.full).trim() || str(n.short).trim();
  }
  return str(data.name).trim();
}

async function fetchDadataPartyByInn(
  inn: string,
  apiKey: string,
): Promise<{ ok: true; items: DadataPartyLookupItem[] } | { ok: false; status: number; message: string }> {
  const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party", {
    method: "POST",
    headers: {
      "Content-Type": JSON_CT,
      Accept: JSON_CT,
      Authorization: `Token ${apiKey}`,
    },
    body: JSON.stringify({ query: inn }),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, status: 502, message: "Не удалось разобрать ответ DaData." };
  }
  if (!res.ok) {
    const msg =
      parsed != null && typeof parsed === "object" && "message" in parsed
        ? str((parsed as Record<string, unknown>).message)
        : `DaData вернула статус ${res.status}.`;
    return { ok: false, status: res.status >= 500 ? 502 : 400, message: msg || "Ошибка запроса к DaData." };
  }
  const root = parsed != null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const suggestions = Array.isArray(root.suggestions) ? root.suggestions : [];
  const items: DadataPartyLookupItem[] = [];
  let i = 0;
  for (const el of suggestions) {
    if (el == null || typeof el !== "object" || Array.isArray(el)) continue;
    const s = el as Record<string, unknown>;
    const data =
      s.data != null && typeof s.data === "object" && !Array.isArray(s.data) ? (s.data as Record<string, unknown>) : {};
    const name = partyName(data);
    const innStr = str(data.inn).replace(/\D/g, "") || inn;
    if (!name && !innStr) continue;
    const legal = partyLegalAddress(data);
    items.push({
      id: `dadata-party-${i++}`,
      name: name || `ИНН ${innStr}`,
      inn: innStr,
      kpp: str(data.kpp).trim() || undefined,
      ogrn: str(data.ogrn).trim() || str(data.ogrnip).trim() || undefined,
      legalAddress: legal || undefined,
      source: "DaData (ЕГРЮЛ)",
    });
  }
  return { ok: true, items };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, message: "Используйте POST." });
      return;
    }
    const raw = readJsonBodyFromUnknown(req.body, typeof req.body === "string" ? req.body : undefined);
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
}
