/**
 * Логика POST /api/bitrix24/tasks/create (Vercel + Express через re-export).
 * Лежит под api/_lib/ — Vercel игнорирует подпапки с префиксом `_` и не превращает их в функции.
 */

import { executeBitrix24TaskAdd, type Bitrix24TaskAddHttpResult } from "./webhook-task-core";

const MAX_TITLE = 180;
const MIN_TITLE = 3;
const MAX_DESCRIPTION = 4000;
const MAX_RETURN_URL = 8000;
const MAX_BITRIX_DESCRIPTION = 32000;

export type Bitrix24TasksCreatePayload = {
  title: string;
  description: string;
  dealerId: string;
  dealerName: string;
  tradePointId?: string;
  tradePointName?: string;
  returnUrl?: string;
};

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t;
}

function buildBitrixTaskDescription(payload: Bitrix24TasksCreatePayload): string {
  const lines: string[] = [];
  if (payload.description.trim()) lines.push(payload.description.trim());
  lines.push(`Клиент: ${payload.dealerName.trim()}`);
  if (payload.tradePointName?.trim()) {
    lines.push(`Торговая точка: ${payload.tradePointName.trim()}`);
  }
  if (payload.returnUrl?.trim()) {
    lines.push(`Ссылка в ЛК: ${payload.returnUrl.trim()}`);
  }
  let body = lines.join("\n\n");
  if (body.length > MAX_BITRIX_DESCRIPTION) {
    body = `${body.slice(0, MAX_BITRIX_DESCRIPTION - 20)}\n\n…(обрезано)`;
  }
  return body;
}

export function validateBitrix24TasksCreateBody(raw: unknown): { ok: true; value: Bitrix24TasksCreatePayload } | { ok: false; message: string } {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Ожидается JSON-объект в теле запроса." };
  }
  const o = raw as Record<string, unknown>;

  const title = asTrimmedString(o.title);
  if (!title) return { ok: false, message: "Поле title обязательно." };
  if (title.length < MIN_TITLE) return { ok: false, message: `Заголовок задачи: минимум ${MIN_TITLE} символа.` };
  if (title.length > MAX_TITLE) return { ok: false, message: `Заголовок задачи: максимум ${MAX_TITLE} символов.` };

  const descRaw = o.description;
  const description = typeof descRaw === "string" ? descRaw : descRaw == null ? "" : null;
  if (description === null) return { ok: false, message: "Поле description должно быть строкой." };
  if (description.length > MAX_DESCRIPTION) {
    return { ok: false, message: `Описание: максимум ${MAX_DESCRIPTION} символов.` };
  }

  const dealerId = asTrimmedString(o.dealerId);
  if (!dealerId) return { ok: false, message: "Поле dealerId обязательно." };

  const dealerName = asTrimmedString(o.dealerName);
  if (!dealerName) return { ok: false, message: "Поле dealerName обязательно." };

  let tradePointId: string | undefined;
  if (o.tradePointId !== undefined && o.tradePointId !== null) {
    const tp = asTrimmedString(o.tradePointId);
    if (!tp) return { ok: false, message: "Поле tradePointId не может быть пустой строкой." };
    tradePointId = tp;
  }

  let tradePointName: string | undefined;
  if (o.tradePointName !== undefined && o.tradePointName !== null) {
    const tn = asTrimmedString(o.tradePointName);
    if (!tn) return { ok: false, message: "Поле tradePointName не может быть пустой строкой." };
    tradePointName = tn;
  }

  let returnUrl: string | undefined;
  if (o.returnUrl !== undefined && o.returnUrl !== null) {
    const ru = asTrimmedString(o.returnUrl);
    if (!ru) return { ok: false, message: "Поле returnUrl не может быть пустой строкой." };
    if (ru.length > MAX_RETURN_URL) return { ok: false, message: "Поле returnUrl слишком длинное." };
    returnUrl = ru;
  }

  return {
    ok: true,
    value: {
      title,
      description,
      dealerId,
      dealerName,
      tradePointId,
      tradePointName,
      returnUrl,
    },
  };
}

export async function runBitrix24TasksCreate(rawBody: unknown): Promise<Bitrix24TaskAddHttpResult> {
  const validated = validateBitrix24TasksCreateBody(rawBody);
  if (!validated.ok) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_CREATE_VALIDATION_ERROR",
        message: validated.message,
      },
    };
  }

  const description = buildBitrixTaskDescription(validated.value);
  const out = await executeBitrix24TaskAdd(
    {
      TITLE: validated.value.title,
      DESCRIPTION: description,
    },
    {
      successMessage: "Задача создана в Bitrix24",
      logPrefix: "[bitrix24-api]",
    },
  );

  if (out.status === 200 && out.body && typeof out.body === "object" && "taskId" in out.body) {
    const tid = (out.body as { taskId?: unknown }).taskId;
    return {
      status: 200,
      body: {
        ...out.body,
        taskId: tid != null ? String(tid) : "",
      },
    };
  }

  return out;
}
