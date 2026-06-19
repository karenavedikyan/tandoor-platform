/**
 * HTTP API showcase distribution (Промт 426).
 */

import type {
  ShowcaseCategoryId,
  ShowcaseCompletePayload,
  ShowcaseCompleteResultKind,
  ShowcaseGlobalTaskRow,
  ShowcaseHistoryEntry,
  ShowcaseRecommendationTaskStored,
  ShowcaseRowOverride,
  ShowcaseStorageV1Dto,
  ShowcaseTaskStatus,
  ShowcaseTaskUpdate,
} from "./showcase-distribution-data.js";
import { SHOWCASE_DISTRIBUTION_CHANGED_EVENT } from "./showcase-distribution-data.js";

const BASE = "/api/showcase-distribution";

export type { ShowcaseStorageV1Dto };

export type ShowcaseDistributionApiError = {
  code: "network" | "forbidden" | "conflict" | "bad_request";
  message: string;
};

export class ShowcaseDistributionError extends Error {
  code: ShowcaseDistributionApiError["code"];
  constructor(code: ShowcaseDistributionApiError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/** @deprecated use SHOWCASE_DISTRIBUTION_CHANGED_EVENT from showcase-distribution-data */
export { SHOWCASE_DISTRIBUTION_CHANGED_EVENT };

export function dispatchShowcaseDistributionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHOWCASE_DISTRIBUTION_CHANGED_EVENT));
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const t = await res.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapError(res: Response, body: Record<string, unknown>, fallback: string): ShowcaseDistributionError {
  if (res.status === 403) return new ShowcaseDistributionError("forbidden", typeof body.reason === "string" ? body.reason : "Недостаточно прав.");
  if (res.status === 409) return new ShowcaseDistributionError("conflict", typeof body.message === "string" ? body.message : "Конфликт данных.");
  if (res.status === 400) return new ShowcaseDistributionError("bad_request", typeof body.message === "string" ? body.message : fallback);
  return new ShowcaseDistributionError("network", fallback);
}

function parseState(raw: unknown): ShowcaseStorageV1Dto {
  if (!raw || typeof raw !== "object") throw new ShowcaseDistributionError("network", "Некорректный ответ сервера.");
  return raw as ShowcaseStorageV1Dto;
}

export async function fetchShowcaseDistributionState(dealerId: string): Promise<ShowcaseStorageV1Dto> {
  const sp = new URLSearchParams({ dealerId });
  let res: Response;
  try {
    res = await fetch(`${BASE}/state?${sp.toString()}`, { method: "GET", credentials: "include", cache: "no-store" });
  } catch {
    throw new ShowcaseDistributionError("network", "Не удалось загрузить данные витрины.");
  }
  const body = await readJson(res);
  if (!res.ok) throw mapError(res, body, "Не удалось загрузить данные витрины.");
  return parseState(body.state);
}

export async function fetchShowcaseGlobalTasks(): Promise<ShowcaseGlobalTaskRow[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/global-tasks`, { method: "GET", credentials: "include", cache: "no-store" });
  } catch {
    throw new ShowcaseDistributionError("network", "Не удалось загрузить задачи витрины.");
  }
  const body = await readJson(res);
  if (!res.ok) throw mapError(res, body, "Не удалось загрузить задачи витрины.");
  const tasks = body.tasks;
  if (!Array.isArray(tasks)) throw new ShowcaseDistributionError("network", "Некорректный ответ сервера.");
  return tasks as ShowcaseGlobalTaskRow[];
}

export async function postShowcaseTaskComplete(
  payload: ShowcaseCompletePayload,
): Promise<ShowcaseStorageV1Dto> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/task-complete`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ShowcaseDistributionError("network", "Не удалось сохранить.");
  }
  const body = await readJson(res);
  if (!res.ok) throw mapError(res, body, "Не удалось сохранить.");
  dispatchShowcaseDistributionChanged();
  return parseState(body.state);
}

export async function postShowcaseTaskStatus(
  taskId: string,
  status: ShowcaseTaskStatus,
  dealerId: string,
  categoryId: ShowcaseCategoryId,
): Promise<ShowcaseStorageV1Dto> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/task-status`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status, dealerId, categoryId }),
    });
  } catch {
    throw new ShowcaseDistributionError("network", "Не удалось сохранить.");
  }
  const body = await readJson(res);
  if (!res.ok) throw mapError(res, body, "Не удалось сохранить.");
  dispatchShowcaseDistributionChanged();
  return parseState(body.state);
}

export async function postShowcaseRecommendation(payload: {
  dealerId: string;
  modelId: string;
  modelLabel: string;
  categoryId: ShowcaseCategoryId;
  bucket: "top20" | "novelty";
  reason: string;
}): Promise<{ ok: boolean; reason?: string; state: ShowcaseStorageV1Dto }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/recommendation`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ShowcaseDistributionError("network", "Не удалось сохранить.");
  }
  const body = await readJson(res);
  if (res.status === 409) {
    return { ok: false, reason: typeof body.message === "string" ? body.message : "Уже добавлена.", state: emptyState() };
  }
  if (!res.ok) throw mapError(res, body, "Не удалось сохранить.");
  dispatchShowcaseDistributionChanged();
  return { ok: true, state: parseState(body.state) };
}

export async function postShowcaseOverride(payload: {
  dealerId: string;
  categoryId: ShowcaseCategoryId;
  actualCount: number;
  status: "ok" | "attention" | "critical";
  comment?: string;
}): Promise<ShowcaseStorageV1Dto> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/override`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ShowcaseDistributionError("network", "Не удалось сохранить.");
  }
  const body = await readJson(res);
  if (!res.ok) throw mapError(res, body, "Не удалось сохранить.");
  dispatchShowcaseDistributionChanged();
  return parseState(body.state);
}

export async function postShowcaseDistributionImport(storage: ShowcaseStorageV1Dto): Promise<number> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/import`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storage }),
    });
  } catch {
    throw new ShowcaseDistributionError("network", "Не удалось перенести данные.");
  }
  const body = await readJson(res);
  if (!res.ok) throw mapError(res, body, "Не удалось перенести данные.");
  dispatchShowcaseDistributionChanged();
  return typeof body.imported === "number" ? body.imported : Number(body.imported) || 0;
}

function emptyState(): ShowcaseStorageV1Dto {
  return { overrides: {}, taskUpdates: {}, historyByDealer: {}, recommendationTaskEntries: {} };
}

export type { ShowcaseCompleteResultKind };
