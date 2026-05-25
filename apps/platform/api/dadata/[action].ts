/**
 * Vercel Serverless: POST /api/dadata/:action
 *
 * Catch-all handler для DaData (address-suggest + party-find-by-inn).
 * Объединение в один файл — обход лимита Vercel Hobby 12-функций.
 *
 * Полностью self-contained: только типы `@vercel/node` и глобальный `fetch`.
 * Без импортов из `server/`, `shared/`, client — Vercel-tracing/bundler не должен
 * подтягивать пути проекта на этапе загрузки функции, иначе получим
 * `FUNCTION_INVOCATION_FAILED` ещё до возврата JSON.
 *
 * Express-дев-роуты (`server/dadata-routes.ts`) продолжают использовать
 * общий модуль `shared/dadata-handlers.ts`; здесь логика дублируется намеренно.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";

// ---------- shared helpers ----------

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

function pickAction(req: VercelRequest): string {
  const a = req.query?.action;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (Array.isArray(a) && typeof a[0] === "string") return a[0].trim();
  return "";
}

// ---------- address-suggest ----------

type DadataAddressSuggestItem = {
  value: string;
  unrestrictedValue: string;
  postalCode: string;
  region: string;
  city: string;
  street: string;
  house: string;
  fiasId: string;
  kladrId: string;
  geoLat: string;
  geoLon: string;
  source: "dadata";
};

function isDadataAddressSuggestEnabled(): boolean {
  const key = getDadataApiKey();
  if (!key) return false;
  const raw = (process.env.DADATA_ADDRESS_SUGGEST_ENABLED ?? "").trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  return true;
}

function parseAddressSuggestBody(
  raw: unknown,
): { ok: true; query: string; count: number } | { ok: false; message: string } {
  const body = raw != null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const qRaw = body.query;
  const query = typeof qRaw === "string" ? qRaw.trim() : "";
  if (query.length < 3) {
    return { ok: false, message: "Поле query должно содержать не менее 3 символов после обрезки пробелов." };
  }
  let count = 5;
  if (body.count !== undefined && body.count !== null) {
    const n = typeof body.count === "number" ? body.count : Number(body.count);
    if (!Number.isFinite(n) || n < 1 || n > 10 || !Number.isInteger(n)) {
      return { ok: false, message: "Поле count должно быть целым числом от 1 до 10." };
    }
    count = n;
  }
  return { ok: true, query, count };
}

function mapAddressSuggestion(s: Record<string, unknown>): DadataAddressSuggestItem {
  const data =
    s.data != null && typeof s.data === "object" && !Array.isArray(s.data) ? (s.data as Record<string, unknown>) : {};
  const value = str(s.value) || str(s.unrestricted_value);
  const unrestricted = str(s.unrestricted_value) || str(s.value);
  return {
    value: value || unrestricted,
    unrestrictedValue: unrestricted || value,
    postalCode: str(data.postal_code),
    region: str(data.region_with_type) || str(data.region),
    city: str(data.city_with_type) || str(data.settlement_with_type) || str(data.city) || str(data.settlement),
    street: str(data.street_with_type) || str(data.street),
    house: str(data.house) || [str(data.house_type), str(data.house)].filter(Boolean).join(" ").trim(),
    fiasId: str(data.fias_id) || str(data.fias_code),
    kladrId: str(data.kladr_id),
    geoLat: str(data.geo_lat),
    geoLon: str(data.geo_lon),
    source: "dadata",
  };
}

async function fetchDadataAddressSuggestions(
  query: string,
  count: number,
  apiKey: string,
): Promise<{ ok: true; items: DadataAddressSuggestItem[] } | { ok: false; status: number; message: string }> {
  const res = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
    method: "POST",
    headers: {
      "Content-Type": JSON_CT,
      Accept: JSON_CT,
      Authorization: `Token ${apiKey}`,
    },
    body: JSON.stringify({ query, count }),
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
  const items: DadataAddressSuggestItem[] = [];
  for (const el of suggestions) {
    if (el != null && typeof el === "object" && !Array.isArray(el)) {
      items.push(mapAddressSuggestion(el as Record<string, unknown>));
    }
  }
  return { ok: true, items };
}

async function handleAddressSuggest(req: VercelRequest, res: VercelResponse): Promise<void> {
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
}

// ---------- party-find-by-inn ----------

type DadataPartyLookupItem = {
  id: string;
  name: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  legalAddress?: string;
  source: string;
};

function isDadataPartyLookupEnabled(): boolean {
  const key = getDadataApiKey();
  if (!key) return false;
  const raw = (process.env.DADATA_PARTY_LOOKUP_ENABLED ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
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

async function handlePartyFindByInn(req: VercelRequest, res: VercelResponse): Promise<void> {
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
}

// ---------- entry ----------

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = pickAction(req);
  try {
    if (action === "address-suggest") {
      await handleAddressSuggest(req, res);
      return;
    }
    if (action === "party-find-by-inn") {
      await handlePartyFindByInn(req, res);
      return;
    }
    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный маршрут DaData API.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/dadata]", action, m.slice(0, 200));
    try {
      if (!res.headersSent && !res.writableEnded) {
        sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      }
    } catch {
      /* ignore */
    }
  }
}
