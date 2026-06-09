/**
 * HTTP API заданий на отгрузку (showcase assignments).
 */

import type { AssignmentDto } from "@shared/showcase-assignments-handlers";

export type { AssignmentDto };

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
type ApiErr = { success: false; message?: string };

export async function createAssignment(body: CreateAssignmentBody): Promise<AssignmentDto> {
  const res = await fetch("/api/showcase-assignments/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiOk | ApiErr;
  if (!res.ok || json.success !== true) {
    const message =
      json.success === false && json.message ? json.message : "Не удалось создать задание";
    throw new Error(message);
  }
  return json.assignment;
}

export function assignmentShareUrl(id: string): string {
  return `${window.location.origin}/#/assignment/${id}`;
}
