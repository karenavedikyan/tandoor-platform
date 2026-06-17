import { useMemo } from "react";
import { useLocation } from "wouter";
import { buildBrowserHashAppHref, readRouteQuery, useRouteSearchParams } from "./hash-route-utils.js";

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
  /** Положительный ID ответственного в Bitrix24 (опционально; иначе серверный fallback). */
  responsibleId?: string | number;
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
  const requestBody: Record<string, unknown> = {
    title: payload.title,
    description: payload.description,
    dealerId: payload.dealerId,
    dealerName: payload.dealerName,
  };
  if (payload.tradePointId != null) requestBody.tradePointId = payload.tradePointId;
  if (payload.tradePointName != null) requestBody.tradePointName = payload.tradePointName;
  if (payload.returnUrl != null) requestBody.returnUrl = payload.returnUrl;
  if (payload.responsibleId != null) requestBody.responsibleId = payload.responsibleId;

  let res: Response;
  try {
    res = await fetch("/api/bitrix24/tasks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(requestBody),
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
  responsibleId?: string | number;
}): Promise<{ ok: true; tasks: Bitrix24ListedTaskDto[] } | { ok: false; message: string; code?: string }> {
  const payload: Record<string, unknown> = {};
  if (options?.limit != null) payload.limit = options.limit;
  if (options?.onlyOpen != null) payload.onlyOpen = options.onlyOpen;
  if (options?.responsibleId != null) payload.responsibleId = options.responsibleId;

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

export type Bitrix24ListedUserDto = {
  bitrixUserId: string;
  name: string;
  lastName: string;
  fullName: string;
  email: string | null;
  workPosition: string | null;
  active: boolean | null;
};

type ListUsersApiOk = { success: true; users?: Bitrix24ListedUserDto[] };
type ListUsersApiErr = { success: false; message?: string; code?: string; bitrixCode?: string };

/**
 * Список пользователей Bitrix24 (диагностика, user.get): POST /api/bitrix24/users/list.
 */
export async function listBitrix24Users(options?: {
  search?: string;
  limit?: number;
}): Promise<{ ok: true; users: Bitrix24ListedUserDto[] } | { ok: false; message: string; code?: string }> {
  const payload: Record<string, unknown> = {};
  if (options?.search != null && options.search.trim()) payload.search = options.search.trim();
  if (options?.limit != null) payload.limit = options.limit;

  let res: Response;
  try {
    res = await fetch("/api/bitrix24/users/list", {
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
    return { ok: false, message: "Сервер вернул неожиданный ответ при загрузке пользователей Bitrix24." };
  }

  const body = data as ListUsersApiOk | ListUsersApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as ListUsersApiOk;
    const raw = Array.isArray(ok.users) ? ok.users : [];
    const users: Bitrix24ListedUserDto[] = raw.map((row: unknown) => {
      const u = row as Record<string, unknown>;
      const email = u.email;
      const workPosition = u.workPosition;
      const activeRaw = u.active;
      const activeParsed: boolean | null =
        activeRaw === true || activeRaw === false
          ? activeRaw
          : activeRaw === "Y" || activeRaw === "y"
            ? true
            : activeRaw === "N" || activeRaw === "n"
              ? false
              : null;
      return {
        bitrixUserId: String(u.bitrixUserId ?? ""),
        name: String(u.name ?? ""),
        lastName: String(u.lastName ?? ""),
        fullName: String(u.fullName ?? ""),
        email: email == null || email === "" ? null : String(email),
        workPosition: workPosition == null || workPosition === "" ? null : String(workPosition),
        active: activeParsed,
      };
    });
    return { ok: true, users };
  }

  const err = body as ListUsersApiErr;
  const message =
    typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : "Не удалось загрузить пользователей из Bitrix24.";
  return { ok: false, message, code: typeof err.code === "string" ? err.code : undefined };
}

export type Bitrix24ChatDiagnosticRowDto = {
  method: string;
  success: boolean;
  bitrixCode?: string;
  message: string;
  sample?: unknown;
};

type ChatDiagApiOk = { success: true; diagnostics?: Bitrix24ChatDiagnosticRowDto[] };
type ChatDiagApiErr = { success: false; message?: string; code?: string };

/**
 * Диагностика REST im.* (чаты/уведомления): POST /api/bitrix24/chat/diagnostics.
 */
export async function runBitrix24ChatDiagnostics(input: {
  dialogId?: string;
  message?: string;
  testNotify?: boolean;
}): Promise<
  { ok: true; diagnostics: Bitrix24ChatDiagnosticRowDto[] } | { ok: false; message: string; code?: string }
> {
  const payload: Record<string, unknown> = {};
  if (input.dialogId != null && String(input.dialogId).trim()) payload.dialogId = String(input.dialogId).trim();
  if (input.message != null && input.message.trim()) payload.message = input.message.trim();
  if (input.testNotify === true) payload.testNotify = true;

  let res: Response;
  try {
    res = await fetch("/api/bitrix24/chat/diagnostics", {
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
    return { ok: false, message: "Сервер вернул неожиданный ответ при диагностике чатов Bitrix24." };
  }

  const body = data as ChatDiagApiOk | ChatDiagApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as ChatDiagApiOk;
    const raw = Array.isArray(ok.diagnostics) ? ok.diagnostics : [];
    const diagnostics: Bitrix24ChatDiagnosticRowDto[] = raw.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        method: String(r.method ?? ""),
        success: r.success === true,
        bitrixCode: typeof r.bitrixCode === "string" ? r.bitrixCode : undefined,
        message: typeof r.message === "string" ? r.message : "",
        sample: "sample" in r ? r.sample : undefined,
      };
    });
    return { ok: true, diagnostics };
  }

  const err = body as ChatDiagApiErr;
  const message =
    typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : "Диагностика чатов Bitrix24 недоступна.";
  return { ok: false, message, code: typeof err.code === "string" ? err.code : undefined };
}

export type Bitrix24RecentChatDto = {
  dialogId: string;
  chatId?: number;
  title: string;
  lastMessageText?: string;
  lastMessageDate?: string;
  unread?: boolean;
  counter?: number;
  type?: string;
  entityType?: string;
  entityId?: string;
};

export type Bitrix24ChatMessageDto = {
  id: number | string;
  authorId?: number;
  text: string;
  date?: string;
  unread?: boolean;
};

type ChatRecentApiOk = { success: true; chats?: Bitrix24RecentChatDto[] };
type ChatRecentApiErr = { success: false; message?: string; code?: string; bitrixCode?: string };

type ChatMessagesApiOk = { success: true; dialogId?: string; messages?: Bitrix24ChatMessageDto[] };
type ChatMessagesApiErr = { success: false; message?: string; code?: string; bitrixCode?: string };

type ChatSendApiOk = { success: true; messageId?: string | number };
type ChatSendApiErr = { success: false; message?: string; code?: string; bitrixCode?: string };

function humanizeBitrixChatApiFailure(err: ChatRecentApiErr | ChatMessagesApiErr | ChatSendApiErr): string {
  const bitrixCode = typeof err.bitrixCode === "string" ? err.bitrixCode.trim() : "";
  if (bitrixCode && bitrixCode.toLowerCase() === "insufficient_scope") {
    return "Недостаточно прав webhook Bitrix24 для этого действия.";
  }
  const m = typeof err.message === "string" ? err.message.trim() : "";
  return m || "Операция с Bitrix24 недоступна. Обратитесь к администратору.";
}

/**
 * Последние чаты Bitrix24: POST /api/bitrix24/chat/recent (im.recent.get на сервере).
 */
export async function listBitrix24RecentChats(): Promise<
  { ok: true; chats: Bitrix24RecentChatDto[] } | { ok: false; message: string; code?: string; bitrixCode?: string }
> {
  let res: Response;
  try {
    res = await fetch("/api/bitrix24/chat/recent", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: "{}",
    });
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова." };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "Сервер вернул неожиданный ответ при загрузке чатов Bitrix24." };
  }

  const body = data as ChatRecentApiOk | ChatRecentApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as ChatRecentApiOk;
    const raw = Array.isArray(ok.chats) ? ok.chats : [];
    const chats: Bitrix24RecentChatDto[] = raw.map((row: unknown) => {
      const c = row as Record<string, unknown>;
      const out: Bitrix24RecentChatDto = {
        dialogId: String(c.dialogId ?? ""),
        title: String(c.title ?? ""),
      };
      if (typeof c.chatId === "number" && Number.isFinite(c.chatId)) out.chatId = c.chatId;
      if (typeof c.lastMessageText === "string" && c.lastMessageText.trim()) out.lastMessageText = c.lastMessageText.trim();
      if (typeof c.lastMessageDate === "string" && c.lastMessageDate.trim()) out.lastMessageDate = c.lastMessageDate.trim();
      if (typeof c.unread === "boolean") out.unread = c.unread;
      if (typeof c.counter === "number" && Number.isFinite(c.counter)) out.counter = c.counter;
      if (typeof c.type === "string" && c.type.trim()) out.type = c.type.trim();
      if (typeof c.entityType === "string" && c.entityType.trim()) out.entityType = c.entityType.trim();
      if (typeof c.entityId === "string" && c.entityId.trim()) out.entityId = c.entityId.trim();
      return out;
    });
    return { ok: true, chats };
  }

  const err = body as ChatRecentApiErr;
  return {
    ok: false,
    message: humanizeBitrixChatApiFailure(err),
    code: typeof err.code === "string" ? err.code : undefined,
    bitrixCode: typeof err.bitrixCode === "string" ? err.bitrixCode : undefined,
  };
}

/**
 * Сообщения чата Bitrix24: POST /api/bitrix24/chat/messages (im.dialog.messages.get на сервере).
 */
export async function getBitrix24ChatMessages(
  dialogId: string,
  limit?: number,
): Promise<
  | { ok: true; dialogId: string; messages: Bitrix24ChatMessageDto[] }
  | { ok: false; message: string; code?: string; bitrixCode?: string }
> {
  const trimmed = String(dialogId ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: "Не указан идентификатор диалога Bitrix24." };
  }
  const payload: Record<string, unknown> = { dialogId: trimmed };
  if (limit != null) payload.limit = limit;

  let res: Response;
  try {
    res = await fetch("/api/bitrix24/chat/messages", {
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
    return { ok: false, message: "Сервер вернул неожиданный ответ при загрузке сообщений Bitrix24." };
  }

  const body = data as ChatMessagesApiOk | ChatMessagesApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as ChatMessagesApiOk;
    const did = typeof ok.dialogId === "string" && ok.dialogId.trim() ? ok.dialogId.trim() : trimmed;
    const raw = Array.isArray(ok.messages) ? ok.messages : [];
    const messages: Bitrix24ChatMessageDto[] = raw.map((row: unknown) => {
      const m = row as Record<string, unknown>;
      const idRaw = m.id;
      const id = typeof idRaw === "number" || typeof idRaw === "string" ? idRaw : String(idRaw ?? "");
      const msg: Bitrix24ChatMessageDto = {
        id,
        text: String(m.text ?? ""),
      };
      if (typeof m.authorId === "number" && Number.isFinite(m.authorId)) msg.authorId = m.authorId;
      if (typeof m.date === "string" && m.date.trim()) msg.date = m.date.trim();
      if (typeof m.unread === "boolean") msg.unread = m.unread;
      return msg;
    });
    return { ok: true, dialogId: did, messages };
  }

  const err = body as ChatMessagesApiErr;
  return {
    ok: false,
    message: humanizeBitrixChatApiFailure(err),
    code: typeof err.code === "string" ? err.code : undefined,
    bitrixCode: typeof err.bitrixCode === "string" ? err.bitrixCode : undefined,
  };
}

/**
 * Отправка сообщения в чат Bitrix24: POST /api/bitrix24/chat/send (im.message.add на сервере).
 */
export async function sendBitrix24ChatMessage(
  dialogId: string,
  message: string,
): Promise<{ ok: true; messageId: string | number } | { ok: false; message: string; code?: string; bitrixCode?: string }> {
  const trimmedDialog = String(dialogId ?? "").trim();
  const trimmedMsg = String(message ?? "").trim();
  if (!trimmedDialog) {
    return { ok: false, message: "Не указан идентификатор диалога Bitrix24." };
  }
  if (!trimmedMsg.length) {
    return { ok: false, message: "Введите текст сообщения." };
  }
  if (trimmedMsg.length > 2000) {
    return { ok: false, message: "Сообщение не может быть длиннее 2000 символов." };
  }

  let res: Response;
  try {
    res = await fetch("/api/bitrix24/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ dialogId: trimmedDialog, message: trimmedMsg }),
    });
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова." };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "Сервер вернул неожиданный ответ при отправке сообщения в Bitrix24." };
  }

  const body = data as ChatSendApiOk | ChatSendApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as ChatSendApiOk;
    if (ok.messageId == null) {
      return { ok: false, message: "Сервер не вернул идентификатор сообщения Bitrix24." };
    }
    return { ok: true, messageId: ok.messageId };
  }

  const err = body as ChatSendApiErr;
  return {
    ok: false,
    message: humanizeBitrixChatApiFailure(err),
    code: typeof err.code === "string" ? err.code : undefined,
    bitrixCode: typeof err.bitrixCode === "string" ? err.bitrixCode : undefined,
  };
}

// --- Персональный OAuth Bitrix24 (раздел «Коммуникации»): не использует общий BITRIX24_WEBHOOK_URL для im.* ---

export type Bitrix24OAuthStatusDto = {
  configured: boolean;
  connected: boolean;
  user?: { bitrixUserId?: string; name?: string };
  /** Подсказка с сервера (например, не задан BITRIX24_OAUTH_COOKIE_SECRET). */
  serverHint?: string;
};

type OAuthStatusApiOk = {
  success: true;
  configured?: boolean;
  connected?: boolean;
  user?: Bitrix24OAuthStatusDto["user"];
  warning?: string;
  message?: string;
};
type OAuthStatusApiErr = { success: false; message?: string; code?: string };

/**
 * Статус персональной авторизации Bitrix24: GET /api/bitrix24/oauth/status
 */
export async function getBitrix24OAuthStatus(): Promise<
  { ok: true; data: Bitrix24OAuthStatusDto } | { ok: false; message: string; code?: string }
> {
  let res: Response;
  try {
    res = await fetch("/api/bitrix24/oauth/status", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова." };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "Сервер вернул неожиданный ответ при проверке статуса Bitrix24." };
  }

  const body = data as OAuthStatusApiOk | OAuthStatusApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as OAuthStatusApiOk;
    let serverHint: string | undefined;
    if (typeof ok.message === "string" && ok.message.trim()) serverHint = ok.message.trim();
    return {
      ok: true,
      data: {
        configured: ok.configured === true,
        connected: ok.connected === true,
        ...(typeof ok.user === "object" && ok.user ? { user: ok.user } : {}),
        ...(serverHint ? { serverHint } : {}),
      },
    };
  }

  const err = body as OAuthStatusApiErr;
  const message =
    typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : "Не удалось получить статус OAuth Bitrix24.";
  return { ok: false, message, code: typeof err.code === "string" ? err.code : undefined };
}

type OAuthStartApiOk = { success: true; redirectUrl?: string };
type OAuthStartApiErr = { success: false; message?: string; code?: string };

/**
 * Старт OAuth Bitrix24: GET /api/bitrix24/oauth/start (редирект URL приходит в JSON).
 */
export async function startBitrix24OAuth(): Promise<
  { ok: true; redirectUrl: string } | { ok: false; message: string; code?: string }
> {
  let res: Response;
  try {
    res = await fetch("/api/bitrix24/oauth/start", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова." };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "Сервер вернул неожиданный ответ при запуске OAuth Bitrix24." };
  }

  const body = data as OAuthStartApiOk | OAuthStartApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as OAuthStartApiOk;
    const u = typeof ok.redirectUrl === "string" && ok.redirectUrl.trim() ? ok.redirectUrl.trim() : "";
    if (!u) {
      return { ok: false, message: "Сервер не вернул адрес перенаправления Bitrix24." };
    }
    return { ok: true, redirectUrl: u };
  }

  const err = body as OAuthStartApiErr;
  const message =
    typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : "Не удалось начать подключение Bitrix24.";
  return { ok: false, message, code: typeof err.code === "string" ? err.code : undefined };
}

type ChatRecentPersonalApiOk = { success: true; chats?: Bitrix24RecentChatDto[] };
type ChatRecentPersonalApiErr = { success: false; message?: string; code?: string; bitrixCode?: string };

/**
 * Личные чаты текущего пользователя Bitrix24: POST /api/bitrix24/chat/recent-personal (персональный токен на сервере).
 */
export async function listBitrix24PersonalChats(): Promise<
  { ok: true; chats: Bitrix24RecentChatDto[] } | { ok: false; message: string; code?: string; bitrixCode?: string }
> {
  let res: Response;
  try {
    res = await fetch("/api/bitrix24/chat/recent-personal", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: "{}",
    });
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова." };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "Сервер вернул неожиданный ответ при загрузке чатов Bitrix24." };
  }

  const body = data as ChatRecentPersonalApiOk | ChatRecentPersonalApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as ChatRecentPersonalApiOk;
    const raw = Array.isArray(ok.chats) ? ok.chats : [];
    const chats: Bitrix24RecentChatDto[] = raw.map((row: unknown) => {
      const c = row as Record<string, unknown>;
      const out: Bitrix24RecentChatDto = {
        dialogId: String(c.dialogId ?? ""),
        title: String(c.title ?? ""),
      };
      if (typeof c.chatId === "number" && Number.isFinite(c.chatId)) out.chatId = c.chatId;
      if (typeof c.lastMessageText === "string" && c.lastMessageText.trim()) out.lastMessageText = c.lastMessageText.trim();
      if (typeof c.lastMessageDate === "string" && c.lastMessageDate.trim()) out.lastMessageDate = c.lastMessageDate.trim();
      if (typeof c.unread === "boolean") out.unread = c.unread;
      if (typeof c.counter === "number" && Number.isFinite(c.counter)) out.counter = c.counter;
      if (typeof c.type === "string" && c.type.trim()) out.type = c.type.trim();
      if (typeof c.entityType === "string" && c.entityType.trim()) out.entityType = c.entityType.trim();
      if (typeof c.entityId === "string" && c.entityId.trim()) out.entityId = c.entityId.trim();
      return out;
    });
    return { ok: true, chats };
  }

  const err = body as ChatRecentPersonalApiErr;
  return {
    ok: false,
    message: humanizeBitrixChatApiFailure(err),
    code: typeof err.code === "string" ? err.code : undefined,
    bitrixCode: typeof err.bitrixCode === "string" ? err.bitrixCode : undefined,
  };
}

/**
 * Сообщения личного диалога: POST /api/bitrix24/chat/messages-personal
 */
export async function getBitrix24PersonalMessages(
  dialogId: string,
  limit?: number,
): Promise<
  | { ok: true; dialogId: string; messages: Bitrix24ChatMessageDto[] }
  | { ok: false; message: string; code?: string; bitrixCode?: string }
> {
  const trimmed = String(dialogId ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: "Не указан идентификатор диалога Bitrix24." };
  }
  const payload: Record<string, unknown> = { dialogId: trimmed };
  if (limit != null) payload.limit = limit;

  let res: Response;
  try {
    res = await fetch("/api/bitrix24/chat/messages-personal", {
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
    return { ok: false, message: "Сервер вернул неожиданный ответ при загрузке сообщений Bitrix24." };
  }

  const body = data as ChatMessagesApiOk | ChatMessagesApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as ChatMessagesApiOk;
    const did = typeof ok.dialogId === "string" && ok.dialogId.trim() ? ok.dialogId.trim() : trimmed;
    const raw = Array.isArray(ok.messages) ? ok.messages : [];
    const messages: Bitrix24ChatMessageDto[] = raw.map((row: unknown) => {
      const m = row as Record<string, unknown>;
      const idRaw = m.id;
      const id = typeof idRaw === "number" || typeof idRaw === "string" ? idRaw : String(idRaw ?? "");
      const msg: Bitrix24ChatMessageDto = {
        id,
        text: String(m.text ?? ""),
      };
      if (typeof m.authorId === "number" && Number.isFinite(m.authorId)) msg.authorId = m.authorId;
      if (typeof m.date === "string" && m.date.trim()) msg.date = m.date.trim();
      if (typeof m.unread === "boolean") msg.unread = m.unread;
      return msg;
    });
    return { ok: true, dialogId: did, messages };
  }

  const err = body as ChatMessagesApiErr;
  return {
    ok: false,
    message: humanizeBitrixChatApiFailure(err),
    code: typeof err.code === "string" ? err.code : undefined,
    bitrixCode: typeof err.bitrixCode === "string" ? err.bitrixCode : undefined,
  };
}

/**
 * Отправка в личный диалог: POST /api/bitrix24/chat/send-personal
 */
export async function sendBitrix24PersonalMessage(
  dialogId: string,
  message: string,
): Promise<{ ok: true; messageId: string | number } | { ok: false; message: string; code?: string; bitrixCode?: string }> {
  const trimmedDialog = String(dialogId ?? "").trim();
  const trimmedMsg = String(message ?? "").trim();
  if (!trimmedDialog) {
    return { ok: false, message: "Не указан идентификатор диалога Bitrix24." };
  }
  if (!trimmedMsg.length) {
    return { ok: false, message: "Введите текст сообщения." };
  }
  if (trimmedMsg.length > 2000) {
    return { ok: false, message: "Сообщение не может быть длиннее 2000 символов." };
  }

  let res: Response;
  try {
    res = await fetch("/api/bitrix24/chat/send-personal", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ dialogId: trimmedDialog, message: trimmedMsg }),
    });
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова." };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "Сервер вернул неожиданный ответ при отправке сообщения в Bitrix24." };
  }

  const body = data as ChatSendApiOk | ChatSendApiErr | Record<string, unknown>;
  if (typeof body === "object" && body && "success" in body && body.success === true) {
    const ok = body as ChatSendApiOk;
    if (ok.messageId == null) {
      return { ok: false, message: "Сервер не вернул идентификатор сообщения Bitrix24." };
    }
    return { ok: true, messageId: ok.messageId };
  }

  const err = body as ChatSendApiErr;
  return {
    ok: false,
    message: humanizeBitrixChatApiFailure(err),
    code: typeof err.code === "string" ? err.code : undefined,
    bitrixCode: typeof err.bitrixCode === "string" ? err.bitrixCode : undefined,
  };
}

/**
 * Сброс персональной OAuth-сессии Bitrix24 (HttpOnly cookie на сервере).
 */
export async function disconnectBitrix24OAuth(): Promise<{ ok: true } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetch("/api/bitrix24/oauth/disconnect", {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером." };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "Сервер вернул неожиданный ответ." };
  }
  const b = data as { success?: boolean; message?: string };
  if (typeof b === "object" && b && b.success === true) return { ok: true };
  const m = typeof b.message === "string" && b.message.trim() ? b.message.trim() : "Не удалось отключить Bitrix24.";
  return { ok: false, message: m };
}
