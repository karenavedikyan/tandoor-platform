/**
 * POST /api/bitrix24/users/list для Express (Node).
 * Логика продублирована из api/bitrix24/users/list.ts — без импортов из api/.
 */

export type Bitrix24UsersListHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

const DEFAULT_LIMIT = 50;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const BITRIX_PAGE = 50;
const MAX_PAGES_SEARCH = 40;

type BitrixSuccess = { result: unknown };
type BitrixErrorBody = { error?: string; error_description?: string };

type BitrixUserOut = {
  bitrixUserId: string;
  name: string;
  lastName: string;
  fullName: string;
  email: string | null;
  workPosition: string | null;
  active: boolean | null;
};

function parseWebhookBase(raw: string | undefined): { ok: true; base: string } | { ok: false; message: string } {
  if (raw == null || !String(raw).trim()) {
    return { ok: false, message: "Пустое значение BITRIX24_WEBHOOK_URL." };
  }
  let t = String(raw).trim();
  if (/profile\.json/i.test(t)) {
    return {
      ok: false,
      message:
        "В BITRIX24_WEBHOOK_URL указан не базовый webhook (обнаружен profile.json). Укажите базовый URL вида https://<портал>/rest/<user>/<token>/ без имени метода.",
    };
  }
  t = t.replace(/\/tasks\.task\.(add|list)\/?$/i, "");
  t = t.replace(/\/user\.get\/?$/i, "");
  t = t.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(t)) {
    return { ok: false, message: "BITRIX24_WEBHOOK_URL должен начинаться с http:// или https://." };
  }
  if (!/\/rest\//i.test(t)) {
    return {
      ok: false,
      message: "BITRIX24_WEBHOOK_URL должен содержать сегмент /rest/ (базовый входящий webhook Bitrix24).",
    };
  }
  return { ok: true, base: t };
}

function buildUserGetUrl(webhookBase: string): string {
  return `${webhookBase}/user.get`;
}

function validateUsersListBody(raw: unknown): { ok: true; search: string | null; limit: number } | { ok: false; message: string } {
  if (raw == null || raw === "") {
    return { ok: true, search: null, limit: DEFAULT_LIMIT };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Ожидается JSON-объект в теле запроса." };
  }
  const o = raw as Record<string, unknown>;
  let search: string | null = null;
  if (Object.prototype.hasOwnProperty.call(o, "search")) {
    const sv = o.search;
    if (sv == null) {
      search = null;
    } else if (typeof sv !== "string") {
      return { ok: false, message: "Поле search должно быть строкой или отсутствовать." };
    } else {
      const t = sv.trim();
      search = t.length ? t : null;
    }
  }
  let limit = DEFAULT_LIMIT;
  if (Object.prototype.hasOwnProperty.call(o, "limit")) {
    const lv = o.limit;
    const n = typeof lv === "number" ? lv : typeof lv === "string" ? Number.parseInt(String(lv).trim(), 10) : NaN;
    if (!Number.isFinite(n) || n < MIN_LIMIT || n > MAX_LIMIT) {
      return { ok: false, message: `Поле limit должно быть числом от ${MIN_LIMIT} до ${MAX_LIMIT}.` };
    }
    limit = Math.floor(n);
  }
  return { ok: true, search, limit };
}

function strOf(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function nullIfEmpty(s: string): string | null {
  return s.length ? s : null;
}

function parseActive(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (v === "Y" || v === "y" || v === 1 || v === "1") return true;
  if (v === "N" || v === "n" || v === 0 || v === "0") return false;
  if (v == null || v === "") return null;
  return null;
}

function mapBitrixUserRow(raw: unknown): BitrixUserOut | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const bitrixUserId = strOf(o.ID ?? o.id);
  if (!bitrixUserId) return null;
  const name = strOf(o.NAME ?? o.name);
  const lastName = strOf(o.LAST_NAME ?? o.lastName);
  const emailRaw = strOf(o.EMAIL ?? o.email);
  const workRaw = strOf(o.WORK_POSITION ?? o.workPosition);
  const parts = [name, lastName].filter((p) => p.length > 0);
  const fullName = parts.join(" ").trim() || bitrixUserId;
  return {
    bitrixUserId,
    name,
    lastName,
    email: nullIfEmpty(emailRaw),
    workPosition: nullIfEmpty(workRaw),
    fullName,
    active: parseActive(o.ACTIVE ?? o.active),
  };
}

function extractUsersArray(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result == null || typeof result !== "object" || Array.isArray(result)) return [];
  const r = result as Record<string, unknown>;
  const users = r.users ?? r.USERS;
  return Array.isArray(users) ? users : [];
}

function userMatchesSearch(u: BitrixUserOut, needle: string): boolean {
  const n = needle.toLowerCase();
  const hay = [u.name, u.lastName, u.fullName, u.email ?? ""].join(" ").toLowerCase();
  return hay.includes(n);
}

async function fetchUserGetPage(
  url: string,
  start: number,
): Promise<{ ok: true; rows: unknown[] } | { ok: false; kind: "network" } | { ok: false; kind: "bad_json" } | { ok: false; kind: "bitrix"; bitrixCode: string }> {
  const payload = {
    filter: {},
    select: ["ID", "NAME", "LAST_NAME", "EMAIL", "WORK_POSITION", "ACTIVE"],
    start,
  };
  let bitrixJson: BitrixSuccess & BitrixErrorBody;
  try {
    const bxRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await bxRes.text();
    try {
      bitrixJson = JSON.parse(text) as BitrixSuccess & BitrixErrorBody;
    } catch {
      console.error("[bitrix24] users/list bitrix non-json", "http", bxRes.status);
      return { ok: false, kind: "bad_json" };
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "unknown";
    console.error("[bitrix24] users/list bitrix network", m);
    return { ok: false, kind: "network" };
  }

  if (bitrixJson.error) {
    const bitrixCode = typeof bitrixJson.error === "string" ? bitrixJson.error : "UNKNOWN";
    console.error("[bitrix24] users/list bitrix api error", { bitrixCode });
    return { ok: false, kind: "bitrix", bitrixCode };
  }

  const rows = extractUsersArray(bitrixJson.result);
  return { ok: true, rows };
}

export async function runBitrix24UsersList(rawBody: unknown): Promise<Bitrix24UsersListHttpResult> {
  const validated = validateUsersListBody(rawBody ?? {});
  if (!validated.ok) {
    return {
      status: 400,
      body: { success: false, code: "BITRIX24_USERS_VALIDATION_ERROR", message: validated.message },
    };
  }

  const webhookRaw = process.env.BITRIX24_WEBHOOK_URL;
  if (!webhookRaw || !String(webhookRaw).trim()) {
    return {
      status: 503,
      body: {
        success: false,
        code: "BITRIX24_NOT_CONFIGURED",
        message: "Запрос к Bitrix24 недоступен: на сервере не задана переменная окружения BITRIX24_WEBHOOK_URL.",
      },
    };
  }

  const parsed = parseWebhookBase(webhookRaw);
  if (!parsed.ok) {
    return {
      status: 400,
      body: { success: false, code: "BITRIX24_WEBHOOK_URL_INVALID", message: parsed.message },
    };
  }

  const url = buildUserGetUrl(parsed.base);
  const collected: BitrixUserOut[] = [];
  let start = 0;
  let pages = 0;

  const maxPages = validated.search ? MAX_PAGES_SEARCH : Math.ceil(validated.limit / BITRIX_PAGE);

  while (collected.length < validated.limit && pages < maxPages) {
    const page = await fetchUserGetPage(url, start);
    if (!page.ok) {
      if (page.kind === "bitrix") {
        return {
          status: 502,
          body: {
            success: false,
            code: "BITRIX24_API_ERROR",
            bitrixCode: page.bitrixCode,
            message: "Bitrix24 не принял запрос user.get. Проверьте права webhook (доступ к пользователям) и URL.",
          },
        };
      }
      if (page.kind === "bad_json") {
        return {
          status: 502,
          body: {
            success: false,
            code: "BITRIX24_BAD_RESPONSE",
            message: "Bitrix24 вернул неожиданный ответ. Попробуйте позже или проверьте URL webhook.",
          },
        };
      }
      return {
        status: 502,
        body: {
          success: false,
          code: "BITRIX24_NETWORK",
          message: "Не удалось связаться с Bitrix24. Проверьте сеть и доступность портала.",
        },
      };
    }

    pages += 1;
    if (page.rows.length === 0) break;

    for (const row of page.rows) {
      const m = mapBitrixUserRow(row);
      if (!m) continue;
      if (validated.search && !userMatchesSearch(m, validated.search)) continue;
      collected.push(m);
      if (collected.length >= validated.limit) break;
    }

    if (page.rows.length < BITRIX_PAGE) break;
    start += BITRIX_PAGE;
  }

  return {
    status: 200,
    body: {
      success: true,
      users: collected.slice(0, validated.limit),
    },
  };
}
