/**
 * Bitrix24 OAuth token exchange / refresh и REST-вызовы с access_token.
 * Не логирует code, access_token, refresh_token, client_secret.
 */

type TokenOk = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

function strEnv(name: string): string {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

export function normalizePortalBase(raw: string): string {
  let t = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(t)) {
    t = `https://${t}`;
  }
  return t;
}

/** Bitrix24 cloud: token на oauth.bitrix.info; on-prem можно переопределить BITRIX24_OAUTH_TOKEN_URL. */
export function resolveTokenEndpoint(): string {
  const u = strEnv("BITRIX24_OAUTH_TOKEN_URL");
  if (u) return u.replace(/\/+$/, "");
  return "https://oauth.bitrix.info/oauth/token";
}

export const DEFAULT_OAUTH_REDIRECT_URI = "https://tandoor-platform.vercel.app/api/bitrix24/oauth/callback";

export function resolveRedirectUri(): string {
  const u = strEnv("BITRIX24_OAUTH_REDIRECT_URI");
  return u || DEFAULT_OAUTH_REDIRECT_URI;
}

export async function exchangeAuthorizationCode(code: string): Promise<
  | { ok: true; tokens: TokenOk }
  | { ok: false; status: number; code: string; message: string }
> {
  const clientId = strEnv("BITRIX24_OAUTH_CLIENT_ID");
  const clientSecret = strEnv("BITRIX24_OAUTH_CLIENT_SECRET");
  const redirectUri = resolveRedirectUri();
  const tokenUrl = resolveTokenEndpoint();
  if (!clientId || !clientSecret) {
    return { ok: false, status: 503, code: "BITRIX24_OAUTH_NOT_CONFIGURED", message: "OAuth Bitrix24 не настроен на сервере." };
  }
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  let json: unknown;
  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    const text = await res.text();
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return {
        ok: false,
        status: 502,
        code: "BITRIX24_OAUTH_TOKEN_ERROR",
        message: "Bitrix24 вернул неожиданный ответ при обмене кода авторизации.",
      };
    }
  } catch {
    return {
      ok: false,
      status: 502,
      code: "BITRIX24_OAUTH_NETWORK",
      message: "Не удалось связаться с сервером авторизации Bitrix24.",
    };
  }

  const o = json as Record<string, unknown>;
  if (typeof o.access_token === "string" && o.access_token && typeof o.refresh_token === "string" && o.refresh_token) {
    const expires_in = typeof o.expires_in === "number" && Number.isFinite(o.expires_in) ? o.expires_in : 3600;
    return { ok: true, tokens: { access_token: o.access_token, refresh_token: o.refresh_token, expires_in } };
  }
  const err = typeof o.error === "string" ? o.error : "unknown";
  console.error("[bitrix24] oauth token exchange failed", { err });
  return {
    ok: false,
    status: 400,
    code: "BITRIX24_OAUTH_CODE_EXCHANGE_FAILED",
    message: "Не удалось обменять код авторизации Bitrix24. Попробуйте подключить Bitrix24 заново.",
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<
  | { ok: true; tokens: TokenOk }
  | { ok: false; status: number; code: string; message: string }
> {
  const clientId = strEnv("BITRIX24_OAUTH_CLIENT_ID");
  const clientSecret = strEnv("BITRIX24_OAUTH_CLIENT_SECRET");
  const tokenUrl = resolveTokenEndpoint();
  if (!clientId || !clientSecret) {
    return { ok: false, status: 503, code: "BITRIX24_OAUTH_NOT_CONFIGURED", message: "OAuth Bitrix24 не настроен на сервере." };
  }
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("refresh_token", refreshToken);

  let json: unknown;
  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    const text = await res.text();
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return {
        ok: false,
        status: 502,
        code: "BITRIX24_OAUTH_TOKEN_ERROR",
        message: "Bitrix24 вернул неожиданный ответ при обновлении токена.",
      };
    }
  } catch {
    return {
      ok: false,
      status: 502,
      code: "BITRIX24_OAUTH_NETWORK",
      message: "Не удалось связаться с сервером авторизации Bitrix24.",
    };
  }

  const o = json as Record<string, unknown>;
  if (typeof o.access_token === "string" && o.access_token) {
    const rt = typeof o.refresh_token === "string" && o.refresh_token ? o.refresh_token : refreshToken;
    const expires_in = typeof o.expires_in === "number" && Number.isFinite(o.expires_in) ? o.expires_in : 3600;
    return { ok: true, tokens: { access_token: o.access_token, refresh_token: rt, expires_in } };
  }
  const err = typeof o.error === "string" ? o.error : "unknown";
  console.error("[bitrix24] oauth refresh failed", { err });
  return {
    ok: false,
    status: 401,
    code: "BITRIX24_OAUTH_EXPIRED",
    message: "Сессия Bitrix24 истекла. Подключите Bitrix24 заново.",
  };
}

type BitrixSuccess = { result?: unknown };
type BitrixErrorBody = { error?: string };

export async function bitrixOAuthRest(
  portalBase: string,
  method: string,
  accessToken: string,
  jsonBody: Record<string, unknown>,
): Promise<{ ok: true; result: unknown } | { ok: false; bitrixCode?: string; message: string }> {
  const base = normalizePortalBase(portalBase);
  const url = `${base}/rest/${method}?auth=${encodeURIComponent(accessToken)}`;
  let parsed: unknown;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(jsonBody),
    });
    const text = await res.text();
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, message: "Bitrix24 вернул неожиданный ответ REST." };
    }
  } catch {
    return { ok: false, message: "Не удалось связаться с Bitrix24." };
  }
  const b = parsed as BitrixSuccess & BitrixErrorBody;
  if (b.error) {
    const bitrixCode = typeof b.error === "string" ? b.error : "UNKNOWN";
    console.error("[bitrix24] oauth rest error", { method, bitrixCode });
    return {
      ok: false,
      bitrixCode,
      message: "Запрос к Bitrix24 отклонён. Попробуйте позже или переподключите Bitrix24.",
    };
  }
  return { ok: true, result: b.result };
}

export async function fetchBitrixUserCurrent(
  portalBase: string,
  accessToken: string,
): Promise<{ bitrixUserId?: string; name?: string }> {
  const r = await bitrixOAuthRest(portalBase, "user.current", accessToken, {});
  if (!r.ok) return {};
  const res = r.result;
  if (res == null || typeof res !== "object" || Array.isArray(res)) return {};
  const u = res as Record<string, unknown>;
  const id = u.ID ?? u.id;
  const name = u.NAME ?? u.name;
  const last = u.LAST_NAME ?? u.last_name;
  const bitrixUserId = id != null ? String(id).trim() : undefined;
  const namePart = typeof name === "string" ? name.trim() : "";
  const lastPart = typeof last === "string" ? last.trim() : "";
  const full = [namePart, lastPart].filter(Boolean).join(" ").trim();
  return { bitrixUserId, name: full || undefined };
}
