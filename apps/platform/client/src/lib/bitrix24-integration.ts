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
type CreateTestTaskApiErr = { success: false; message?: string; code?: string; bitrixCode?: string };

export type Bitrix24LkCreateTaskPayload = {
  title: string;
  description: string;
  dealerId: string;
  dealerName: string;
  tradePointId?: string;
  tradePointName?: string;
  returnUrl?: string;
};

export type Bitrix24LkCreateTaskResult =
  | { ok: true; taskId: string; message: string }
  | { ok: false; message: string; code?: string };

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

/**
 * Создание задачи из карточки дилера/ТТ: POST /api/bitrix24/tasks/create (сервер, без секретов в клиенте).
 */
export async function createBitrix24LkTask(payload: Bitrix24LkCreateTaskPayload): Promise<Bitrix24LkCreateTaskResult> {
  let res: Response;
  try {
    res = await fetch("/api/bitrix24/tasks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
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
    const tid = ok.taskId != null ? String(ok.taskId) : "";
    if (!tid) {
      return { ok: false, message: "Сервер не вернул идентификатор задачи Bitrix24." };
    }
    const message =
      typeof ok.message === "string" && ok.message.trim() ? ok.message.trim() : "Задача создана в Bitrix24";
    return { ok: true, taskId: tid, message };
  }

  const err = body as CreateTestTaskApiErr;
  const message =
    typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : "Не удалось создать задачу в Bitrix24. Обратитесь к администратору.";
  return { ok: false, message, code: typeof err.code === "string" ? err.code : undefined };
}

export type Bitrix24ListedTaskDto = {
  bitrixTaskId: string;
  title: string;
  description: string;
  status: string;
  responsibleId: string;
  createdBy: string;
  createdDate: string;
  deadline: string | null;
  changedDate: string | null;
};

type ListTasksApiOk = { success: true; tasks?: Bitrix24ListedTaskDto[] };
type ListTasksApiErr = { success: false; message?: string; code?: string; bitrixCode?: string };

/**
 * Список задач из Bitrix24 по ответственному webhook: POST /api/bitrix24/tasks/list.
 */
export async function listBitrix24Tasks(options?: {
  limit?: number;
  onlyOpen?: boolean;
}): Promise<{ ok: true; tasks: Bitrix24ListedTaskDto[] } | { ok: false; message: string; code?: string }> {
  const payload: Record<string, unknown> = {};
  if (options?.limit != null) payload.limit = options.limit;
  if (options?.onlyOpen != null) payload.onlyOpen = options.onlyOpen;

  let res: Response;
  try {
    res = await fetch("/api/bitrix24/tasks/list", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова." };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "Сервер вернул неожиданный ответ при загрузке задач." };
  }

  const body = data as ListTasksApiOk | ListTasksApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as ListTasksApiOk;
    const raw = Array.isArray(ok.tasks) ? ok.tasks : [];
    const tasks: Bitrix24ListedTaskDto[] = raw.map((row: unknown) => {
      const t = row as Record<string, unknown>;
      const deadline = t.deadline;
      const changedDate = t.changedDate;
      return {
        bitrixTaskId: String(t.bitrixTaskId ?? ""),
        title: String(t.title ?? ""),
        description: String(t.description ?? ""),
        status: String(t.status ?? ""),
        responsibleId: String(t.responsibleId ?? ""),
        createdBy: String(t.createdBy ?? ""),
        createdDate: String(t.createdDate ?? ""),
        deadline: deadline == null || deadline === "" ? null : String(deadline),
        changedDate: changedDate == null || changedDate === "" ? null : String(changedDate),
      };
    });
    return { ok: true, tasks };
  }

  const err = body as ListTasksApiErr;
  const message =
    typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : "Не удалось загрузить задачи из Bitrix24.";
  return { ok: false, message, code: typeof err.code === "string" ? err.code : undefined };
}
