/**
 * POST /api/bitrix24/tasks/list для Express (Node).
 * Логика продублирована из api/bitrix24/tasks/list.ts — без импортов из api/.
 */

export type Bitrix24TasksListHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 50;

type BitrixSuccess = { result: unknown };
type BitrixErrorBody = { error?: string; error_description?: string };

type ListTaskOut = {
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

function buildTasksTaskListUrl(webhookBase: string): string {
  return `${webhookBase}/tasks.task.list`;
}

function extractWebhookUserIdFromBase(webhookBase: string): number | null {
  const m = webhookBase.match(/\/rest\/(\d+)\/[^/?#]+/i);
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveResponsibleIdForTask(webhookBase: string): { ok: true; id: number } | { ok: false; message: string } {
  const overrideRaw = process.env.BITRIX24_TASK_RESPONSIBLE_ID?.trim();
  if (overrideRaw) {
    const n = Number.parseInt(overrideRaw, 10);
    if (Number.isFinite(n) && n > 0) return { ok: true, id: n };
    return {
      ok: false,
      message:
        "BITRIX24_TASK_RESPONSIBLE_ID задан, но должен быть положительным целым числом (ID пользователя Bitrix24).",
    };
  }
  const fromUrl = extractWebhookUserIdFromBase(webhookBase);
  if (fromUrl != null) return { ok: true, id: fromUrl };
  return {
    ok: false,
    message:
      "Не удалось извлечь ID пользователя из BITRIX24_WEBHOOK_URL (ожидается шаблон .../rest/<число>/.../). Укажите BITRIX24_TASK_RESPONSIBLE_ID вручную.",
  };
}

function validateListBody(raw: unknown): { ok: true; limit: number; onlyOpen: boolean } | { ok: false; message: string } {
  if (raw == null || raw === "") {
    return { ok: true, limit: DEFAULT_LIMIT, onlyOpen: true };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "Ожидается JSON-объект в теле запроса." };
  }
  const o = raw as Record<string, unknown>;
  let limit = DEFAULT_LIMIT;
  if (Object.prototype.hasOwnProperty.call(o, "limit")) {
    const lv = o.limit;
    const n = typeof lv === "number" ? lv : typeof lv === "string" ? Number.parseInt(String(lv).trim(), 10) : NaN;
    if (!Number.isFinite(n) || n < MIN_LIMIT || n > MAX_LIMIT) {
      return { ok: false, message: `Поле limit должно быть числом от ${MIN_LIMIT} до ${MAX_LIMIT}.` };
    }
    limit = Math.floor(n);
  }
  let onlyOpen = true;
  if (Object.prototype.hasOwnProperty.call(o, "onlyOpen")) {
    const v = o.onlyOpen;
    if (typeof v !== "boolean") {
      return { ok: false, message: "Поле onlyOpen должно быть boolean." };
    }
    onlyOpen = v;
  }
  return { ok: true, limit, onlyOpen };
}

function strOf(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function nullIfEmpty(s: string): string | null {
  return s.length ? s : null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function mapBitrixTaskRow(raw: unknown): ListTaskOut | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const bitrixTaskId = strOf(o.id ?? o.ID);
  if (!bitrixTaskId) return null;
  const title = strOf(o.title ?? o.TITLE) || "(без названия)";
  const description = truncate(strOf(o.description ?? o.DESCRIPTION), 50_000);
  const status = strOf(o.status ?? o.STATUS ?? o.realStatus ?? o.REAL_STATUS) || "unknown";
  const responsibleId = strOf(o.responsibleId ?? o.RESPONSIBLE_ID);
  const createdBy = strOf(o.createdBy ?? o.CREATED_BY);
  const createdDate = strOf(o.createdDate ?? o.CREATED_DATE ?? o.DATE_START ?? "");
  const deadlineRaw = strOf(o.deadline ?? o.DEADLINE);
  const changedRaw = strOf(o.changedDate ?? o.CHANGED_DATE ?? o.CHANGE_DATE);
  return {
    bitrixTaskId,
    title,
    description,
    status,
    responsibleId,
    createdBy,
    createdDate,
    deadline: nullIfEmpty(deadlineRaw),
    changedDate: nullIfEmpty(changedRaw),
  };
}

function extractTasksArray(result: unknown): unknown[] {
  if (result == null || typeof result !== "object" || Array.isArray(result)) return [];
  const r = result as Record<string, unknown>;
  const tasks = r.tasks ?? r.TASKS;
  return Array.isArray(tasks) ? tasks : [];
}

export async function runBitrix24TasksList(rawBody: unknown): Promise<Bitrix24TasksListHttpResult> {
  const validated = validateListBody(rawBody ?? {});
  if (!validated.ok) {
    return {
      status: 400,
      body: { success: false, code: "BITRIX24_LIST_VALIDATION_ERROR", message: validated.message },
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

  const rid = resolveResponsibleIdForTask(parsed.base);
  if (!rid.ok) {
    return {
      status: 400,
      body: { success: false, code: "BITRIX24_WEBHOOK_URL_INVALID", message: rid.message },
    };
  }

  const filter: Record<string, string | number> = { RESPONSIBLE_ID: rid.id };
  if (validated.onlyOpen) {
    filter["!REAL_STATUS"] = 5;
  }

  const payload = {
    filter,
    select: [
      "ID",
      "TITLE",
      "DESCRIPTION",
      "STATUS",
      "RESPONSIBLE_ID",
      "CREATED_BY",
      "CREATED_DATE",
      "DEADLINE",
      "CHANGED_DATE",
    ],
    order: { CHANGED_DATE: "desc" },
    start: 0,
  };

  const url = buildTasksTaskListUrl(parsed.base);

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
      console.error("[bitrix24] tasks/list bitrix non-json", "http", bxRes.status);
      return {
        status: 502,
        body: {
          success: false,
          code: "BITRIX24_BAD_RESPONSE",
          message: "Bitrix24 вернул неожиданный ответ. Попробуйте позже или проверьте URL webhook.",
        },
      };
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "unknown";
    console.error("[bitrix24] tasks/list bitrix network", m);
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_NETWORK",
        message: "Не удалось связаться с Bitrix24. Проверьте сеть и доступность портала.",
      },
    };
  }

  if (bitrixJson.error) {
    const bitrixCode = typeof bitrixJson.error === "string" ? bitrixJson.error : "UNKNOWN";
    console.error("[bitrix24] tasks/list bitrix api error", { bitrixCode });
    return {
      status: 502,
      body: {
        success: false,
        code: "BITRIX24_API_ERROR",
        bitrixCode,
        message:
          "Bitrix24 не принял запрос на список задач. Проверьте права webhook и доступ к задачам в портале.",
      },
    };
  }

  const rawTasks = extractTasksArray(bitrixJson.result);
  const mapped: ListTaskOut[] = [];
  for (const row of rawTasks) {
    const m = mapBitrixTaskRow(row);
    if (m) mapped.push(m);
  }

  const sliced = mapped.slice(0, validated.limit);

  return {
    status: 200,
    body: {
      success: true,
      tasks: sliced,
    },
  };
}
