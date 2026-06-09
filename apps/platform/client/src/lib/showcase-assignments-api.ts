/**
 * HTTP API заданий на отгрузку (showcase assignments).
 */

import type { AssignmentDto, AssignmentItemStatus } from "@shared/showcase-assignments-handlers";

export type { AssignmentDto, AssignmentItemStatus };

export type AssignmentItemInput = {
  targetKind: "model" | "variant";
  targetId: string;
  modelName?: string;
};

type CreateAssignmentBody = {
  dealerId: string;
  tradePointId: string;
  title?: string;
  comment?: string | null;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  assigneeName?: string | null;
  items: AssignmentItemInput[];
};

type ApiOk = { success: true; assignment: AssignmentDto };
type ApiErr = { success: false; message?: string; code?: string };

function parseApiError(json: ApiOk | ApiErr, fallback: string): string {
  if (json.success === false && json.message) return json.message;
  return fallback;
}

export async function createAssignment(body: CreateAssignmentBody): Promise<AssignmentDto> {
  const res = await fetch("/api/showcase-assignments/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiOk | ApiErr;
  if (!res.ok || json.success !== true) {
    throw new Error(parseApiError(json, "Не удалось создать задание"));
  }
  return json.assignment;
}

export async function getAssignment(id: string): Promise<AssignmentDto> {
  const res = await fetch(`/api/showcase-assignments/get?id=${encodeURIComponent(id)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = (await res.json()) as ApiOk | ApiErr;
  if (!res.ok || json.success !== true) {
    throw new Error(parseApiError(json, "Задание не найдено или у вас нет доступа"));
  }
  return json.assignment;
}

export type SetItemStatusBody = {
  assignmentId: string;
  itemId: string;
  itemStatus: AssignmentItemStatus;
  problemReason?: string | null;
  photoUrl?: string | null;
  photoThumbUrl?: string | null;
  shippedDate?: string | null;
};

export async function setItemStatus(body: SetItemStatusBody): Promise<AssignmentDto> {
  const res = await fetch("/api/showcase-assignments/item-set-status", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiOk | ApiErr;
  if (!res.ok || json.success !== true) {
    throw new Error(parseApiError(json, "Не удалось обновить позицию"));
  }
  return json.assignment;
}

export type SubmitAssignmentBody = {
  assignmentId: string;
  shippedDate?: string | null;
  comment?: string | null;
};

export async function submitAssignment(body: SubmitAssignmentBody): Promise<AssignmentDto> {
  const res = await fetch("/api/showcase-assignments/submit", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiOk | ApiErr;
  if (!res.ok || json.success !== true) {
    throw new Error(parseApiError(json, "Не удалось завершить задание"));
  }
  return json.assignment;
}

export function assignmentShareUrl(id: string): string {
  return `${window.location.origin}/#/assignment/${id}`;
}
