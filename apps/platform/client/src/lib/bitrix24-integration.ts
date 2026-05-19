import { useMemo } from "react";
import { useLocation } from "wouter";
import { buildBrowserHashAppHref, readRouteQuery, useRouteSearchParams } from "@/lib/hash-route-utils";

/** Состояние интеграции с Bitrix24 (без реальных секретов и ключей в коде). */
export type Bitrix24IntegrationStatus = "inactive" | "mock_ready" | "awaiting_webhook";

export type Bitrix24TaskDraftPayload = {
  title: string;
  description?: string;
  /** Произвольные поля для будущего webhook (без PII в проде). */
  metadata?: Record<string, string>;
};

export type Bitrix24TaskDraftResult = {
  ok: true;
  draftId: string;
  message: string;
};

export type Bitrix24UrlContext = {
  embedded: boolean;
  /** Часто передаётся Bitrix24 при встраивании (если есть в URL). */
  portalDomain: string | null;
  rawQuery: Record<string, string>;
};

function mergeHashQueryInto(search: URLSearchParams): void {
  if (typeof window === "undefined") return;
  const hash = window.location.hash;
  const q = hash.indexOf("?");
  if (q < 0) return;
  const hp = new URLSearchParams(hash.slice(q + 1));
  hp.forEach((v, k) => {
    if (!search.has(k)) search.set(k, v);
  });
}

/** Текущий URL считается «встроенным Bitrix24», если есть `embedded=bitrix24` (в search до `#` или в query хэша). */
export function isBitrix24Embedded(): boolean {
  return getBitrix24ContextFromUrl().embedded;
}

/** Реактивный флаг для оболочки приложения (hash-router + query до `#`). */
export function useBitrix24EmbeddedFlag(): boolean {
  const [loc] = useLocation();
  const routeQs = useRouteSearchParams();
  return useMemo(() => getBitrix24ContextFromUrl().embedded, [loc, routeQs]);
}

export function getBitrix24ContextFromUrl(): Bitrix24UrlContext {
  const search = readRouteQuery();
  mergeHashQueryInto(search);
  const embedded = search.get("embedded") === "bitrix24";
  const portalDomain = search.get("DOMAIN") ?? search.get("domain") ?? null;
  const rawQuery = Object.fromEntries(search.entries());
  return { embedded, portalDomain, rawQuery };
}

/**
 * Полный URL для вставки в Bitrix24 (кнопка/меню приложения): открывает ЛК с маркером встраивания.
 * Ключи и webhook не включаются — только публичный относительный путь приложения.
 */
export function buildBitrix24OpenTandoorUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return buildBrowserHashAppHref(clean, { embedded: "bitrix24" });
  }
  const relative = buildBrowserHashAppHref(clean, { embedded: "bitrix24" });
  return new URL(relative, window.location.origin).href;
}

/** Заглушка: имитация создания задачи в Bitrix24 без сетевого запроса. */
export async function createBitrix24TaskDraft(payload: Bitrix24TaskDraftPayload): Promise<Bitrix24TaskDraftResult> {
  const draftId = `b24-draft-${Date.now().toString(36)}`;
  void payload;
  await Promise.resolve();
  return {
    ok: true,
    draftId,
    message: "Заготовка задачи создана. Для реальной отправки нужен тестовый webhook Bitrix24.",
  };
}
