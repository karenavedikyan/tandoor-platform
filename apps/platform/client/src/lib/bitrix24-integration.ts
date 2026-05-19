import { useMemo } from "react";
import { useLocation } from "wouter";
import { buildBrowserHashAppHref, readRouteQuery, useRouteSearchParams } from "@/lib/hash-route-utils";

/** Состояние интеграции с Bitrix24 (без секретов в клиенте). */
export type Bitrix24IntegrationStatus = "inactive" | "backend_ready" | "awaiting_webhook";

export type Bitrix24TaskDraftPayload = {
  title: string;
  description?: string;
  /** Произвольные поля для будущего расширения (сервер POC пока не использует). */
  metadata?: Record<string, string>;
};

export type Bitrix24TaskDraftResult =
  | { ok: true; taskId?: string | number; message: string }
  | { ok: false; message: string };

type CreateTestTaskApiOk = { success: true; taskId?: string | number; message?: string };
type CreateTestTaskApiErr = { success: false; message?: string; code?: string };

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
 * Webhook и секреты не включаются.
 */
export function buildBitrix24OpenTandoorUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return buildBrowserHashAppHref(clean, { embedded: "bitrix24" });
  }
  const relative = buildBrowserHashAppHref(clean, { embedded: "bitrix24" });
  return new URL(relative, window.location.origin).href;
}

/**
 * Создание тестовой задачи через backend (`POST /api/bitrix24/tasks/test`).
 * URL webhook и вызов `tasks.task.add` выполняются только на сервере.
 */
export async function createBitrix24TaskDraft(payload: Bitrix24TaskDraftPayload): Promise<Bitrix24TaskDraftResult> {
  void payload;
  let res: Response;
  try {
    res = await fetch("/api/bitrix24/tasks/test", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: "{}",
    });
  } catch {
    return {
      ok: false,
      message: "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "Сервер вернул неожиданный ответ при создании задачи." };
  }

  const body = data as CreateTestTaskApiOk | CreateTestTaskApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as CreateTestTaskApiOk;
    const message = typeof ok.message === "string" && ok.message.trim() ? ok.message : "Тестовая задача создана в Bitrix24";
    return { ok: true, taskId: ok.taskId, message };
  }

  const err = body as CreateTestTaskApiErr;
  const message =
    typeof err.message === "string" && err.message.trim()
      ? err.message
      : "Не удалось создать задачу в Bitrix24. Обратитесь к администратору.";
  return { ok: false, message };
}
